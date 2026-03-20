# Generated manually for: add `is_active` flag to Transformer
#
# This flag allows the frontend to deactivate a device so it stops sending readings.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitor", "0005_transformer_device_api_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="transformer",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
    ]

