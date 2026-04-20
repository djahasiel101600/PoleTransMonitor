from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import Transformer, Reading, Alert, SmsRecipient, UserProfile


@admin.register(Transformer)
class TransformerAdmin(admin.ModelAdmin):
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
class ReadingAdmin(admin.ModelAdmin):
    list_display = ["transformer", "timestamp", "voltage", "current", "condition"]
    list_filter = ["transformer", "condition"]


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ["transformer", "timestamp", "condition", "sms_sent", "acknowledged"]
    list_filter = ["transformer", "condition", "acknowledged"]


@admin.register(SmsRecipient)
class SmsRecipientAdmin(admin.ModelAdmin):
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
