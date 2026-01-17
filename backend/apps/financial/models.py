from django.core.exceptions import ValidationError
from django.db import models


class FinancialEntry(models.Model):
    class EntryType(models.TextChoices):
        ENTRADA = "ENTRADA", "Entrada"
        SAIDA = "SAIDA", "Saída"

    class EntryCategory(models.TextChoices):
        # Entradas
        ALMOCO = "ALMOCO", "Pagamento de almoço"
        DOACAO = "DOACAO", "Doação"
        # Saídas
        NOTA = "NOTA", "Compra / Nota fiscal"
        STAFF = "STAFF", "Pagamento de equipe"
        DESPESA = "DESPESA", "Despesa"
        ESTORNO = "ESTORNO", "Estorno"

    entry_type = models.CharField(max_length=10, choices=EntryType.choices)
    category = models.CharField(max_length=20, choices=EntryCategory.choices)
    description = models.TextField()
    value_cents = models.PositiveIntegerField()
    date = models.DateField()
    lunch = models.OneToOneField(
        "lunch.Lunch",
        related_name="financial_entry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    package = models.OneToOneField(
        "lunch.Package",
        related_name="financial_entry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def clean(self):
        entrada_cats = {self.EntryCategory.ALMOCO, self.EntryCategory.DOACAO}
        saida_cats = {
            self.EntryCategory.NOTA,
            self.EntryCategory.STAFF,
            self.EntryCategory.DESPESA,
            self.EntryCategory.ESTORNO,
        }

        if self.entry_type == self.EntryType.ENTRADA and self.category not in entrada_cats:
            raise ValidationError({"category": "Categoria incompatível com entrada."})
        if self.entry_type == self.EntryType.SAIDA and self.category not in saida_cats:
            raise ValidationError({"category": "Categoria incompatível com saída."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.get_entry_type_display()} - {self.get_category_display()} - {self.value_cents}c"
        )
