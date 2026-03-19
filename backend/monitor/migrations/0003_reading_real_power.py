# Generated migration for real_power (live wattage from PZEM)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitor", "0002_reading_energy_kwh"),
    ]

    operations = [
        migrations.AddField(
            model_name="reading",
            name="real_power",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Real power in watts (live wattage from PZEM)",
            ),
        ),
    ]
