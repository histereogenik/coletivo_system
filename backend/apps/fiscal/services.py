from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.fiscal.client import FocusNFeClient, FocusNFeError
from apps.fiscal.models import FiscalDocument
from apps.lunch.models import Lunch, Package

ACTIVE_STATUSES = {
    FiscalDocument.Status.PENDING,
    FiscalDocument.Status.PROCESSING,
    FiscalDocument.Status.AUTHORIZED,
}

PAYMENT_METHODS = {
    Lunch.PaymentMode.DINHEIRO: "01",
}


def cents_to_decimal(value_cents):
    return f"{(Decimal(value_cents) / Decimal(100)):.2f}"


def get_missing_fiscal_settings():
    missing = []
    for setting_name in (
        "FOCUS_NFE_TOKEN",
        "FISCAL_ISSUER_CNPJ",
        "FISCAL_PIS_CST",
        "FISCAL_COFINS_CST",
    ):
        if not getattr(settings, setting_name, ""):
            missing.append(setting_name)
    return missing


def validate_fiscal_settings():
    missing = get_missing_fiscal_settings()
    if missing:
        raise ValidationError(
            {"configuration": f"Configuração fiscal incompleta: {', '.join(missing)}."}
        )
    if settings.FOCUS_NFE_ENVIRONMENT == "production" and not settings.FOCUS_NFE_ALLOW_PRODUCTION:
        raise ValidationError(
            {
                "configuration": (
                    "Emissão em produção bloqueada. Defina FOCUS_NFE_ALLOW_PRODUCTION=True "
                    "somente após concluir a homologação."
                )
            }
        )


def _get_source(source_type, source_id):
    try:
        if source_type == "LUNCH":
            return Lunch.objects.select_for_update().get(pk=source_id)
        if source_type == "PACKAGE":
            return Package.objects.select_for_update().get(pk=source_id)
    except ObjectDoesNotExist as exc:
        raise ValidationError({"source_id": "Venda não encontrada."}) from exc
    raise ValidationError({"source_type": "Origem fiscal inválida."})


def _validate_source(source):
    if source.payment_status != source.PaymentStatus.PAGO:
        raise ValidationError({"source_id": "A venda precisa estar paga para emitir nota."})
    if source.value_cents <= 0:
        raise ValidationError({"source_id": "A venda precisa ter valor maior que zero."})
    if source.payment_mode == source.PaymentMode.TROCA:
        raise ValidationError({"source_id": "Vendas pagas por troca não geram nota fiscal."})
    if isinstance(source, Lunch) and source.package_id:
        raise ValidationError(
            {"source_id": "Este almoço já foi coberto por um pacote; emita sobre o pacote."}
        )
    if isinstance(source, Package) and not settings.FISCAL_ALLOW_PACKAGE_EMISSION:
        raise ValidationError(
            {
                "source_id": (
                    "Emissão sobre pacotes está bloqueada até a contabilidade confirmar "
                    "o momento do fato fiscal."
                )
            }
        )


def _source_fields(source):
    if isinstance(source, Lunch):
        return {
            "lunch": source,
            "package": None,
            "sale_date": source.date,
            "quantity": 1,
            "unit_value_cents": source.value_cents,
            "total_cents": source.value_cents,
            "code": "REFEICAO",
            "description": settings.FISCAL_MEAL_DESCRIPTION,
        }
    return {
        "lunch": None,
        "package": source,
        "sale_date": source.date,
        "quantity": source.quantity,
        "unit_value_cents": source.unit_value_cents,
        "total_cents": source.value_cents,
        "code": "PACOTE_REFEICAO",
        "description": settings.FISCAL_PACKAGE_DESCRIPTION,
    }


def _document_type(recipient):
    tax_id = recipient.get("tax_id", "")
    if len(tax_id) == 14:
        return FiscalDocument.DocumentType.NFE
    return FiscalDocument.DocumentType.NFCE


