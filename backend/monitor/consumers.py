import secrets
from datetime import datetime, timedelta
from urllib.parse import unquote

from asgiref.sync import async_to_sync, sync_to_async
from channels.layers import get_channel_layer
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from .models import Alert, Reading, ReadingBuffer, Transformer


def _adjust_energy_kwh(raw_energy, transformer):
    # Dashboard "reset" is implemented as a backend energy baseline offset.
    # The physical meter keeps accumulating kWh, so we subtract the offset here
    # to keep websocket live meters consistent with REST API responses.
    offset = 0.0
    try:
        offset = getattr(transformer, "energy_kwh_offset", 0.0) or 0.0
    except Exception:
        offset = 0.0

    adjusted_energy = None
    if raw_energy is not None:
        try:
            adjusted_energy = float(raw_energy) - float(offset)
            if adjusted_energy < 0:
                adjusted_energy = 0.0
        except (TypeError, ValueError):
            adjusted_energy = None

    return adjusted_energy


_ENERGY_ROLLBACK_THRESHOLD_KWH = 1.0


def _check_energy_rollback(transformer, new_energy_kwh):
    """Detect an unexpected PZEM energy counter drop and react.

    If the incoming energy value is significantly lower than the last stored
    reading — and no firmware-initiated reset is pending — we treat this as an
    unexpected rollback (e.g. power loss, manual PZEM button reset, or hardware
    replacement without going through the dashboard Reset flow).

    Action taken:
      - Zero out energy_kwh_offset so the display starts tracking from the new
        hardware value rather than drifting negative forever.
      - Create an Alert so staff are notified.

    If pending_energy_reset is True the firmware already requested a hardware
    reset through the dashboard; that path is handled by ack_energy_reset and
    we must not interfere.
    """
    if new_energy_kwh is None:
        return

    try:
        new_val = float(new_energy_kwh)
    except (TypeError, ValueError):
        return

    # Cache the last energy value to avoid a DB query on every reading ingest.
    # At 12 readings/min per device this saves ~12 DB round-trips per minute.
    # 60 s TTL is short enough to catch real rollbacks; on cache miss we re-query.
    _cache_key = f"last_energy_{transformer.pk}"
    last_energy = cache.get(_cache_key)
    if last_energy is None:
        last_energy = (
            Reading.objects.filter(transformer=transformer, energy_kwh__isnull=False)
            .order_by("-timestamp")
            .values_list("energy_kwh", flat=True)
            .first()
        )
        if last_energy is not None:
            cache.set(_cache_key, last_energy, 60)
    if last_energy is None:
        return  # No history yet; nothing to compare against.

    try:
        last_val = float(last_energy)
    except (TypeError, ValueError):
        return

    if new_val >= last_val - _ENERGY_ROLLBACK_THRESHOLD_KWH:
        return  # Normal or negligible drop; no action needed.

    # Significant rollback detected.
    if getattr(transformer, "pending_energy_reset", False):
        # Expected: firmware is in the middle of an admin-requested reset.
        # ack_energy_reset will clear the offset once the PZEM is confirmed reset.
        return

    # Unexpected rollback — zero the offset so the UI tracks the new hardware value.
    transformer.energy_kwh_offset = 0.0
    transformer.save(update_fields=["energy_kwh_offset"])
    cache.delete(_cache_key)  # Invalidate so the next reading re-queries the DB
    rollback_alert = Alert.objects.create(
        transformer=transformer,
        condition="abnormal",
        message=(
            f"Energy counter rollback detected: PZEM accumulated energy dropped from "
            f"{last_val:.3f} kWh to {new_val:.3f} kWh unexpectedly. "
            "Device may have lost power or been manually reset. "
            "Energy offset has been zeroed to track from the new hardware value."
        ),
    )
    broadcast_alert(transformer.id, rollback_alert)


def _broadcast_payload(payload):
    channel_layer = get_channel_layer()
    group_name = f"monitor_{payload['reading']['transformer_id']}"
    async_to_sync(channel_layer.group_send)(group_name, payload)


# ---------------------------------------------------------------------------
# DB persistence helpers (mirror of views.py logic, no circular import)
# ---------------------------------------------------------------------------

_CONDITION_SEVERITY = {
    "normal": 0, "heavy_load": 1, "heavy_peak_load": 2,
    "poor_power_quality": 3, "abnormal": 4, "danger_zone": 5,
    "overload": 6, "severe_overload": 7, "critical": 8,
}


def _ws_window_start(now, interval_minutes):
    return now - timedelta(
        minutes=now.minute % interval_minutes,
        seconds=now.second,
        microseconds=now.microsecond,
    )


def _ws_average(rows, attr):
    vals = [getattr(r, attr) for r in rows if getattr(r, attr) is not None]
    return sum(vals) / len(vals) if vals else None


