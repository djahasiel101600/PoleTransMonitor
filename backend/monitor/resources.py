import re
from datetime import datetime

from import_export import fields, resources
from import_export.widgets import DateTimeWidget, ForeignKeyWidget

from .models import Alert, Reading, SmsRecipient, Transformer


class FlexibleDateTimeWidget(DateTimeWidget):
    """
    DateTimeWidget that accepts ISO 8601 timestamps with or without timezone,
    including colon-separated UTC offsets produced by Django's serializers
    (e.g. 2026-04-21T10:01:49.532618+00:00).
    """

    _FORMATS = [
        "%Y-%m-%dT%H:%M:%S.%f%z",   # with microseconds + tz
        "%Y-%m-%dT%H:%M:%S%z",       # without microseconds + tz
        "%Y-%m-%dT%H:%M:%S.%f",      # with microseconds, naive
        "%Y-%m-%dT%H:%M:%S",         # basic ISO, naive
        "%Y-%m-%d %H:%M:%S.%f%z",   # space separator + tz
        "%Y-%m-%d %H:%M:%S",         # space separator, naive
    ]

    def _normalize(self, value: str) -> str:
        """Strip the colon from tz offsets and normalise 'Z' suffix."""
        value = value.strip()
        if value.endswith("Z"):
            value = value[:-1] + "+0000"
        # +00:00 -> +0000
        value = re.sub(r"([+-])(\d{2}):(\d{2})$", r"\1\2\3", value)
        return value

    def clean(self, value, row=None, **kwargs):
        if not value:
            return None
        normalized = self._normalize(str(value))
        for fmt in self._FORMATS:
            try:
                return datetime.strptime(normalized, fmt)
            except (ValueError, TypeError):
                continue
        raise ValueError(f"Cannot parse datetime value: {value!r}")


class SmsRecipientResource(resources.ModelResource):
    class Meta:
        model = SmsRecipient
        fields = ("id", "owner_name", "phone_number", "created_at")
        export_order = ("id", "owner_name", "phone_number", "created_at")
        import_id_fields = ("phone_number",)
        skip_unchanged = True
        report_skipped = True


class TransformerResource(resources.ModelResource):
    class Meta:
        model = Transformer
        fields = (
            "id",
            "name",
            "serial",
            "nominal_voltage",
            "nominal_freq",
            "rated_kva",
            "rated_current",
            "site",
            "phone_number",
            "is_active",
            "reading_interval_minutes",
        )
        export_order = (
            "id",
            "name",
            "serial",
            "nominal_voltage",
            "nominal_freq",
            "rated_kva",
            "rated_current",
            "site",
            "phone_number",
            "is_active",
            "reading_interval_minutes",
        )
        import_id_fields = ("serial",)
        skip_unchanged = True
        report_skipped = True


class ReadingResource(resources.ModelResource):
    # Declare transformer as a resolved-by-name FK field.
    transformer = fields.Field(
        column_name="transformer",
        attribute="transformer",
        widget=ForeignKeyWidget(Transformer, field="name"),
    )

    # Declare timestamp explicitly so it is writable on import,
    # bypassing the auto_now_add constraint.
    # Explicit formats are required because DateTimeWidget's defaults do not
    # cover ISO 8601 with colon-separated timezone offsets (e.g. +00:00).
    timestamp = fields.Field(
        column_name="timestamp",
        attribute="timestamp",
        widget=FlexibleDateTimeWidget(),
    )

    class Meta:
        model = Reading
        fields = (
            "id",
            "transformer",
            "timestamp",
            "voltage",
            "current",
            "apparent_power",
            "real_power",
            "power_factor",
            "frequency",
            "oil_temp",
            "energy_kwh",
            "condition",
        )
        export_order = (
            "id",
            "transformer",
            "timestamp",
            "voltage",
            "current",
            "apparent_power",
            "real_power",
            "power_factor",
            "frequency",
            "oil_temp",
            "energy_kwh",
            "condition",
        )
        import_id_fields = ("id",)
        skip_unchanged = True
        report_skipped = True

    def before_save_instance(self, instance, row, **kwargs):
        """
        Persist the timestamp parsed from the import row onto the instance.
        Because Reading.timestamp has auto_now_add=True, Django's ORM ignores
        the field on INSERT; we bypass this by using update_fields on save
        when the instance already has a pk, and for new rows we patch the
        field's auto_now_add flag temporarily.
        """
        raw_ts = self.fields["timestamp"].clean(row)
        if raw_ts:
            instance.timestamp = raw_ts

    def save_instance(self, instance, new, row, **kwargs):
        if new and instance.timestamp:
            # Temporarily disable auto_now_add so the supplied value is saved.
            ts_field = Reading._meta.get_field("timestamp")
            original = ts_field.auto_now_add
            ts_field.auto_now_add = False
            try:
                super().save_instance(instance, new, row, **kwargs)
            finally:
                ts_field.auto_now_add = original
        else:
            super().save_instance(instance, new, row, **kwargs)


class AlertResource(resources.ModelResource):
    transformer = fields.Field(
        column_name="transformer",
        attribute="transformer",
        widget=ForeignKeyWidget(Transformer, field="name"),
    )

    class Meta:
        model = Alert
        fields = (
            "id",
            "transformer",
            "timestamp",
            "condition",
            "message",
            "sms_sent",
            "acknowledged",
        )
        export_order = (
            "id",
            "transformer",
            "timestamp",
            "condition",
            "message",
            "sms_sent",
            "acknowledged",
        )
