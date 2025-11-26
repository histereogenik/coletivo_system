from django.core.exceptions import ValidationError
from django.db import models

from apps.duties.models import Duty
from apps.users.models import Member


class AgendaEntry(models.Model):
    class Status(models.TextChoices):
        PLANEJADO = "PLANEJADO", "Planejado"
        CONCLUIDO = "CONCLUIDO", "Concluído"
        CANCELADO = "CANCELADO", "Cancelado"

    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    duty = models.ForeignKey(Duty, related_name="agenda_entries", on_delete=models.CASCADE)
    members = models.ManyToManyField(Member, related_name="agenda_entries", blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANEJADO)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "start_time", "duty__name"]

    def clean(self):
        if self.end_time and self.end_time <= self.start_time:
            raise ValidationError({"end_time": "Horário de término deve ser após o início."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.date} {self.start_time} - {self.duty.name}"
