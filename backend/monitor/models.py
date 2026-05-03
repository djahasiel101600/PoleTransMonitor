import secrets

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


class SmsRecipient(models.Model):
    """
    Reusable SMS recipient contact.

    Uniqueness is enforced by `phone_number` so the same number can be reused
    across multiple transformers.
    """

    owner_name = models.CharField(max_length=120)
    phone_number = models.CharField(max_length=32, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["owner_name", "phone_number"]

    def __str__(self) -> str:
        return f"{self.owner_name} ({self.phone_number})"


class Transformer(models.Model):
    name = models.CharField(max_length=100)
    serial = models.CharField(max_length=50, unique=True, null=True, blank=True)
    nominal_voltage = models.FloatField(default=220)
    nominal_freq = models.FloatField(default=60)
    rated_kva = models.FloatField(default=15)
    rated_current = models.FloatField(default=68)
    site = models.CharField(max_length=200, null=True, blank=True)
    # Energy reset baseline used by the dashboard.
    # When staff “reset” a transformer, the backend subtracts this offset from
    # stored cumulative `energy_kwh` so the UI starts near 0 after replacement.
    energy_kwh_offset = models.FloatField(default=0.0)
    # When True, the firmware should reset the PZEM hardware energy counter
    # on next config sync and then acknowledge back to the backend.
    pending_energy_reset = models.BooleanField(default=False)
    phone_number = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        help_text="SIM / modem phone number for SMS or identification (e.g. +639171234567)",
    )
    # Phone numbers to receive SMS alerts for this transformer.
    # Contacts are reusable across transformers; uniqueness is enforced on
    # SmsRecipient.phone_number.
    sms_recipients = models.ManyToManyField(
        "SmsRecipient", related_name="transformers", blank=True
    )
    # When deactivated, the device should stop sending readings to the backend.
    # Server-side enforcement is done in the readings ingest endpoint.
    is_active = models.BooleanField(default=True)
    # Per-transformer secret for ESP32 to fetch device_config (header X-Device-Key). Auto-generated if empty.
    device_api_key = models.CharField(max_length=64, blank=True, default="")
    # Automatically updated every time the device POSTs a reading.
    last_seen = models.DateTimeField(null=True, blank=True)
    # 0 means every reading is saved; values > 0 enable interval aggregation.
    reading_interval_minutes = models.PositiveIntegerField(default=0)
    # When set, the device should open its WiFiManager config portal on the next
    # device_config sync, then acknowledge back to clear this flag.
    pending_open_portal = models.BooleanField(default=False)
    # When set, the device should call ESP.restart() on the next device_config
    # sync, after acknowledging the flag back to the backend.
    pending_reboot = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.device_api_key:
            self.device_api_key = secrets.token_urlsafe(24)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


CONDITION_CHOICES = [
    ("normal", "Normal"),
    ("heavy_peak_load", "Heavy Peak Load"),
    ("danger_zone", "Danger Zone"),
    ("overload", "Overload"),
    ("severe_overload", "Severe Overload"),
    ("heavy_load", "Heavy Load"),
    ("abnormal", "Abnormal"),
    ("poor_power_quality", "Poor Power Quality"),
    ("critical", "Critical"),
]


def _firmware_upload_path(instance, filename):
    """Store firmware binaries under firmware/<uuid>/<filename> to avoid enumeration."""
    import uuid
    return f"firmware/{uuid.uuid4().hex}/{filename}"


class FirmwareRelease(models.Model):
    version = models.CharField(max_length=32, unique=True)
    bin_file = models.FileField(upload_to=_firmware_upload_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ["-uploaded_at"]

    def save(self, *args, **kwargs):
        if self.is_active:
            # Only one release may be active at a time.
            FirmwareRelease.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        active = " [active]" if self.is_active else ""
        return f"{self.version}{active}"


class Reading(models.Model):
    transformer = models.ForeignKey(
        Transformer, on_delete=models.CASCADE, related_name="readings"
    )
    # default=timezone.now (not auto_now_add) so replayed offline readings
    # can supply their own past timestamp via the ingest API.
    timestamp = models.DateTimeField(default=timezone.now)
    voltage = models.FloatField(null=True, blank=True)
    current = models.FloatField(null=True, blank=True)
    apparent_power = models.FloatField(null=True, blank=True)
    real_power = models.FloatField(
        null=True,
        blank=True,
        help_text="Real power in watts (live wattage from PZEM)",
    )
    power_factor = models.FloatField(null=True, blank=True)
    frequency = models.FloatField(null=True, blank=True)
    oil_temp = models.FloatField(null=True, blank=True)
    energy_kwh = models.FloatField(
        null=True,
        blank=True,
        help_text="Cumulative energy in kWh (from PZEM since last reset)",
    )
    condition = models.CharField(
        max_length=30, choices=CONDITION_CHOICES, default="normal"
    )

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            # Speeds up: _check_energy_rollback, insights 24h aggregate,
            # reports queryset, and any filter+order by transformer+timestamp.
            models.Index(
                fields=["transformer", "-timestamp"],
                name="reading_xfmr_ts_desc_idx",
            ),
            models.Index(
                fields=["transformer", "timestamp"],
                name="reading_xfmr_ts_asc_idx",
            ),
        ]

    def __str__(self):
        return f"{self.transformer.name} @ {self.timestamp}"


