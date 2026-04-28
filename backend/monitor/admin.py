from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from import_export.admin import ExportActionMixin, ImportExportModelAdmin
from .models import FirmwareRelease

from .models import Alert, Reading, SmsRecipient, Transformer, UserProfile
from .resources import AlertResource, ReadingResource, SmsRecipientResource, TransformerResource

admin.site.register(FirmwareRelease)

@admin.register(Transformer)
class TransformerAdmin(ImportExportModelAdmin):
    resource_classes = [TransformerResource]
    list_display = [
        "name",
        "serial",
        "phone_number",
        "rated_kva",
        "site",
        "created_at",
    ]
    readonly_fields = ["device_api_key", "created_at"]


@admin.register(Reading)
class ReadingAdmin(ImportExportModelAdmin):
    resource_classes = [ReadingResource]
    list_display = ["transformer", "timestamp", "voltage", "current", "condition"]
    list_filter = ["transformer", "condition"]


@admin.register(Alert)
class AlertAdmin(ExportActionMixin, admin.ModelAdmin):
    resource_classes = [AlertResource]
    list_display = ["transformer", "timestamp", "condition", "sms_sent", "acknowledged"]
    list_filter = ["transformer", "condition", "acknowledged"]


@admin.register(SmsRecipient)
class SmsRecipientAdmin(ImportExportModelAdmin):
    resource_classes = [SmsRecipientResource]
    list_display = ["owner_name", "phone_number", "created_at"]
    search_fields = ["owner_name", "phone_number"]


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name = "Profile"
    extra = 0


class UserWithProfileAdmin(UserAdmin):
    inlines = [UserProfileInline]


admin.site.unregister(User)
admin.site.register(User, UserWithProfileAdmin)
