from django.contrib import admin

from apps.credits.models import CreditEntry


@admin.register(CreditEntry)
class CreditEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "beneficiary",
        "entry_type",
        "origin",
        "value_cents",
        "created_at",
    )
    list_filter = ("entry_type", "origin", "owner")
    search_fields = (
        "owner__full_name",
        "beneficiary__full_name",
        "description",
    )
    autocomplete_fields = (
        "owner",
        "beneficiary",
        "agenda_entry",
        "lunch",
        "created_by",
    )

