from django.db import models


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
    address = models.TextField(blank=True)
    heard_about = models.TextField(
        blank=True, help_text="How the member heard about the community lunch."
    )
    role = models.CharField(max_length=20, choices=Role.choices, null=True, blank=True)
    diet = models.CharField(max_length=20, choices=Diet.choices)
    observations = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name
