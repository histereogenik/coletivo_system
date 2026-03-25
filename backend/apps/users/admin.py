from django.contrib import admin

from apps.users.models import Member, PublicRegistration, PublicRegistrationChild


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "phone", "role", "diet", "created_at")
    search_fields = ("full_name", "email", "phone")
    list_filter = ("role", "diet")
    ordering = ("full_name",)


class PublicRegistrationChildInline(admin.TabularInline):
    model = PublicRegistrationChild
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(PublicRegistration)
class PublicRegistrationAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "phone", "status", "role", "diet", "created_at")
    search_fields = ("full_name", "email", "phone")
    list_filter = ("status", "role", "diet")
    readonly_fields = ("created_at", "updated_at")
    inlines = [PublicRegistrationChildInline]
