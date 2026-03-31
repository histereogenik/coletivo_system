from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models
from django.db.models import Q

from apps.agenda.models import AgendaEntry
from apps.common.text_limits import MAX_TEXT_LENGTH
from apps.lunch.models import Lunch
from apps.users.models import Member


class CreditEntry(models.Model):
    class EntryType(models.TextChoices):
        CREDITO = "CREDITO", "Crédito"
        DEBITO = "DEBITO", "Débito"

    class Origin(models.TextChoices):
        AGENDA = "AGENDA", "Agenda"
        MANUAL = "MANUAL", "Manual"
        LUNCH = "LUNCH", "Almoço"
        ESTORNO = "ESTORNO", "Estorno"

    owner = models.ForeignKey(
        Member,
        related_name="credit_entries",
        on_delete=models.PROTECT,
    )
    beneficiary = models.ForeignKey(
        Member,
        related_name="credit_beneficiary_entries",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )
    entry_type = models.CharField(max_length=10, choices=EntryType.choices)
    origin = models.CharField(max_length=10, choices=Origin.choices)
    value_cents = models.PositiveIntegerField()
    description = models.TextField(
        blank=True,
        validators=[MaxLengthValidator(MAX_TEXT_LENGTH)],
    )
    agenda_entry = models.ForeignKey(
        AgendaEntry,
        related_name="credit_entries",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    lunch = models.OneToOneField(
        Lunch,
        related_name="credit_entry",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_credit_entries",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(value_cents__gt=0),
                name="credits_entry_value_cents_gt_zero",
            ),
            models.UniqueConstraint(
                fields=["agenda_entry", "owner", "origin", "entry_type"],
                condition=Q(
                    agenda_entry__isnull=False,
                    origin="AGENDA",
                    entry_type="CREDITO",
                ),
                name="credits_unique_agenda_credit_per_owner",
            ),
            models.UniqueConstraint(
                fields=["lunch", "origin", "entry_type"],
                condition=Q(
                    lunch__isnull=False,
                    origin="LUNCH",
                    entry_type="DEBITO",
                ),
                name="credits_unique_lunch_debit",
            ),
        ]

    def clean(self):
        errors = {}

        if self.value_cents <= 0:
            errors["value_cents"] = "Valor deve ser maior que zero."

        if self.origin == self.Origin.MANUAL and not self.description.strip():
            errors["description"] = "Descrição é obrigatória para lançamentos manuais."

        if self.origin == self.Origin.AGENDA and not self.agenda_entry_id:
            errors["agenda_entry"] = "Lançamentos de agenda exigem um registro de agenda."

        if self.origin == self.Origin.LUNCH and not self.lunch_id:
            errors["lunch"] = "Lançamentos de almoço exigem um almoço vinculado."

        if self.origin != self.Origin.AGENDA and self.agenda_entry_id:
            errors["agenda_entry"] = "Apenas lançamentos de agenda podem vincular agenda."

        if self.origin != self.Origin.LUNCH and self.lunch_id:
            errors["lunch"] = "Apenas lançamentos de almoço podem vincular almoço."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_entry_type_display()} - {self.owner.full_name} - " f"{self.value_cents}c"
