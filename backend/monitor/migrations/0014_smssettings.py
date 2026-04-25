from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitor", "0013_firmwarerelease_and_pending_portal"),
    ]

    operations = [
        migrations.CreateModel(
            name="SmsSettings",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "alert_template",
                    models.CharField(
                        blank=True,
                        default="",
                        max_length=220,
                        help_text=(
                            "SMS body for fault alerts. Leave blank to use the firmware default. "
                            "Available tokens: {transformer}, {voltage}, {current}, "
                            "{apparent_power}, {real_power}, {power_factor}, {frequency}, "
                            "{energy_kwh}, {oil_temp}, {condition}."
                        ),
                    ),
                ),
                (
                    "status_template",
                    models.CharField(
                        blank=True,
                        default="",
                        max_length=220,
                        help_text=(
                            "SMS body for status-reply responses. Leave blank to use the firmware default. "
                            "Available tokens: {transformer}, {voltage}, {current}, "
                            "{apparent_power}, {real_power}, {power_factor}, {frequency}, "
                            "{energy_kwh}, {oil_temp}, {condition}."
                        ),
                    ),
                ),
            ],
            options={
                "verbose_name": "SMS Settings",
                "verbose_name_plural": "SMS Settings",
            },
        ),
    ]
