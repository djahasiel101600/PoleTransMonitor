from rest_framework import serializers
from .models import Transformer, Reading, Alert


class TransformerSerializer(serializers.ModelSerializer):
    """Staff users see `device_api_key` (for ESP32 portal setup); others get null."""

    device_api_key = serializers.SerializerMethodField()

    class Meta:
        model = Transformer
        fields = [
            "id",
            "name",
            "serial",
            "nominal_voltage",
            "nominal_freq",
            "rated_kva",
            "rated_current",
            "site",
            "phone_number",
            "device_api_key",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_device_api_key(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.is_staff:
            return obj.device_api_key
        return None


class ReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reading
        fields = [
            "id",
            "transformer",
            "timestamp",
            "voltage",
            "current",
            "apparent_power",
            "real_power",
            "power_factor",
            "frequency",
            "oil_temp",
            "energy_kwh",
            "condition",
        ]


class ReadingCreateSerializer(serializers.ModelSerializer):
    transformer_id = serializers.PrimaryKeyRelatedField(
        queryset=Transformer.objects.all(), source="transformer"
    )

    class Meta:
        model = Reading
        fields = [
            "transformer_id",
            "voltage",
            "current",
            "apparent_power",
            "real_power",
            "power_factor",
            "frequency",
            "oil_temp",
            "energy_kwh",
            "condition",
        ]


class AlertSerializer(serializers.ModelSerializer):
    transformer_name = serializers.CharField(source="transformer.name", read_only=True)

    class Meta:
        model = Alert
        fields = [
            "id",
            "transformer",
            "transformer_name",
            "timestamp",
            "condition",
            "message",
            "sms_sent",
            "acknowledged",
        ]
