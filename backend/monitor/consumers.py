from datetime import datetime

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.generic.websocket import AsyncJsonWebsocketConsumer


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


def _broadcast_payload(payload):
    channel_layer = get_channel_layer()
    group_name = f"monitor_{payload['reading']['transformer_id']}"
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
