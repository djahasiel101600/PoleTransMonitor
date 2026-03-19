# Generated migration for energy_kwh (kWh consumption from PZEM)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitor", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="reading",
            name="energy_kwh",
            field=models.FloatField(
                blank=True,
                null=True,
                help_text="Cumulative energy in kWh (from PZEM since last reset)",
            ),
        ),
    ]
