from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Transformer, Reading, Alert, SmsRecipient, UserProfile, FirmwareRelease, SmsSettings


class TransformerSerializer(serializers.ModelSerializer):
    """Staff users see `device_api_key` (for ESP32 portal setup); others get null."""

    device_api_key = serializers.SerializerMethodField()
    sms_recipients = serializers.SerializerMethodField()
    # Write-only list of SmsRecipient ids for staff updates.
    sms_recipients_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )

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
            "is_active",
            "reading_interval_minutes",
            "sms_recipients",
            "sms_recipients_ids",
            "device_api_key",
            "last_seen",
            "pending_open_portal",
            "created_at",
        ]
        read_only_fields = ["created_at", "last_seen"]

    def get_device_api_key(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.is_staff:
            return obj.device_api_key
        return None

    def get_sms_recipients(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or not request.user.is_staff:
            return []
        return [
            {
                "id": r.id,
                "owner_name": r.owner_name,
                "phone_number": r.phone_number,
            }
            for r in obj.sms_recipients.all()
        ]

    def update(self, instance, validated_data):
        sms_recipient_ids = validated_data.pop("sms_recipients_ids", None)
        instance = super().update(instance, validated_data)

        if sms_recipient_ids is not None:
            unique_ids = sorted(set(sms_recipient_ids))
            recipients_qs = SmsRecipient.objects.filter(id__in=unique_ids)
            if recipients_qs.count() != len(unique_ids):
                raise serializers.ValidationError(
                    {"sms_recipients_ids": "One or more recipient ids are invalid."}
                )
            instance.sms_recipients.set(recipients_qs)

        return instance


class FirmwareReleaseSerializer(serializers.ModelSerializer):
    """Staff-only serializer for OTA firmware releases."""

    bin_file = serializers.FileField(use_url=True)

    class Meta:
        model = FirmwareRelease
        fields = ["id", "version", "bin_file", "uploaded_at", "is_active"]
        read_only_fields = ["id", "uploaded_at", "is_active"]


class SmsRecipientSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsRecipient
        fields = [
            "id",
            "owner_name",
            "phone_number",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_phone_number(self, value: str) -> str:
        # Normalize for stable uniqueness checks.
        v = value.strip().replace(" ", "").replace("-", "")
        if not v:
            raise serializers.ValidationError("Phone number is required.")
        if not v.startswith("+"):
            v = "+" + v

        # Option 2: reject duplicates; do not upsert.
        qs = SmsRecipient.objects.filter(phone_number=v)
        if self.instance is not None:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(
                "A contact with this phone number already exists. Please select the existing contact."
            )
        return v


class ReadingSerializer(serializers.ModelSerializer):
    # Dashboard "energy reset" is implemented as an offset in the backend.
    # The physical meter keeps its own cumulative kWh, so we return an adjusted
    # value to the dashboard: max(raw_energy_kwh - energy_kwh_offset, 0).
    energy_kwh = serializers.SerializerMethodField()

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

    def get_energy_kwh(self, obj):
        raw = obj.energy_kwh
        if raw is None:
            return None

        offset = 0.0
        try:
            offset = getattr(obj.transformer, "energy_kwh_offset", 0.0) or 0.0
        except Exception:
            offset = 0.0

        try:
            adjusted = float(raw) - float(offset)
        except (TypeError, ValueError):
            return None

        if adjusted < 0:
            adjusted = 0.0

        # Keep payload stable and small for websocket/API clients.
        return round(adjusted, 6)


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


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return data


class UserSerializer(serializers.ModelSerializer):
    is_approved = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "is_staff", "is_superuser", "is_approved", "date_joined"]
        read_only_fields = ["id", "is_staff", "is_superuser", "date_joined"]

    def get_is_approved(self, obj):
        try:
            return obj.profile.is_approved
        except UserProfile.DoesNotExist:
            return False


class SmsSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsSettings
        fields = ["alert_template", "status_template"]
