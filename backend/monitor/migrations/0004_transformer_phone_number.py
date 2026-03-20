# SIM / modem phone number on Transformer

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitor", "0003_reading_real_power"),
    ]

    operations = [
        migrations.AddField(
            model_name="transformer",
            name="phone_number",
            field=models.CharField(
                blank=True,
                help_text="SIM / modem phone number for SMS or identification (e.g. +639171234567)",
                max_length=32,
                null=True,
            ),
        ),
    ]
