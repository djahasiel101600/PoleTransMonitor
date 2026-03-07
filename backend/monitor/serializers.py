from rest_framework import serializers
from .models import Transformer, Reading, Alert


class TransformerSerializer(serializers.ModelSerializer):
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
            "created_at",
        ]


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
            "power_factor",
            "frequency",
            "oil_temp",
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
            "power_factor",
            "frequency",
            "oil_temp",
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
