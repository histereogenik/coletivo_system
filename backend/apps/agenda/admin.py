from django.contrib import admin

from apps.agenda.models import AgendaEntry


@admin.register(AgendaEntry)
class AgendaEntryAdmin(admin.ModelAdmin):
    list_display = ("date", "start_time", "end_time", "duty", "status")
    list_filter = ("status", "date", "duty")
    search_fields = ("duty__name", "members__full_name")
    filter_horizontal = ("members",)
