from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add pending_reboot flag to Transformer.

    When set to True by an admin (via POST /api/transformers/{id}/reboot/),
    the firmware picks it up on the next device_config sync, calls ack_reboot
    to clear the flag, then calls ESP.restart().
    """

    dependencies = [
        ("monitor", "0015_reading_timestamp_editable"),
    ]

    operations = [
        migrations.AddField(
            model_name="transformer",
            name="pending_reboot",
            field=models.BooleanField(default=False),
        ),
    ]
