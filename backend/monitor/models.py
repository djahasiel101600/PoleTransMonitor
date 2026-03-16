from django.db import models


class Transformer(models.Model):
    name = models.CharField(max_length=100)
    serial = models.CharField(max_length=50, unique=True, null=True, blank=True)
    nominal_voltage = models.FloatField(default=220)
    nominal_freq = models.FloatField(default=60)
    rated_kva = models.FloatField(default=15)
    rated_current = models.FloatField(default=68)
    site = models.CharField(max_length=200, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

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
