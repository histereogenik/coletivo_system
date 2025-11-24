from django.contrib import admin

from apps.duties.models import Duty


@admin.register(Duty)
class DutyAdmin(admin.ModelAdmin):
    list_display = ("name", "remuneration_cents")
    search_fields = ("name",)
    filter_horizontal = ("members",)
