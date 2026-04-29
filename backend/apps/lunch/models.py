from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.users.models import Member


class Package(models.Model):
    class PaymentStatus(models.TextChoices):
        PAGO = "PAGO", "Pago"
        EM_ABERTO = "EM_ABERTO", "Em aberto"

    class PaymentMode(models.TextChoices):
        PIX = "PIX", "Pix"
        CARTAO = "CARTAO", "Cartão"
        DINHEIRO = "DINHEIRO", "Dinheiro"
        TROCA = "TROCA", "Troca"

    class PackageStatus(models.TextChoices):
        EXPIRADO = "EXPIRADO", "Expirado"
        VALIDO = "VALIDO", "Válido"

    member = models.ForeignKey(Member, related_name="packages", on_delete=models.CASCADE)
    unit_value_cents = models.PositiveIntegerField(help_text="Valor unitário em centavos.")
    value_cents = models.PositiveIntegerField(help_text="Valor em centavos.")
    date = models.DateField(help_text="Data de compra do pacote.")
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices)
    payment_mode = models.CharField(
        max_length=10,
        choices=PaymentMode.choices,
        default=PaymentMode.PIX,
    )
    quantity = models.PositiveIntegerField()
    remaining_quantity = models.PositiveIntegerField()
    expiration = models.DateField()
    status = models.CharField(max_length=10, choices=PackageStatus.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def clean(self):
        missing = {}
        if not self.quantity:
            missing["quantity"] = "Quantidade é obrigatória para pacote."
        if not self.expiration:
            missing["expiration"] = "Validade do pacote é obrigatória."
        if self.remaining_quantity is None:
            self.remaining_quantity = self.quantity
        if (
            self.remaining_quantity is not None
            and self.quantity is not None
            and self.remaining_quantity > self.quantity
        ):
            missing["remaining_quantity"] = (
                "Saldo de refeições não pode exceder a quantidade do pacote."
            )
        if self.expiration:
            today = timezone.localdate()
            self.status = (
                self.PackageStatus.EXPIRADO
                if self.expiration < today
                else self.PackageStatus.VALIDO
            )
        if missing:
            raise ValidationError(missing)

    def save(self, *args, **kwargs):
        if self.unit_value_cents in (None, 0) and self.value_cents and self.quantity:
            self.unit_value_cents = self.value_cents // self.quantity
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.member.full_name} - Pacote - {self.date}"


class Lunch(models.Model):
    class PaymentStatus(models.TextChoices):
        PAGO = "PAGO", "Pago"
        EM_ABERTO = "EM_ABERTO", "Em aberto"

    class PaymentMode(models.TextChoices):
        PIX = "PIX", "Pix"
        CARTAO = "CARTAO", "Cartão"
        DINHEIRO = "DINHEIRO", "Dinheiro"
        TROCA = "TROCA", "Troca"

    member = models.ForeignKey(Member, related_name="lunches", on_delete=models.CASCADE)
    credit_owner = models.ForeignKey(
        Member,
        related_name="credit_paid_lunches",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    package = models.ForeignKey(
        Package,
        related_name="lunches",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    value_cents = models.PositiveIntegerField(help_text="Valor em centavos.")
    date = models.DateField()
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices)
    payment_mode = models.CharField(
        max_length=10,
        choices=PaymentMode.choices,
        default=PaymentMode.PIX,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.member.full_name} - Almoço - {self.date}"


class PackageEntry(models.Model):
    class EntryType(models.TextChoices):
        CREDITO = "CREDITO", "Crédito"
        DEBITO = "DEBITO", "Débito"

    class Origin(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        LUNCH = "LUNCH", "Almoço"

    package = models.ForeignKey(Package, related_name="entries", on_delete=models.CASCADE)
    entry_type = models.CharField(max_length=10, choices=EntryType.choices)
    origin = models.CharField(max_length=10, choices=Origin.choices)
    quantity = models.PositiveIntegerField()
    description = models.TextField()
    lunch = models.OneToOneField(
        Lunch,
        related_name="package_entry",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_package_entries",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def clean(self):
        errors = {}
        if self.quantity <= 0:
            errors["quantity"] = "Quantidade deve ser maior que zero."
        if not self.description.strip():
            errors["description"] = "Descrição é obrigatória."
        if self.origin == self.Origin.LUNCH and not self.lunch_id:
            errors["lunch"] = "Lançamentos de almoço exigem um almoço vinculado."
        if self.origin == self.Origin.MANUAL and self.lunch_id:
            errors["lunch"] = "Lançamentos manuais não devem vincular almoço."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_entry_type_display()} - {self.package_id} - {self.quantity}"
