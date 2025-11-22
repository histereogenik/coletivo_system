from django.contrib import admin

from apps.users.models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "phone", "role", "diet", "created_at")
    search_fields = ("full_name", "email", "phone")
    list_filter = ("role", "diet")
    ordering = ("full_name",)
