import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class FiscalDocument(models.Model):
    class SourceType(models.TextChoices):
        LUNCH = "LUNCH", "Almoço avulso"
        PACKAGE = "PACKAGE", "Pacote"
        MANUAL = "MANUAL", "Lançamento manual"

    class DocumentType(models.TextChoices):
        NFE = "NFE", "NF-e"
        NFCE = "NFCE", "NFC-e"

    class Environment(models.TextChoices):
        HOMOLOGATION = "HOMOLOGATION", "Homologação"
        PRODUCTION = "PRODUCTION", "Produção"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        PROCESSING = "PROCESSING", "Processando"
        AUTHORIZED = "AUTHORIZED", "Autorizada"
        REJECTED = "REJECTED", "Rejeitada"
        CANCELLED = "CANCELLED", "Cancelada"

    reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    document_type = models.CharField(max_length=4, choices=DocumentType.choices)
    environment = models.CharField(max_length=20, choices=Environment.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    source_kind = models.CharField(max_length=10, choices=SourceType.choices)

    lunch = models.ForeignKey(
        "lunch.Lunch",
        related_name="fiscal_documents",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )
    package = models.ForeignKey(
        "lunch.Package",
        related_name="fiscal_documents",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )
    manual_description = models.CharField(max_length=120, blank=True)
    manual_value_cents = models.PositiveIntegerField(null=True, blank=True)
    manual_payment_method = models.CharField(max_length=2, blank=True)
    manual_request_key = models.UUIDField(null=True, blank=True, unique=True)

    sale_date = models.DateField()
    recipient = models.JSONField(default=dict)
    items = models.JSONField(default=list)
    payment_methods = models.JSONField(default=list)
    request_payload = models.JSONField(default=dict)
    response_payload = models.JSONField(default=dict)

    focus_status = models.CharField(max_length=80, blank=True)
    number = models.CharField(max_length=20, blank=True)
    series = models.CharField(max_length=20, blank=True)
    access_key = models.CharField(max_length=44, blank=True)
    protocol = models.CharField(max_length=30, blank=True)
    xml_url = models.URLField(max_length=500, blank=True)
    danfe_url = models.URLField(max_length=500, blank=True)
    sefaz_code = models.CharField(max_length=20, blank=True)
    error_message = models.TextField(blank=True)
    emitted_at = models.DateTimeField(null=True, blank=True)
    authorized_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_fiscal_documents",
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
                condition=(
                    (
                        models.Q(source_kind="LUNCH")
                        & models.Q(lunch__isnull=False)
                        & models.Q(package__isnull=True)
                        & models.Q(manual_value_cents__isnull=True)
                    )
                    | (
                        models.Q(source_kind="PACKAGE")
                        & models.Q(lunch__isnull=True)
                        & models.Q(package__isnull=False)
                        & models.Q(manual_value_cents__isnull=True)
                    )
                    | (
                        models.Q(source_kind="MANUAL")
                        & models.Q(lunch__isnull=True)
                        & models.Q(package__isnull=True)
                        & models.Q(manual_value_cents__gt=0)
                        & models.Q(manual_request_key__isnull=False)
                    )
                ),
                name="fiscal_document_has_valid_source",
            )
        ]

    @property
    def source_type(self):
        return self.source_kind

    @property
    def source_id(self):
        return self.lunch_id or self.package_id

    def clean(self):
        source_count = sum(
            (bool(self.lunch_id), bool(self.package_id), bool(self.manual_value_cents))
        )
        if source_count != 1:
            raise ValidationError("O documento fiscal deve possuir exatamente uma origem.")

    def __str__(self):
        return f"{self.get_document_type_display()} {self.reference}"


class FiscalWebhookEvent(models.Model):
    class Status(models.TextChoices):
        PROCESSED = "PROCESSED", "Processado"
        IGNORED = "IGNORED", "Ignorado"
        FAILED = "FAILED", "Falhou"

    payload_hash = models.CharField(max_length=64, unique=True)
    provider_event = models.CharField(max_length=80, blank=True)
    reference = models.CharField(max_length=100, blank=True)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=Status.choices)
    error_message = models.TextField(blank=True)
    document = models.ForeignKey(
        FiscalDocument,
        related_name="webhook_events",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-received_at", "-id"]

    def __str__(self):
        return f"Focus webhook {self.reference or self.payload_hash[:12]}"
