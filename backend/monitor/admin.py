from django.contrib import admin
from .models import Transformer, Reading, Alert


@admin.register(Transformer)
class TransformerAdmin(admin.ModelAdmin):
    list_display = ["name", "serial", "rated_kva", "site", "created_at"]


@admin.register(Reading)
class ReadingAdmin(admin.ModelAdmin):
    list_display = ["transformer", "timestamp", "voltage", "current", "condition"]
    list_filter = ["transformer", "condition"]


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ["transformer", "timestamp", "condition", "sms_sent", "acknowledged"]
    list_filter = ["transformer", "condition", "acknowledged"]