def _ws_most_severe_condition(rows):
    conditions = [r.condition for r in rows if r.condition]
    if not conditions:
        return "normal"
    return max(conditions, key=lambda c: _CONDITION_SEVERITY.get(c, 0))


def _ws_flush_buffer_if_due(transformer, now):
    interval = int(getattr(transformer, "reading_interval_minutes", 0) or 0)
    if interval <= 0:
        return None
    window_start = _ws_window_start(now, interval)
    stale_qs = ReadingBuffer.objects.filter(
        transformer=transformer,
        timestamp__lt=window_start,
    ).order_by("timestamp")
    rows = list(stale_qs)
    if not rows:
        return None
    latest = rows[-1]
    reading = Reading.objects.create(
        transformer=transformer,
        voltage=_ws_average(rows, "voltage"),
        current=_ws_average(rows, "current"),
        apparent_power=_ws_average(rows, "apparent_power"),
        real_power=_ws_average(rows, "real_power"),
        power_factor=_ws_average(rows, "power_factor"),
        frequency=_ws_average(rows, "frequency"),
        oil_temp=_ws_average(rows, "oil_temp"),
        energy_kwh=latest.energy_kwh,
        condition=_ws_most_severe_condition(rows),
    )
    stale_qs.delete()
    return reading


def _persist_device_reading(transformer, data, now):
    """Write an incoming device reading to the DB, mirroring ReadingViewSet.create logic.

    Respects reading_interval_minutes: when > 0, buffers readings and flushes
    averaged rows at window boundaries instead of writing every reading.
    """
    condition = data.get("condition", "normal")
    interval = int(getattr(transformer, "reading_interval_minutes", 0) or 0)
    energy_kwh = data.get("energy_kwh")

    # Detect unexpected hardware energy counter rollbacks before persisting.
    _check_energy_rollback(transformer, energy_kwh)

    if interval <= 0:
        Reading.objects.create(
            transformer=transformer,
            voltage=data.get("voltage"),
            current=data.get("current"),
            apparent_power=data.get("apparent_power"),
            real_power=data.get("real_power"),
            power_factor=data.get("power_factor"),
            frequency=data.get("frequency"),
            oil_temp=data.get("oil_temp"),
            energy_kwh=data.get("energy_kwh"),
            condition=condition,
        )
    else:
        with transaction.atomic():
            ReadingBuffer.objects.create(
                transformer=transformer,
                voltage=data.get("voltage"),
                current=data.get("current"),
                apparent_power=data.get("apparent_power"),
                real_power=data.get("real_power"),
                power_factor=data.get("power_factor"),
                frequency=data.get("frequency"),
                oil_temp=data.get("oil_temp"),
                energy_kwh=data.get("energy_kwh"),
                condition=condition,
            )
            _ws_flush_buffer_if_due(transformer, now)

    if condition != "normal":
        alert = Alert.objects.create(
            transformer=transformer,
            condition=condition,
            message=f"Condition: {condition}",
        )
        broadcast_alert(transformer.id, alert)


def broadcast_alert(transformer_id, alert):
    """Broadcast a newly created Alert to all dashboard subscribers of this transformer."""
    channel_layer = get_channel_layer()
    group_name = f"monitor_{transformer_id}"
    payload = {
        "type": "alert_created",
        "alert": {
            "id": alert.id,
            "transformer": transformer_id,
            "timestamp": alert.timestamp.isoformat() if alert.timestamp else None,
            "condition": alert.condition,
            "message": alert.message,
            "sms_sent": alert.sms_sent,
            "acknowledged": alert.acknowledged,
        },
    }
    async_to_sync(channel_layer.group_send)(group_name, payload)


def broadcast_reading(reading):
    adjusted_energy = _adjust_energy_kwh(
        getattr(reading, "energy_kwh", None), getattr(reading, "transformer", None)
    )

    timestamp = getattr(reading, "timestamp", None)
    timestamp_iso = (
        timestamp.isoformat() if timestamp is not None else datetime.utcnow().isoformat()
    )
    payload = {
        "type": "reading_update",
        "reading": {
            "id": reading.id,
            "transformer_id": reading.transformer_id,
            "timestamp": timestamp_iso,
            "voltage": reading.voltage,
            "current": reading.current,
            "apparent_power": reading.apparent_power,
            "real_power": reading.real_power,
            "power_factor": reading.power_factor,
            "frequency": reading.frequency,
            "oil_temp": reading.oil_temp,
            "energy_kwh": adjusted_energy,
            "condition": reading.condition,
        },
        "last_seen": timestamp_iso,
    }
    _broadcast_payload(payload)


