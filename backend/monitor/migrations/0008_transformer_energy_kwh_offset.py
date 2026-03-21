# Generated manually to add `Transformer.energy_kwh_offset` for dashboard resets.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitor", "0007_sms_recipients_and_transformer_sms_recipients"),
    ]

    operations = [
        migrations.AddField(
            model_name="transformer",
            name="energy_kwh_offset",
            field=models.FloatField(default=0.0),
        ),
    ]

