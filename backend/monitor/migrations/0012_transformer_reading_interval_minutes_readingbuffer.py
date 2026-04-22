from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("monitor", "0011_userprofile"),
    ]

    operations = [
        migrations.AddField(
            model_name="transformer",
            name="reading_interval_minutes",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name="ReadingBuffer",
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
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                ("voltage", models.FloatField(blank=True, null=True)),
                ("current", models.FloatField(blank=True, null=True)),
                ("apparent_power", models.FloatField(blank=True, null=True)),
                ("real_power", models.FloatField(blank=True, null=True)),
                ("power_factor", models.FloatField(blank=True, null=True)),
                ("frequency", models.FloatField(blank=True, null=True)),
                ("oil_temp", models.FloatField(blank=True, null=True)),
                ("energy_kwh", models.FloatField(blank=True, null=True)),
                (
                    "condition",
                    models.CharField(
                        choices=[
                            ("normal", "Normal"),
                            ("heavy_peak_load", "Heavy Peak Load"),
                            ("danger_zone", "Danger Zone"),
                            ("overload", "Overload"),
                            ("severe_overload", "Severe Overload"),
                            ("heavy_load", "Heavy Load"),
                            ("abnormal", "Abnormal"),
                            ("poor_power_quality", "Poor Power Quality"),
                            ("critical", "Critical"),
                        ],
                        default="normal",
                        max_length=30,
                    ),
                ),
                (
                    "transformer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reading_buffer",
                        to="monitor.transformer",
                    ),
                ),
            ],
            options={"ordering": ["timestamp"]},
        ),
    ]
