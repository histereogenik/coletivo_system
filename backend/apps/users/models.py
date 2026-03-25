from django.core.validators import MaxLengthValidator
from django.db import models

from apps.common.text_limits import MAX_TEXT_LENGTH


class Member(models.Model):
    class Role(models.TextChoices):
        SUSTENTADOR = "SUSTENTADOR", "Sustentador"
        MENSALISTA = "MENSALISTA", "Mensalista"
        AVULSO = "AVULSO", "Avulso"

    class Diet(models.TextChoices):
        VEGANO = "VEGANO", "Vegano"
        VEGETARIANO = "VEGETARIANO", "Vegetariano"
        CARNIVORO = "CARNIVORO", "Carnivoro"

    full_name = models.CharField(max_length=150)
    is_child = models.BooleanField(default=False)
    responsible = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="children",
    )
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    address = models.TextField(blank=True, validators=[MaxLengthValidator(MAX_TEXT_LENGTH)])
    heard_about = models.TextField(
        blank=True,
        help_text="How the member heard about the community lunch.",
        validators=[MaxLengthValidator(MAX_TEXT_LENGTH)],
    )
    role = models.CharField(max_length=20, choices=Role.choices, null=True, blank=True)
    diet = models.CharField(max_length=20, choices=Diet.choices)
    observations = models.TextField(blank=True, validators=[MaxLengthValidator(MAX_TEXT_LENGTH)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class PublicRegistration(models.Model):
    class Status(models.TextChoices):
        PENDENTE = "PENDENTE", "Pendente"
        APROVADO = "APROVADO", "Aprovado"
        REJEITADO = "REJEITADO", "Rejeitado"

    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, validators=[MaxLengthValidator(MAX_TEXT_LENGTH)])
    heard_about = models.TextField(
        blank=True,
        help_text="How the member heard about the community lunch.",
        validators=[MaxLengthValidator(MAX_TEXT_LENGTH)],
    )
    role = models.CharField(max_length=20, choices=Member.Role.choices)
    diet = models.CharField(max_length=20, choices=Member.Diet.choices)
    observations = models.TextField(blank=True, validators=[MaxLengthValidator(MAX_TEXT_LENGTH)])
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDENTE)
    review_notes = models.TextField(blank=True, validators=[MaxLengthValidator(MAX_TEXT_LENGTH)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.full_name} ({self.get_status_display()})"


class PublicRegistrationChild(models.Model):
    registration = models.ForeignKey(
        PublicRegistration,
        on_delete=models.CASCADE,
        related_name="children",
    )
    full_name = models.CharField(max_length=150)
    diet = models.CharField(max_length=20, choices=Member.Diet.choices)
    observations = models.TextField(blank=True, validators=[MaxLengthValidator(MAX_TEXT_LENGTH)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.full_name
