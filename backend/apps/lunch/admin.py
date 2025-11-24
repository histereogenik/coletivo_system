from django.contrib import admin

from apps.lunch.models import Lunch


@admin.register(Lunch)
class LunchAdmin(admin.ModelAdmin):
    list_display = ("member", "date", "lunch_type", "payment_status", "value_cents", "quantity", "package_status")
    list_filter = ("lunch_type", "payment_status", "package_status", "date")
    search_fields = ("member__full_name", "member__email")
    ordering = ("-date",)