def broadcast_live_reading(transformer, data, timestamp):
    adjusted_energy = _adjust_energy_kwh(data.get("energy_kwh"), transformer)
    timestamp_iso = timestamp.isoformat()
    synthetic_id = int(timestamp.timestamp() * 1000)

    payload = {
        "type": "reading_update",
        "reading": {
            "id": synthetic_id,
            "transformer_id": transformer.id,
            "timestamp": timestamp_iso,
            "voltage": data.get("voltage"),
            "current": data.get("current"),
            "apparent_power": data.get("apparent_power"),
            "real_power": data.get("real_power"),
            "power_factor": data.get("power_factor"),
            "frequency": data.get("frequency"),
            "oil_temp": data.get("oil_temp"),
            "energy_kwh": adjusted_energy,
            "condition": data.get("condition", "normal"),
        },
        "last_seen": timestamp_iso,
    }
    _broadcast_payload(payload)


class MonitorConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # Ensure attributes exist even if we close early.
        self.group_name = None

        # Require JWT-authenticated users for dashboard websocket subscriptions.
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            await self.close()
            return

        self.transformer_id = self.scope["url_route"]["kwargs"]["transformer_id"]
        self.group_name = f"monitor_{self.transformer_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def reading_update(self, event):
        await self.send_json(event)

    async def alert_created(self, event):
        await self.send_json(event)


class DeviceConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for device-side reading push.

    Devices connect to /ws/device/<transformer_id>/?key=<device_api_key>
    and push JSON reading frames. Each frame is broadcast to the
    monitor_<id> channel group so dashboard subscribers receive live updates.
    Authentication is via a per-transformer API key (constant-time compare).
    """

    async def connect(self):
        self.group_name = None
        self.transformer = None

        transformer_id_str = self.scope["url_route"]["kwargs"]["transformer_id"]
        try:
            transformer_id = int(transformer_id_str)
        except ValueError:
            await self.close(code=4400)
            return

        # Parse ?key= from the query string.
        query_string = self.scope.get("query_string", b"").decode(errors="ignore")
        client_key = ""
        for part in query_string.split("&"):
            if part.startswith("key="):
                client_key = unquote(part[len("key="):])
                break

        if not client_key:
            await self.close(code=4401)
            return

        try:
            transformer = await sync_to_async(Transformer.objects.get)(pk=transformer_id)
        except Transformer.DoesNotExist:
            await self.close(code=4404)
            return

        server_key = (transformer.device_api_key or "").strip()
        if not server_key:
            await self.close(code=4403)
            return

        try:
            if len(client_key) != len(server_key) or not secrets.compare_digest(client_key, server_key):
                await self.close(code=4403)
                return
        except (TypeError, ValueError):
            await self.close(code=4403)
            return

        self.transformer = transformer
        self.transformer_id = transformer_id
        self.group_name = f"monitor_{transformer_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        if self.transformer is None:
            return

        # Validate required numeric fields before broadcasting.
        required = ("voltage", "current", "apparent_power", "real_power", "power_factor", "frequency", "oil_temp")
        for field in required:
            if content.get(field) is None:
                return

        now = timezone.now()
        timestamp_iso = now.isoformat()
        synthetic_id = int(now.timestamp() * 1000)

        offset = 0.0
        try:
            offset = float(self.transformer.energy_kwh_offset or 0.0)
        except (TypeError, AttributeError, ValueError):
            offset = 0.0

        raw_energy = content.get("energy_kwh")
        adjusted_energy = None
        if raw_energy is not None:
            try:
                adjusted_energy = max(0.0, float(raw_energy) - offset)
            except (TypeError, ValueError):
                adjusted_energy = None

        payload = {
            "type": "reading_update",
            "reading": {
                "id": synthetic_id,
                "transformer_id": self.transformer_id,
                "timestamp": timestamp_iso,
                "voltage": content.get("voltage"),
                "current": content.get("current"),
                "apparent_power": content.get("apparent_power"),
                "real_power": content.get("real_power"),
                "power_factor": content.get("power_factor"),
                "frequency": content.get("frequency"),
                "oil_temp": content.get("oil_temp"),
                "energy_kwh": adjusted_energy,
                "condition": content.get("condition", "normal"),
            },
            "last_seen": timestamp_iso,
        }
        await self.channel_layer.group_send(self.group_name, payload)

        # Persist to DB and update last_seen concurrently via sync_to_async.
        reading_data = {
            "voltage": content.get("voltage"),
            "current": content.get("current"),
            "apparent_power": content.get("apparent_power"),
            "real_power": content.get("real_power"),
            "power_factor": content.get("power_factor"),
            "frequency": content.get("frequency"),
            "oil_temp": content.get("oil_temp"),
            "energy_kwh": content.get("energy_kwh"),
            "condition": content.get("condition", "normal"),
        }
        await sync_to_async(_persist_device_reading)(self.transformer, reading_data, now)

        # Update last_seen so the dashboard knows the device is alive.
        qs = Transformer.objects.filter(pk=self.transformer_id)
        await sync_to_async(qs.update)(last_seen=now)

    async def reading_update(self, event):
        # Device consumers don't forward dashboard broadcasts back to the device.
        pass
