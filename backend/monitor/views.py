import csv
import io
import logging
import secrets
import os
import time

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Max, Min
from django.db import transaction
from datetime import timedelta

from .models import Transformer, Reading, Alert, SmsRecipient

logger = logging.getLogger(__name__)
from .serializers import (
    TransformerSerializer,
    ReadingSerializer,
    ReadingCreateSerializer,
    AlertSerializer,
    SmsRecipientSerializer,
)
from .consumers import broadcast_reading


# ---------------------------------------------------------------------------
# Filtersets
# ---------------------------------------------------------------------------

class ReadingFilter(django_filters.FilterSet):
    timestamp_gte = django_filters.IsoDateTimeFilter(field_name="timestamp", lookup_expr="gte")
    timestamp_lte = django_filters.IsoDateTimeFilter(field_name="timestamp", lookup_expr="lte")
    condition = django_filters.CharFilter(method="filter_condition")
    voltage_gte = django_filters.NumberFilter(field_name="voltage", lookup_expr="gte")
    voltage_lte = django_filters.NumberFilter(field_name="voltage", lookup_expr="lte")
    current_gte = django_filters.NumberFilter(field_name="current", lookup_expr="gte")
    current_lte = django_filters.NumberFilter(field_name="current", lookup_expr="lte")
    oil_temp_gte = django_filters.NumberFilter(field_name="oil_temp", lookup_expr="gte")
    oil_temp_lte = django_filters.NumberFilter(field_name="oil_temp", lookup_expr="lte")
    power_factor_gte = django_filters.NumberFilter(field_name="power_factor", lookup_expr="gte")
    power_factor_lte = django_filters.NumberFilter(field_name="power_factor", lookup_expr="lte")

    class Meta:
        model = Reading
        fields = ["transformer"]

    def filter_condition(self, queryset, name, value):
        values = [v.strip() for v in value.split(",") if v.strip()]
        if values:
            return queryset.filter(condition__in=values)
        return queryset


class AlertFilter(django_filters.FilterSet):
    timestamp_gte = django_filters.IsoDateTimeFilter(field_name="timestamp", lookup_expr="gte")
    timestamp_lte = django_filters.IsoDateTimeFilter(field_name="timestamp", lookup_expr="lte")
    condition = django_filters.CharFilter(method="filter_condition")
    acknowledged = django_filters.BooleanFilter(field_name="acknowledged")
    sms_sent = django_filters.BooleanFilter(field_name="sms_sent")

    class Meta:
        model = Alert
        fields = ["transformer"]

    def filter_condition(self, queryset, name, value):
        values = [v.strip() for v in value.split(",") if v.strip()]
        if values:
            return queryset.filter(condition__in=values)
        return queryset


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class ReportsPagination(PageNumberPagination):
    """Only activates when the client explicitly passes ?page=. Existing
    endpoints that omit the param keep returning plain arrays."""
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        if "page" not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)


# ---------------------------------------------------------------------------
# CSV streaming helpers
# ---------------------------------------------------------------------------
CSV_EXPORT_MAX_ROWS = 100_000


class _Echo:
    """Pseudo-buffer that returns what it receives (for StreamingHttpResponse)."""
    def write(self, value):
        return value


def _stream_csv(queryset, header, row_fn):
    """Yield CSV rows from a queryset using a streaming pseudo-buffer."""
    pseudo_buffer = _Echo()
    writer = csv.writer(pseudo_buffer)
    yield writer.writerow(header)
    for obj in queryset.iterator(chunk_size=2000):
        yield writer.writerow(row_fn(obj))


def _compute_insights_from_reading(reading, transformer):
    """Compute staff-facing insights from one reading and transformer. Matches frontend LiveMeters thresholds."""
    if not reading or not transformer:
        return None
    rated_va = transformer.rated_kva * 1000
    nominal_v = transformer.nominal_voltage or 220
    nominal_f = transformer.nominal_freq or 50

    # Loading % and capacity headroom
    ap = reading.apparent_power
    loading_percent = (ap / rated_va * 100) if (rated_va and ap is not None) else None
    capacity_remaining_kva = ((rated_va - ap) / 1000) if (ap is not None and rated_va) else None

    # Voltage: nominal ±7%
    v = reading.voltage
    if v is not None:
        if v >= nominal_v * 0.93 and v <= nominal_v * 1.07:
            voltage_status = "normal"
        elif v < nominal_v * 0.93:
            voltage_status = "low"
        else:
            voltage_status = "high"
    else:
        voltage_status = None

    # Power factor
    pf = reading.power_factor
    if pf is not None:
        if pf >= 0.85:
            power_factor_status = "good"
        elif pf >= 0.7:
            power_factor_status = "fair"
        else:
            power_factor_status = "poor"
    else:
        power_factor_status = None

    return {
        "loading_percent": round(loading_percent, 2) if loading_percent is not None else None,
        "voltage_status": voltage_status,
        "capacity_remaining_kva": round(capacity_remaining_kva, 2) if capacity_remaining_kva is not None else None,
        "power_factor_status": power_factor_status,
        "rated_kva": transformer.rated_kva,
        "nominal_voltage": nominal_v,
    }


