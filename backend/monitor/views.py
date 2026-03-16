import logging

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Max, Min
from datetime import timedelta

from .models import Transformer, Reading, Alert

logger = logging.getLogger(__name__)
from .serializers import (
    TransformerSerializer,
    ReadingSerializer,
    ReadingCreateSerializer,
    AlertSerializer,
)
from .consumers import broadcast_reading


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


class ReadingViewSet(viewsets.ModelViewSet):
    queryset = Reading.objects.select_related("transformer").all()
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["transformer"]
    ordering_fields = ["timestamp"]
    ordering = ["-timestamp"]

    def get_serializer_class(self):
        if self.action == "create":
            return ReadingCreateSerializer
        return ReadingSerializer

    def create(self, request, *args, **kwargs):
        serializer = ReadingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(
                "Reading create validation failed: %s | data=%s",
                serializer.errors,
                request.data,
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        reading = serializer.save()
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


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.select_related("transformer").all()
    serializer_class = AlertSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["transformer"]

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
