import secrets

from django.db import models


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


class Reading(models.Model):
    transformer = models.ForeignKey(
        Transformer, on_delete=models.CASCADE, related_name="readings"
    )
    timestamp = models.DateTimeField(auto_now_add=True)
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

    def __str__(self):
        return f"{self.transformer.name} @ {self.timestamp}"


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
