from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("monitor", "0008_transformer_energy_kwh_offset"),
    ]

    operations = [
        migrations.AddField(
            model_name="transformer",
            name="last_seen",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
