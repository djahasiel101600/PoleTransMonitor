import logging

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
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


class TransformerViewSet(viewsets.ModelViewSet):
    queryset = Transformer.objects.all()
    serializer_class = TransformerSerializer


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
        count, _ = Alert.objects.filter(
            transformer_id=transformer_id, acknowledged=False
        ).update(acknowledged=True)
        return Response({"acknowledged": count})
