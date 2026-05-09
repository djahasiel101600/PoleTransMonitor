from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.html import format_html
from import_export.admin import ExportActionMixin, ImportExportModelAdmin

from .models import (
    Alert,
    FirmwareRelease,
    Reading,
    SmsRecipient,
    SmsSettings,
    Transformer,
    UserProfile,
)
from .resources import AlertResource, ReadingResource, SmsRecipientResource, TransformerResource

# ---------------------------------------------------------------------------
# Condition colour map (matches frontend severity palette)
# ---------------------------------------------------------------------------

_CONDITION_COLORS = {
    "normal": ("#d1fae5", "#065f46"),           # green
    "heavy_load": ("#fef9c3", "#713f12"),        # yellow
    "heavy_peak_load": ("#fed7aa", "#7c2d12"),   # orange
    "poor_power_quality": ("#fde68a", "#78350f"),
    "abnormal": ("#fca5a5", "#7f1d1d"),          # red-light
    "danger_zone": ("#f87171", "#450a0a"),
    "overload": ("#ef4444", "#ffffff"),
    "severe_overload": ("#dc2626", "#ffffff"),
    "critical": ("#7f1d1d", "#ffffff"),          # deep red
}


def _colored_condition(condition: str) -> str:
    bg, fg = _CONDITION_COLORS.get(condition, ("#e5e7eb", "#111827"))
    return format_html(
        '<span style="background:{};color:{};padding:2px 8px;border-radius:4px;'
        'font-size:0.85em;font-weight:600;">{}</span>',
        bg, fg, condition.replace("_", " ").title(),
    )


# ---------------------------------------------------------------------------
# Custom SimpleListFilters
# ---------------------------------------------------------------------------

class TransformerOnlineFilter(admin.SimpleListFilter):
    title = "online status"
    parameter_name = "online"

    def lookups(self, request, model_admin):
        return [("1", "Online (last 5 min)"), ("0", "Offline")]

    def queryset(self, request, queryset):
        cutoff = timezone.now() - timezone.timedelta(minutes=5)
        if self.value() == "1":
            return queryset.filter(last_seen__gte=cutoff)
        if self.value() == "0":
            return queryset.filter(last_seen__lt=cutoff) | queryset.filter(last_seen__isnull=True)
        return queryset


class ConditionSeverityFilter(admin.SimpleListFilter):
    title = "severity bucket"
    parameter_name = "severity"

    _BUCKETS = {
        "normal": ["normal"],
        "warning": ["heavy_load", "heavy_peak_load", "poor_power_quality", "abnormal"],
        "critical": ["danger_zone", "overload", "severe_overload", "critical"],
    }

    def lookups(self, request, model_admin):
        return [("normal", "Normal"), ("warning", "Warning"), ("critical", "Critical")]

    def queryset(self, request, queryset):
        conditions = self._BUCKETS.get(self.value())
        if conditions:
            return queryset.filter(condition__in=conditions)
        return queryset


class ReadingDateRangeFilter(admin.SimpleListFilter):
    title = "date range"
    parameter_name = "date_range"

    def lookups(self, request, model_admin):
        return [
            ("today", "Today"),
            ("7d", "Last 7 days"),
            ("30d", "Last 30 days"),
        ]

    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == "today":
            return queryset.filter(timestamp__date=now.date())
        if self.value() == "7d":
            return queryset.filter(timestamp__gte=now - timezone.timedelta(days=7))
        if self.value() == "30d":
            return queryset.filter(timestamp__gte=now - timezone.timedelta(days=30))
        return queryset


class VoltageRangeFilter(admin.SimpleListFilter):
    """Classify readings as Low / Normal / High based on ±7% of 220 V nominal."""

    title = "voltage range"
    parameter_name = "voltage_range"
    _NOMINAL = 220.0
    _LOW = _NOMINAL * 0.93
    _HIGH = _NOMINAL * 1.07

    def lookups(self, request, model_admin):
        return [("low", "Low (<93% nominal)"), ("normal", "Normal (±7%)"), ("high", "High (>107% nominal)")]

    def queryset(self, request, queryset):
        if self.value() == "low":
            return queryset.filter(voltage__lt=self._LOW)
        if self.value() == "normal":
            return queryset.filter(voltage__gte=self._LOW, voltage__lte=self._HIGH)
        if self.value() == "high":
            return queryset.filter(voltage__gt=self._HIGH)
        return queryset


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------

class ReadingInline(admin.TabularInline):
    model = Reading
    extra = 0
    max_num = 5
    ordering = ["-timestamp"]
    can_delete = False
    fields = ["timestamp", "voltage", "current", "apparent_power", "real_power",
              "power_factor", "frequency", "oil_temp", "energy_kwh", "condition"]
    readonly_fields = ["timestamp", "voltage", "current", "apparent_power", "real_power",
                       "power_factor", "frequency", "oil_temp", "energy_kwh", "condition"]


# ---------------------------------------------------------------------------
# TransformerAdmin
# ---------------------------------------------------------------------------

