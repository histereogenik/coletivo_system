from django.contrib import admin

from apps.financial.models import FinancialEntry


@admin.register(FinancialEntry)
class FinancialEntryAdmin(admin.ModelAdmin):
    list_display = ("date", "entry_type", "category", "value_cents", "description")
    list_filter = ("entry_type", "category", "date")
    search_fields = ("description",)
    ordering = ("-date",)
