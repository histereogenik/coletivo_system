from django.conf import settings
from django.db import models


class OperatorProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="operator_profile",
        on_delete=models.CASCADE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_operator_profiles",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    auth_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        permissions = [
            ("manage_lunches", "Pode gerenciar almoços"),
            ("manage_packages", "Pode gerenciar pacotes"),
            ("manage_financial", "Pode gerenciar o financeiro"),
            ("manage_fiscal", "Pode gerenciar notas fiscais"),
            ("manage_credits", "Pode gerenciar trocas e créditos"),
            ("manage_agenda", "Pode gerenciar a agenda"),
            ("manage_members", "Pode gerenciar integrantes e cadastros"),
            ("manage_duties", "Pode gerenciar funções"),
        ]

    def __str__(self):
        return self.user.get_username()
