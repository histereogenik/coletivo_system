from django.core.exceptions import ValidationError
from django.db import models

from apps.users.models import Member


class Package(models.Model):
    class PaymentStatus(models.TextChoices):
        PAGO = "PAGO", "Pago"
        EM_ABERTO = "EM_ABERTO", "Em aberto"

    class PaymentMode(models.TextChoices):
        PIX = "PIX", "Pix"
        CARTAO = "CARTAO", "Cartão"
        DINHEIRO = "DINHEIRO", "Dinheiro"

    class PackageStatus(models.TextChoices):
        EXPIRADO = "EXPIRADO", "Expirado"
        VALIDO = "VALIDO", "Válido"

    member = models.ForeignKey(Member, related_name="packages", on_delete=models.CASCADE)
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
        if not self.status:
            missing["status"] = "Status do pacote é obrigatório."
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
        if missing:
            raise ValidationError(missing)

    def save(self, *args, **kwargs):
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

    member = models.ForeignKey(Member, related_name="lunches", on_delete=models.CASCADE)
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
