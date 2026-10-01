from django.conf import settings
from django.db import models

from apps.users.models import Member


class Duty(models.Model):
    name = models.CharField(max_length=120)
    remuneration_cents = models.PositiveIntegerField(
        default=0, help_text="Valor em centavos. Pode ser zero."
    )
    members = models.ManyToManyField(Member, related_name="duties", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_duties",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="updated_duties",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
