from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Criação"
        UPDATE = "UPDATE", "Alteração"
        DELETE = "DELETE", "Exclusão"
        SPECIAL = "SPECIAL", "Ação especial"

    class Source(models.TextChoices):
        UI = "UI", "Interface"
        WEBHOOK = "WEBHOOK", "Webhook"
        SYSTEM = "SYSTEM", "Sistema"
        COMMAND = "COMMAND", "Comando"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="audit_events",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.UI)
    entity_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100)
    object_repr = models.CharField(max_length=255, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    request_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["entity_type", "object_id"]),
            models.Index(fields=["actor", "created_at"]),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type}#{self.object_id}"
