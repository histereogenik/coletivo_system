from django.contrib import admin

from apps.fiscal.models import FiscalDocument, FiscalWebhookEvent


@admin.register(FiscalDocument)
class FiscalDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "document_type",
        "environment",
        "status",
        "number",
        "series",
        "sale_date",
        "created_at",
    )
    list_filter = ("document_type", "environment", "status")
    search_fields = ("reference", "access_key", "number")
    readonly_fields = (
        "reference",
        "request_payload",
        "response_payload",
        "created_at",
        "updated_at",
    )


@admin.register(FiscalWebhookEvent)
class FiscalWebhookEventAdmin(admin.ModelAdmin):
    list_display = ("provider_event", "reference", "status", "document", "received_at")
    list_filter = ("status", "provider_event")
    search_fields = ("reference", "payload_hash")
    readonly_fields = ("payload_hash", "payload", "received_at", "processed_at")