class TransformerViewSet(viewsets.ModelViewSet):
    queryset = Transformer.objects.all()
    serializer_class = TransformerSerializer

    def get_permissions(self):
        # The ESP32 device posts readings; we only want admins/staff to manage transformers.
        if self.action in ["device_config", "ack_energy_reset"]:
            return [AllowAny()]
        if self.action in ["create", "update", "partial_update", "destroy", "reset"]:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=["get"], url_path="device_config")
    def device_config(self, request, pk=None):
        """
        Authenticated by header X-Device-Key (per-transformer secret).
        Returns nameplate fields for firmware threshold evaluation (must match dashboard).
        """
        client_key = (
            request.headers.get("X-Device-Key")
            or request.headers.get("X-Device-Token")
            or ""
        ).strip()
        if not client_key:
            return Response(
                {"detail": "Missing X-Device-Key header."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        transformer = get_object_or_404(Transformer.objects.all(), pk=pk)
        server_key = (transformer.device_api_key or "").strip()
        if not server_key:
            return Response(
                {"detail": "Device key not configured for this transformer."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            if len(client_key) != len(server_key) or not secrets.compare_digest(
                client_key, server_key
            ):
                return Response(
                    {"detail": "Invalid device key."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except (TypeError, ValueError):
            return Response(
                {"detail": "Invalid device key."},
                status=status.HTTP_403_FORBIDDEN,
            )

        rkva = float(transformer.rated_kva or 15)
        nv = float(transformer.nominal_voltage or 220)
        nf = float(transformer.nominal_freq or 60)
        ri = float(transformer.rated_current or 68)

        # Auto-fill phone_number from SIM modem if the device reports it.
        sim_phone = (request.headers.get("X-Sim-Phone") or "").strip()
        if sim_phone and sim_phone != (transformer.phone_number or "").strip():
            transformer.phone_number = sim_phone
            transformer.save(update_fields=["phone_number"])

        return Response(
            {
                "transformer_id": transformer.id,
                "name": transformer.name,
                "nominal_voltage": nv,
                "nominal_freq": nf,
                "rated_kva": rkva,
                "rated_current": ri,
                "rated_apparent_power_va": round(rkva * 1000.0, 2),
                # Firmware uses this to decide whether it should POST readings.
                "is_active": bool(transformer.is_active),
                # Firmware uses this to send SMS alerts.
                "sms_recipients": [
                    r.phone_number for r in transformer.sms_recipients.all()
                ],
                # Firmware checks this to reset the PZEM hardware energy counter.
                "pending_energy_reset": bool(transformer.pending_energy_reset),
            }
        )

    @action(detail=True, methods=["get"], url_path="insights")
    def insights(self, request, pk=None):
        """Return staff-facing insights for this transformer (current + 24h aggregates)."""
        transformer = self.get_object()
        latest = (
            Reading.objects.filter(transformer=transformer)
            .order_by("-timestamp")
            .first()
        )
        current = _compute_insights_from_reading(latest, transformer)

        # 24h aggregates
        since = timezone.now() - timedelta(hours=24)
        recent = (
            Reading.objects.filter(transformer=transformer, timestamp__gte=since)
            .order_by("timestamp")
        )
        peak_load_kva = None
        energy_24h_kwh = None
        if recent.exists():
            agg = recent.aggregate(
                max_va=Max("apparent_power"),
                min_energy=Min("energy_kwh"),
                max_energy=Max("energy_kwh"),
            )
            if agg["max_va"] is not None:
                peak_load_kva = round(agg["max_va"] / 1000, 2)
            if agg["min_energy"] is not None and agg["max_energy"] is not None:
                energy_24h_kwh = round(agg["max_energy"] - agg["min_energy"], 2)

        return Response({
            "current": current,
            "peak_load_24h_kva": peak_load_kva,
            "energy_24h_kwh": energy_24h_kwh,
        })

    @action(detail=True, methods=["post"], url_path="reset")
    def reset(self, request, pk=None):
        """
        Backend-only “transformer reset”.

        Sets an energy baseline offset and clears stored readings/alerts for this transformer.
        This helps when a transformer/PZEM module is replaced but the device itself isn't
        remotely reset by this dashboard.
        """
        transformer = self.get_object()

        with transaction.atomic():
            latest = (
                Reading.objects.filter(transformer=transformer)
                .order_by("-timestamp")
                .first()
            )
            raw_baseline = (latest.energy_kwh if latest else None) or 0.0

            # Ensure we persist a numeric value.
            try:
                offset = float(raw_baseline)
            except (TypeError, ValueError):
                offset = 0.0

            transformer.energy_kwh_offset = offset
            transformer.pending_energy_reset = True
            transformer.save(update_fields=["energy_kwh_offset", "pending_energy_reset"])

            # Clear history so charts/alerts restart cleanly.
            Alert.objects.filter(transformer=transformer).delete()
            Reading.objects.filter(transformer=transformer).delete()

        return Response(
            {
                "ok": True,
                "energy_kwh_offset": offset,
            }
        )

    @action(detail=True, methods=["post"], url_path="ack_energy_reset")
    def ack_energy_reset(self, request, pk=None):
        """
        Called by firmware after it has successfully reset the PZEM energy counter.
        Authenticated by X-Device-Key header (same as device_config).
        """
        client_key = (
            request.headers.get("X-Device-Key")
            or request.headers.get("X-Device-Token")
            or ""
        ).strip()
        if not client_key:
            return Response(
                {"detail": "Missing X-Device-Key header."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        transformer = get_object_or_404(Transformer.objects.all(), pk=pk)
        server_key = (transformer.device_api_key or "").strip()
        if not server_key or not secrets.compare_digest(client_key, server_key):
            return Response(
                {"detail": "Invalid device key."},
                status=status.HTTP_403_FORBIDDEN,
            )
        transformer.pending_energy_reset = False
        transformer.save(update_fields=["pending_energy_reset"])
        return Response({"ok": True})


class SmsRecipientViewSet(viewsets.ModelViewSet):
    queryset = SmsRecipient.objects.all().order_by("owner_name", "phone_number")
    serializer_class = SmsRecipientSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]


class ReadingViewSet(viewsets.ModelViewSet):
    queryset = Reading.objects.select_related("transformer").all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = ReadingFilter
    ordering_fields = ["timestamp", "voltage", "current", "oil_temp", "power_factor", "apparent_power"]
    ordering = ["-timestamp"]
    pagination_class = ReportsPagination

    def get_serializer_class(self):
        if self.action == "create":
            return ReadingCreateSerializer
        return ReadingSerializer

    def get_permissions(self):
        # ESP32 devices create readings without user authentication.
        if self.action == "create":
            return [AllowAny()]
        # Dashboard reads are authenticated.
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = ReadingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(
                "Reading create validation failed: %s | data=%s",
                serializer.errors,
                request.data,
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        transformer = serializer.validated_data.get("transformer")
        if transformer is not None and not transformer.is_active:
            return Response(
                {"detail": "Device is deactivated. Readings are disabled for this transformer."},
                status=status.HTTP_403_FORBIDDEN,
            )

        reading = serializer.save()

        # Update last_seen so the dashboard knows the device is alive.
        Transformer.objects.filter(pk=reading.transformer_id).update(
            last_seen=timezone.now()
        )

        if reading.condition != "normal":
            Alert.objects.create(
                transformer=reading.transformer,
                condition=reading.condition,
                message=f"Condition: {reading.condition}",
                sms_sent=request.data.get("sms_sent", False),
            )
        broadcast_reading(reading)
        return Response(
            ReadingSerializer(reading).data, status=status.HTTP_201_CREATED
        )

    def get_queryset(self):
        qs = super().get_queryset()
        since = self.request.query_params.get("since")
        if since:
            try:
                dt = timezone.datetime.fromisoformat(since.replace("Z", "+00:00"))
                qs = qs.filter(timestamp__gte=dt)
            except (ValueError, TypeError):
                pass
        return qs

    @action(detail=False, methods=["get"], url_path="export_csv")
    def export_csv(self, request):
        """Stream filtered readings as a CSV download."""
        qs = self.filter_queryset(self.get_queryset())[:CSV_EXPORT_MAX_ROWS]
        header = [
            "timestamp", "transformer", "voltage", "current",
            "apparent_power", "real_power", "power_factor",
            "frequency", "oil_temp", "energy_kwh", "condition",
        ]

        def row_fn(r):
            offset = r.transformer.energy_kwh_offset if r.transformer else 0
            energy = max((r.energy_kwh or 0) - (offset or 0), 0)
            return [
                r.timestamp.isoformat() if r.timestamp else "",
                r.transformer.name if r.transformer else "",
                r.voltage, r.current, r.apparent_power, r.real_power,
                r.power_factor, r.frequency, r.oil_temp,
                round(energy, 4), r.condition,
            ]

        response = StreamingHttpResponse(
            _stream_csv(qs, header, row_fn),
            content_type="text/csv",
        )
        response["Content-Disposition"] = 'attachment; filename="readings_export.csv"'
        return response


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.select_related("transformer").all()
    serializer_class = AlertSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AlertFilter
    ordering_fields = ["timestamp"]
    ordering = ["-timestamp"]
    pagination_class = ReportsPagination

    def get_permissions(self):
        # Dashboard alert viewing/ack requires authentication.
        return [IsAuthenticated()]

    @action(detail=True, methods=["patch"])
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        alert.acknowledged = True
        alert.save()
        return Response(AlertSerializer(alert).data)

    @action(detail=False, methods=["post"])
    def acknowledge_all(self, request):
        transformer_id = request.data.get("transformer") or request.query_params.get("transformer")
        if not transformer_id:
            return Response(
                {"error": "transformer id required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        count = Alert.objects.filter(
            transformer_id=transformer_id, acknowledged=False
        ).update(acknowledged=True)
        return Response({"acknowledged": count})

    @action(detail=False, methods=["get"], url_path="export_csv")
    def export_csv(self, request):
        """Stream filtered alerts as a CSV download."""
        qs = self.filter_queryset(self.get_queryset())[:CSV_EXPORT_MAX_ROWS]
        header = [
            "timestamp", "transformer", "condition",
            "message", "sms_sent", "acknowledged",
        ]

        def row_fn(a):
            return [
                a.timestamp.isoformat() if a.timestamp else "",
                a.transformer.name if a.transformer else "",
                a.condition, a.message, a.sms_sent, a.acknowledged,
            ]

        response = StreamingHttpResponse(
            _stream_csv(qs, header, row_fn),
            content_type="text/csv",
        )
        response["Content-Disposition"] = 'attachment; filename="alerts_export.csv"'
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
        )


class HealthView(APIView):
    """
    Lightweight endpoint to verify the backend is up.

    Useful for Heroku dyno health checks and for quickly validating that:
    - Django loads successfully
    - Database connection works
    - Redis is reachable (so Channels WebSockets work)
    """

    permission_classes = [AllowAny]

    def get(self, request):
        checks = {}
        overall_ok = True

        # DB connectivity check
        try:
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
            checks["database"] = {"ok": True}
        except Exception as e:
            overall_ok = False
            checks["database"] = {"ok": False, "error": str(e)}

        # Redis connectivity check
        try:
            import redis
            from django.conf import settings

            redis_url = (
                os.environ.get("REDIS_URL")
                or settings.CHANNEL_LAYERS.get("default", {}).get("CONFIG", {}).get("hosts", [None])[0]
            )
            if not redis_url:
                raise RuntimeError("REDIS_URL is not set")

            # When Heroku Redis requires TLS, its cert chain may not be trusted
            # by the dyno image. Option 1 disables certificate verification so
            # Channels + health checks can connect.
            if str(redis_url).startswith("rediss://"):
                r = redis.Redis.from_url(redis_url, ssl_cert_reqs=None)
            else:
                r = redis.Redis.from_url(redis_url)
            r.ping()
            checks["redis"] = {"ok": True}
        except Exception as e:
            overall_ok = False
            checks["redis"] = {"ok": False, "error": str(e)}

        http_status = status.HTTP_200_OK if overall_ok else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(
            {
                "status": "ok" if overall_ok else "degraded",
                "checks": checks,
                "timestamp": time.time(),
            },
            status=http_status,
        )
