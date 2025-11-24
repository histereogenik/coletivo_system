from django.core.exceptions import ValidationError
from django.db import models

from apps.users.models import Member


class Lunch(models.Model):
    class LunchType(models.TextChoices):
        AVULSO = "AVULSO", "Avulso"
        PACOTE = "PACOTE", "Pacote"

    class PaymentStatus(models.TextChoices):
        PAGO = "PAGO", "Pago"
        EM_ABERTO = "EM_ABERTO", "Em aberto"

    class PackageStatus(models.TextChoices):
        EXPIRADO = "EXPIRADO", "Expirado"
        VALIDO = "VALIDO", "Válido"

    member = models.ForeignKey(Member, related_name="lunches", on_delete=models.CASCADE)
    value_cents = models.PositiveIntegerField(help_text="Valor em centavos.")
    date = models.DateField()
    lunch_type = models.CharField(max_length=10, choices=LunchType.choices)
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices)
    quantity = models.PositiveIntegerField(null=True, blank=True)
    remaining_quantity = models.PositiveIntegerField(null=True, blank=True)
    package_expiration = models.DateField(null=True, blank=True)
    package_status = models.CharField(max_length=10, choices=PackageStatus.choices, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def clean(self):
        if self.lunch_type == self.LunchType.PACOTE:
            missing = {}
            if not self.quantity:
                missing["quantity"] = "Quantidade é obrigatória para pacote."
            if not self.package_expiration:
                missing["package_expiration"] = "Validade do pacote é obrigatória."
            if not self.package_status:
                missing["package_status"] = "Status do pacote é obrigatório."
            if self.remaining_quantity is None:
                self.remaining_quantity = self.quantity
            if self.remaining_quantity is not None and self.quantity is not None and self.remaining_quantity > self.quantity:
                missing["remaining_quantity"] = "Saldo de refeições não pode exceder a quantidade do pacote."
            if missing:
                raise ValidationError(missing)
        else:
            self.quantity = None
            self.remaining_quantity = None
            self.package_expiration = None
            self.package_status = None

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.member.full_name} - {self.get_lunch_type_display()} - {self.date}"
