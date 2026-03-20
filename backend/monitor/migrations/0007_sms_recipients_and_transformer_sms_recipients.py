# Add reusable SMS recipients and per-transformer selection.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monitor", "0006_transformer_is_active"),
    ]

    operations = [
        migrations.CreateModel(
            name="SmsRecipient",
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
                ("owner_name", models.CharField(max_length=120)),
                ("phone_number", models.CharField(max_length=32, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["owner_name", "phone_number"],
            },
        ),
        migrations.AddField(
            model_name="transformer",
            name="sms_recipients",
            field=models.ManyToManyField(
                blank=True,
                related_name="transformers",
                to="monitor.smsrecipient",
            ),
        ),
    ]

