from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    """
    Change Reading.timestamp from auto_now_add=True to default=timezone.now so
    the field is writable.  This allows replayed offline readings (buffered on
    the ESP32 during a WiFi outage) to be stored with their original measurement
    timestamp rather than the replay arrival time.
    """

    dependencies = [
        ("monitor", "0014_smssettings"),
    ]

    operations = [
        migrations.AlterField(
            model_name="reading",
            name="timestamp",
            field=models.DateTimeField(default=timezone.now),
        ),
    ]
