from django.contrib import admin

from apps.lunch.models import Lunch, Package


@admin.register(Lunch)
class LunchAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "date",
        "package",
        "payment_status",
        "value_cents",
    )
    list_filter = ("payment_status", "date")
    search_fields = ("member__full_name", "member__email")
    ordering = ("-date",)


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "date",
        "payment_status",
        "value_cents",
        "quantity",
        "remaining_quantity",
        "status",
        "expiration",
    )
    list_filter = ("status", "payment_status", "expiration")
    search_fields = ("member__full_name", "member__email")
    ordering = ("-date",)