@admin.register(Transformer)
class TransformerAdmin(ImportExportModelAdmin):
    resource_classes = [TransformerResource]

    list_display = [
        "name",
        "serial",
        "site",
        "is_active",
        "is_online",
        "rated_kva",
        "phone_number",
        "last_seen",
        "created_at",
    ]
    list_filter = ["is_active", TransformerOnlineFilter, "site"]
    search_fields = ["name", "serial", "site", "phone_number"]
    readonly_fields = ["device_api_key", "last_seen", "energy_kwh_offset", "created_at"]
    inlines = [ReadingInline]
    actions = ["bulk_activate_transformers", "bulk_deactivate_transformers"]

    @admin.display(boolean=True, description="Online")
    def is_online(self, obj):
        if not obj.last_seen:
            return False
        return (timezone.now() - obj.last_seen).total_seconds() < 300

    @admin.action(description="Activate selected transformers")
    def bulk_activate_transformers(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} transformer(s) activated.")

    @admin.action(description="Deactivate selected transformers")
    def bulk_deactivate_transformers(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} transformer(s) deactivated.")


# ---------------------------------------------------------------------------
# ReadingAdmin
# ---------------------------------------------------------------------------

@admin.register(Reading)
class ReadingAdmin(ImportExportModelAdmin):
    resource_classes = [ReadingResource]

    list_display = [
        "transformer",
        "timestamp",
        "voltage",
        "current",
        "apparent_power",
        "power_factor",
        "frequency",
        "loading_percent",
        "colored_condition",
    ]
    list_filter = [
        "transformer",
        ConditionSeverityFilter,
        ReadingDateRangeFilter,
        VoltageRangeFilter,
        "condition",
    ]
    search_fields = ["transformer__name", "transformer__serial"]
    date_hierarchy = "timestamp"
    list_per_page = 25
    list_max_show_all = 200
    show_full_result_count = False
    list_select_related = ("transformer",)

    readonly_fields = [
        "transformer", "timestamp", "voltage", "current", "apparent_power",
        "real_power", "power_factor", "frequency", "oil_temp", "energy_kwh", "condition",
    ]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("transformer")

    @admin.display(description="Load %")
    def loading_percent(self, obj):
        try:
            ap = obj.apparent_power
            rated_va = obj.transformer.rated_kva * 1000.0
            if ap is None or not rated_va:
                return "—"
            pct = ap / rated_va * 100.0
            return f"{pct:.1f}%"
        except Exception:
            return "—"

    @admin.display(description="Condition")
    def colored_condition(self, obj):
        return _colored_condition(obj.condition)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def delete_queryset(self, request, queryset):
        count = queryset.count()
        super().delete_queryset(request, queryset)
        self.message_user(request, f"{count} reading(s) permanently deleted.")


# ---------------------------------------------------------------------------
# AlertAdmin
# ---------------------------------------------------------------------------

@admin.register(Alert)
class AlertAdmin(ExportActionMixin, admin.ModelAdmin):
    resource_classes = [AlertResource]

    list_display = [
        "transformer",
        "timestamp",
        "colored_condition",
        "sms_sent",
        "acknowledged",
        "voltage",
        "current",
    ]
    list_filter = [
        "transformer",
        ConditionSeverityFilter,
        "condition",
        "acknowledged",
        "sms_sent",
    ]
    search_fields = ["transformer__name", "message"]
    date_hierarchy = "timestamp"
    list_per_page = 50
    show_full_result_count = False
    list_select_related = ("transformer",)

    actions = ["bulk_acknowledge_alerts", "bulk_mark_sms_sent"]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("transformer")

    @admin.display(description="Condition")
    def colored_condition(self, obj):
        return _colored_condition(obj.condition)

    @admin.action(description="Acknowledge selected alerts")
    def bulk_acknowledge_alerts(self, request, queryset):
        updated = queryset.update(acknowledged=True)
        self.message_user(request, f"{updated} alert(s) acknowledged.")

    @admin.action(description="Mark selected alerts as SMS sent")
    def bulk_mark_sms_sent(self, request, queryset):
        updated = queryset.update(sms_sent=True)
        self.message_user(request, f"{updated} alert(s) marked as SMS sent.")


# ---------------------------------------------------------------------------
# SmsRecipientAdmin
# ---------------------------------------------------------------------------

@admin.register(SmsRecipient)
class SmsRecipientAdmin(ImportExportModelAdmin):
    resource_classes = [SmsRecipientResource]
    list_display = ["owner_name", "phone_number", "created_at"]
    search_fields = ["owner_name", "phone_number"]


# ---------------------------------------------------------------------------
# FirmwareReleaseAdmin
# ---------------------------------------------------------------------------

@admin.register(FirmwareRelease)
class FirmwareReleaseAdmin(admin.ModelAdmin):
    list_display = ["version", "is_active", "uploaded_at"]
    list_filter = ["is_active"]
    readonly_fields = ["uploaded_at"]


# ---------------------------------------------------------------------------
# SmsSettingsAdmin  (singleton — no add/delete)
# ---------------------------------------------------------------------------

@admin.register(SmsSettings)
class SmsSettingsAdmin(admin.ModelAdmin):
    list_display = ["id", "alert_template", "status_template"]

    def has_add_permission(self, request):
        return not SmsSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# UserAdmin with profile inline
# ---------------------------------------------------------------------------

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name = "Profile"
    extra = 0


class UserWithProfileAdmin(UserAdmin):
    inlines = [UserProfileInline]


admin.site.unregister(User)
admin.site.register(User, UserWithProfileAdmin)
