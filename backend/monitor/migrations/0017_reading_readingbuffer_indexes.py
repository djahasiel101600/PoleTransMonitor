from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add composite indexes on Reading and ReadingBuffer to speed up:
      - _check_energy_rollback  (filter by transformer, order by -timestamp)
      - _flush_buffer_if_due    (filter by transformer, compare timestamp)
      - insights 24h aggregate  (filter by transformer + timestamp range)
      - reports queryset        (filter by transformer, order by ±timestamp)
    """

    dependencies = [
        ("monitor", "0016_transformer_pending_reboot"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="reading",
            index=models.Index(
                fields=["transformer", "-timestamp"],
                name="reading_transformer_ts_desc_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="reading",
            index=models.Index(
                fields=["transformer", "timestamp"],
                name="reading_transformer_ts_asc_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="readingbuffer",
            index=models.Index(
                fields=["transformer", "timestamp"],
                name="buffer_transformer_ts_idx",
            ),
        ),
    ]