class ReadingBuffer(models.Model):
    """Temporary high-frequency readings used for interval aggregation."""

    transformer = models.ForeignKey(
        Transformer, on_delete=models.CASCADE, related_name="reading_buffer"
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    voltage = models.FloatField(null=True, blank=True)
    current = models.FloatField(null=True, blank=True)
    apparent_power = models.FloatField(null=True, blank=True)
    real_power = models.FloatField(null=True, blank=True)
    power_factor = models.FloatField(null=True, blank=True)
    frequency = models.FloatField(null=True, blank=True)
    oil_temp = models.FloatField(null=True, blank=True)
    energy_kwh = models.FloatField(null=True, blank=True)
    condition = models.CharField(
        max_length=30, choices=CONDITION_CHOICES, default="normal"
    )

    class Meta:
        ordering = ["timestamp"]
        indexes = [
            # Speeds up _ws_flush_buffer_if_due / _flush_buffer_if_due which
            # filter by transformer and order/compare by timestamp.
            models.Index(
                fields=["transformer", "timestamp"],
                name="buffer_xfmr_ts_idx",
            ),
        ]

    def __str__(self):
        return f"Buffered {self.transformer.name} @ {self.timestamp}"


class Alert(models.Model):
    transformer = models.ForeignKey(
        Transformer, on_delete=models.CASCADE, related_name="alerts"
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    condition = models.CharField(max_length=30, choices=CONDITION_CHOICES)
    message = models.TextField()
    sms_sent = models.BooleanField(default=False)
    acknowledged = models.BooleanField(default=False)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.transformer.name} - {self.condition} @ {self.timestamp}"


class SmsSettings(models.Model):
    """Global singleton holding the SMS templates for alert and status replies.

    When a template is blank the firmware falls back to its built-in hardcoded
    message, preserving full backward compatibility.

    Supported tokens (substituted by firmware): {transformer}, {voltage},
    {current}, {apparent_power}, {real_power}, {power_factor}, {frequency},
    {energy_kwh}, {oil_temp}, {condition}.
    """

    alert_template = models.CharField(
        max_length=220,
        blank=True,
        default="",
        help_text=(
            "SMS body for fault alerts. Leave blank to use the firmware default. "
            "Available tokens: {transformer}, {voltage}, {current}, {apparent_power}, "
            "{real_power}, {power_factor}, {frequency}, {energy_kwh}, {oil_temp}, {condition}."
        ),
    )
    status_template = models.CharField(
        max_length=220,
        blank=True,
        default="",
        help_text=(
            "SMS body for status-reply responses. Leave blank to use the firmware default. "
            "Available tokens: {transformer}, {voltage}, {current}, {apparent_power}, "
            "{real_power}, {power_factor}, {frequency}, {energy_kwh}, {oil_temp}, {condition}."
        ),
    )

    class Meta:
        verbose_name = "SMS Settings"
        verbose_name_plural = "SMS Settings"

    @classmethod
    def get_or_create_singleton(cls):
        cached = cache.get("sms_settings_singleton")
        if cached is None:
            cached, _ = cls.objects.get_or_create(pk=1)
            cache.set("sms_settings_singleton", cached, 60)
        return cached

    def __str__(self):
        return "SMS Settings"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    is_approved = models.BooleanField(default=False)

    def __str__(self):
        return f"Profile({self.user.username}, approved={self.is_approved})"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(
            user=instance,
            defaults={"is_approved": instance.is_superuser},
        )
    elif hasattr(instance, "profile"):
        # Keep profile approved in sync when is_superuser is toggled externally.
        if instance.is_superuser and not instance.profile.is_approved:
            instance.profile.is_approved = True
            instance.profile.save(update_fields=["is_approved"])