def _build_item(source_fields, cfop):
    item = {
        "numero_item": 1,
        "codigo_produto": source_fields["code"],
        "descricao": source_fields["description"],
        "codigo_ncm": settings.FISCAL_MEAL_NCM,
        "cfop": cfop,
        "unidade_comercial": "UN",
        "quantidade_comercial": source_fields["quantity"],
        "valor_unitario_comercial": cents_to_decimal(source_fields["unit_value_cents"]),
        "valor_bruto": cents_to_decimal(source_fields["total_cents"]),
        "unidade_tributavel": "UN",
        "quantidade_tributavel": source_fields["quantity"],
        "valor_unitario_tributavel": cents_to_decimal(source_fields["unit_value_cents"]),
        "inclui_no_total": 1,
        "icms_origem": 0,
        "icms_situacao_tributaria": settings.FISCAL_ICMS_CSOSN,
        "pis_situacao_tributaria": settings.FISCAL_PIS_CST,
        "pis_valor": "0.00",
        "cofins_situacao_tributaria": settings.FISCAL_COFINS_CST,
        "cofins_valor": "0.00",
    }
    if settings.FISCAL_IBS_CBS_CST and settings.FISCAL_IBS_CBS_CLASSIFICATION:
        item.update(
            {
                "ibs_cbs_situacao_tributaria": settings.FISCAL_IBS_CBS_CST,
                "ibs_cbs_classificacao_tributaria": settings.FISCAL_IBS_CBS_CLASSIFICATION,
            }
        )
    return item


def _build_payment(source, total_cents):
    if source.payment_mode == source.PaymentMode.CARTAO:
        raise ValidationError(
            {
                "source_id": (
                    "O cadastro da venda não diferencia cartão de crédito e débito. "
                    "Corrija a forma de pagamento antes da emissão fiscal."
                )
            }
        )
    payment_code = (
        settings.FISCAL_PIX_PAYMENT_CODE
        if source.payment_mode == source.PaymentMode.PIX
        else PAYMENT_METHODS.get(source.payment_mode)
    )
    if not payment_code:
        raise ValidationError({"source_id": "Forma de pagamento não suportada fiscalmente."})
    payment = {
        "indicador_pagamento": 0,
        "forma_pagamento": payment_code,
        "valor_pagamento": cents_to_decimal(total_cents),
    }
    return payment


def _add_recipient(payload, recipient, document_type):
    tax_id = recipient.get("tax_id", "")
    if document_type == FiscalDocument.DocumentType.NFCE:
        if tax_id:
            payload["cpf_destinatario"] = tax_id
        if recipient.get("name"):
            payload["nome_destinatario"] = recipient["name"]
        return

    address = recipient["address"]
    payload.update(
        {
            "cnpj_destinatario": tax_id,
            "nome_destinatario": recipient["name"],
            "indicador_inscricao_estadual_destinatario": recipient["state_registration_indicator"],
            "logradouro_destinatario": address["street"],
            "numero_destinatario": address["number"],
            "bairro_destinatario": address["district"],
            "municipio_destinatario": address["city"],
            "uf_destinatario": address["state"],
            "cep_destinatario": address["postal_code"],
        }
    )
    if recipient.get("state_registration"):
        payload["inscricao_estadual_destinatario"] = recipient["state_registration"]
    if address.get("complement"):
        payload["complemento_destinatario"] = address["complement"]
    if recipient.get("email"):
        payload["email_destinatario"] = recipient["email"]


def _build_payload(document_type, source, source_fields, recipient, presence):
    emitted_at = timezone.localtime()
    destination_state = (
        recipient.get("address", {}).get("state", settings.FISCAL_ISSUER_STATE)
        if document_type == FiscalDocument.DocumentType.NFE
        else settings.FISCAL_ISSUER_STATE
    )
    interstate = destination_state != settings.FISCAL_ISSUER_STATE
    if interstate and recipient.get("state_registration_indicator", "9") == "9":
        cfop = settings.FISCAL_MEAL_INTERSTATE_NON_CONTRIBUTOR_CFOP
    elif interstate:
        cfop = settings.FISCAL_MEAL_INTERSTATE_CFOP
    else:
        cfop = settings.FISCAL_MEAL_CFOP
    items = [_build_item(source_fields, cfop)]
    payments = [_build_payment(source, source_fields["total_cents"])]
    payload = {
        "cnpj_emitente": settings.FISCAL_ISSUER_CNPJ,
        "data_emissao": emitted_at.isoformat(),
        "natureza_operacao": "VENDA DE PRODUCAO DO ESTABELECIMENTO",
        "local_destino": 2 if interstate else 1,
        "presenca_comprador": presence,
        "modalidade_frete": 9,
        "items": items,
        "formas_pagamento": payments,
    }
    if document_type == FiscalDocument.DocumentType.NFE:
        payload.update(
            {
                "data_entrada_saida": emitted_at.isoformat(),
                "tipo_documento": 1,
                "finalidade_emissao": 1,
                "consumidor_final": 1,
            }
        )
    _add_recipient(payload, recipient, document_type)
    return emitted_at, items, payments, payload


def _source_filter(source):
    return {"lunch": source} if isinstance(source, Lunch) else {"package": source}


