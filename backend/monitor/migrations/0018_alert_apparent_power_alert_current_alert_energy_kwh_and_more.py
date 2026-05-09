# Rewritten to be idempotent.
#
# The live PostgreSQL database already has alert_xfmr_ts_desc_idx (and
# possibly the electrical-snapshot columns) from a previous ephemeral deploy
# that ran makemigrations on the server.  Standard AddField / AddIndex
# operations would raise DuplicateTable / duplicate column errors on that DB
# while still being needed for any fresh database.
#
# Solution: SeparateDatabaseAndState
#   - state_operations  → update Django's migration state (ORM awareness)
#   - database_operations → idempotent SQL using IF NOT EXISTS so the
#     migration succeeds whether or not the schema already exists.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('monitor', '0017_reading_readingbuffer_indexes'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # ----------------------------------------------------------------
            # State operations: keep Django's internal schema state in sync.
            # These never touch the real database.
            # ----------------------------------------------------------------
            state_operations=[
                migrations.AddField(
                    model_name='alert',
                    name='apparent_power',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='alert',
                    name='current',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='alert',
                    name='energy_kwh',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='alert',
                    name='frequency',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='alert',
                    name='oil_temp',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='alert',
                    name='power_factor',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='alert',
                    name='real_power',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='alert',
                    name='voltage',
                    field=models.FloatField(blank=True, null=True),
                ),
                migrations.AddIndex(
                    model_name='alert',
                    index=models.Index(
                        fields=['transformer', '-timestamp'],
                        name='alert_xfmr_ts_desc_idx',
                    ),
                ),
            ],
            # ----------------------------------------------------------------
            # Database operations: idempotent SQL — safe on both a live DB
            # that already has these objects and a brand-new empty database.
            # ----------------------------------------------------------------
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS apparent_power DOUBLE PRECISION;
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS current        DOUBLE PRECISION;
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS energy_kwh     DOUBLE PRECISION;
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS frequency      DOUBLE PRECISION;
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS oil_temp       DOUBLE PRECISION;
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS power_factor   DOUBLE PRECISION;
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS real_power     DOUBLE PRECISION;
                        ALTER TABLE monitor_alert ADD COLUMN IF NOT EXISTS voltage        DOUBLE PRECISION;
                        CREATE INDEX IF NOT EXISTS alert_xfmr_ts_desc_idx
                            ON monitor_alert (transformer_id ASC, timestamp DESC);
                    """,
                    reverse_sql="""
                        DROP INDEX IF EXISTS alert_xfmr_ts_desc_idx;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS apparent_power;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS current;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS energy_kwh;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS frequency;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS oil_temp;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS power_factor;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS real_power;
                        ALTER TABLE monitor_alert DROP COLUMN IF EXISTS voltage;
                    """,
                ),
            ],
        ),
    ]
