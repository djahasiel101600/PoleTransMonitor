import secrets

from django.db import migrations, models


def assign_device_api_keys(apps, schema_editor):
    Transformer = apps.get_model("monitor", "Transformer")
    for row in Transformer.objects.filter(device_api_key=""):
        Transformer.objects.filter(pk=row.pk).update(
            device_api_key=secrets.token_urlsafe(24)
        )


class Migration(migrations.Migration):

    dependencies = [
        ("monitor", "0004_transformer_phone_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="transformer",
            name="device_api_key",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.RunPython(assign_device_api_keys, migrations.RunPython.noop),
    ]