@transaction.atomic
def _create_pending_document(*, source_type, source_id, recipient, presence, actor):
    source = _get_source(source_type, source_id)
    _validate_source(source)

    if FiscalDocument.objects.filter(**_source_filter(source), status__in=ACTIVE_STATUSES).exists():
        raise ValidationError({"source_id": "Esta venda já possui uma emissão fiscal ativa."})

    document_type = _document_type(recipient)
    source_fields = _source_fields(source)
    emitted_at, items, payments, payload = _build_payload(
        document_type, source, source_fields, recipient, presence
    )
    environment = (
        FiscalDocument.Environment.PRODUCTION
        if settings.FOCUS_NFE_ENVIRONMENT == "production"
        else FiscalDocument.Environment.HOMOLOGATION
    )
    document = FiscalDocument.objects.create(
        document_type=document_type,
        environment=environment,
        lunch=source_fields["lunch"],
        package=source_fields["package"],
        sale_date=source_fields["sale_date"],
        recipient=recipient,
        items=items,
        payment_methods=payments,
        request_payload=payload,
        emitted_at=emitted_at,
        created_by=actor,
    )
    return document, payload


def emit_fiscal_document(*, source_type, source_id, recipient, presence, actor, client=None):
    validate_fiscal_settings()
    document, payload = _create_pending_document(
        source_type=source_type,
        source_id=source_id,
        recipient=recipient,
        presence=presence,
        actor=actor,
    )

    focus_client = client or FocusNFeClient()
    try:
        response = focus_client.emit(document.document_type, str(document.reference), payload)
    except FocusNFeError as exc:
        document.status = (
            FiscalDocument.Status.REJECTED
            if exc.status_code is not None
            else FiscalDocument.Status.PROCESSING
        )
        document.response_payload = exc.payload or {}
        document.sefaz_code = str(exc.status_code or "")
        document.error_message = exc.message
        document.save(
            update_fields=[
                "status",
                "response_payload",
                "sefaz_code",
                "error_message",
                "updated_at",
            ]
        )
        return document

    apply_focus_response(document, response)
    return document


def _first(payload, *keys):
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
    return ""


def _limited_text(value, max_length):
    return str(value or "")[:max_length]


def _access_key(value):
    digits = "".join(character for character in str(value or "") if character.isdigit())
    if len(digits) > 44:
        return digits[-44:]
    return digits


def apply_focus_response(document, response):
    # Persist the complete provider response first. If a future mapping fails, the pending
    # document and its Focus reference remain available for a safe status recovery.
    document.response_payload = response
    document.save(update_fields=["response_payload", "updated_at"])

    focus_status = _limited_text(_first(response, "status", "status_processamento"), 80)
    normalized = focus_status.lower()
    if normalized in {"autorizado", "authorized"}:
        status = FiscalDocument.Status.AUTHORIZED
    elif normalized in {"cancelado", "cancelled"}:
        status = FiscalDocument.Status.CANCELLED
    elif normalized in {
        "erro_autorizacao",
        "rejeitado",
        "rejected",
        "denegado",
        "erro",
    }:
        status = FiscalDocument.Status.REJECTED
    else:
        status = FiscalDocument.Status.PROCESSING

    document.status = status
    document.focus_status = focus_status
    document.number = _limited_text(_first(response, "numero", "numero_nfe"), 20)
    document.series = _limited_text(_first(response, "serie"), 20)
    document.access_key = _access_key(_first(response, "chave_nfe", "chave_nfce", "chave"))
    document.protocol = _limited_text(_first(response, "protocolo", "protocolo_autorizacao"), 30)
    document.xml_url = _limited_text(
        _first(response, "caminho_xml_nota_fiscal", "caminho_xml", "url_xml"), 500
    )
    document.danfe_url = _limited_text(_first(response, "caminho_danfe", "url_danfe"), 500)
    document.sefaz_code = _limited_text(_first(response, "status_sefaz", "codigo_sefaz"), 20)
    document.error_message = str(_first(response, "mensagem_sefaz", "mensagem", "message", "erro"))
    if status == FiscalDocument.Status.AUTHORIZED and not document.authorized_at:
        document.authorized_at = timezone.now()
    document.save()


def refresh_fiscal_document(document, *, client=None):
    if document.status not in {
        FiscalDocument.Status.PENDING,
        FiscalDocument.Status.PROCESSING,
    }:
        return document
    focus_client = client or FocusNFeClient()
    try:
        response = focus_client.get(document.document_type, str(document.reference))
    except FocusNFeError as exc:
        document.error_message = exc.message
        document.response_payload = exc.payload or document.response_payload
        document.save(update_fields=["error_message", "response_payload", "updated_at"])
        return document
    apply_focus_response(document, response)
    return document
