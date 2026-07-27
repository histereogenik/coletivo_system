import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import DataError
from django.test import override_settings
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.fiscal.client import FocusNFeError
from apps.fiscal.models import FiscalDocument
from apps.lunch.models import Lunch
from apps.lunch.tests.factories import LunchFactory, PackageFactory

User = get_user_model()

FISCAL_SETTINGS = {
    "FOCUS_NFE_TOKEN": "homologation-token",
    "FOCUS_NFE_ENVIRONMENT": "homologation",
    "FISCAL_ISSUER_CNPJ": "65766900000190",
    "FISCAL_PIS_CST": "49",
    "FISCAL_COFINS_CST": "49",
    "FISCAL_IBS_CBS_CST": "test-cst",
    "FISCAL_IBS_CBS_CLASSIFICATION": "test-classification",
    "FISCAL_ALLOW_PACKAGE_EMISSION": True,
}


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def superuser():
    return User.objects.create_superuser(
        username="admin-fiscal",
        email="fiscal@example.com",
        password="strong-password",
    )


def authorized_response():
    return {
        "status": "autorizado",
        "numero": "1",
        "serie": "1",
        "chave_nfe": "5" * 44,
        "protocolo": "123456789",
        "caminho_xml_nota_fiscal": "https://example.test/note.xml",
        "caminho_danfe": "https://example.test/danfe.pdf",
    }


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch("apps.fiscal.services.FocusNFeClient.emit", return_value=authorized_response())
def test_emit_nfce_for_paid_lunch(mock_emit, api_client, superuser):
    lunch = LunchFactory(payment_mode=Lunch.PaymentMode.PIX)
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id, "recipient": {}},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["document_type"] == FiscalDocument.DocumentType.NFCE
    assert response.data["status"] == FiscalDocument.Status.AUTHORIZED
    payload = mock_emit.call_args.args[2]
    assert payload["items"][0]["cfop"] == "5101"
    assert payload["items"][0]["codigo_ncm"] == "21069090"
    assert payload["items"][0]["icms_situacao_tributaria"] == "102"
    assert "ibs_cbs_situacao_tributaria" in payload["items"][0]
    assert payload["formas_pagamento"][0]["forma_pagamento"] == "20"


@pytest.mark.django_db
@override_settings(
    **(
        FISCAL_SETTINGS
        | {
            "FISCAL_IBS_CBS_CST": "",
            "FISCAL_IBS_CBS_CLASSIFICATION": "",
        }
    )
)
@patch("apps.fiscal.services.FocusNFeClient.emit", return_value=authorized_response())
def test_simple_national_can_emit_in_2026_without_ibs_cbs_fields(mock_emit, api_client, superuser):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert response.status_code == 201
    item = mock_emit.call_args.args[2]["items"][0]
    assert "ibs_cbs_situacao_tributaria" not in item
    assert "ibs_cbs_classificacao_tributaria" not in item


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch(
    "apps.fiscal.services.FocusNFeClient.emit",
    return_value=authorized_response() | {"chave_nfe": f"NFe{'5' * 44}"},
)
def test_focus_access_key_prefix_is_normalized_to_44_digits(mock_emit, api_client, superuser):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["access_key"] == "5" * 44
    assert len(FiscalDocument.objects.get().access_key) == 44


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS, FOCUS_NFE_BASE_URL="https://homologacao.focusnfe.com.br")
@patch(
    "apps.fiscal.services.FocusNFeClient.emit",
    return_value={
        **authorized_response(),
        "caminho_xml_nota_fiscal": "/arquivos_development/note.xml",
        "caminho_danfe": "/arquivos_development/danfe.pdf",
    },
)
def test_relative_focus_file_urls_are_resolved_against_environment(
    mock_emit, api_client, superuser
):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["xml_url"] == (
        "https://homologacao.focusnfe.com.br/arquivos_development/note.xml"
    )
    assert response.data["danfe_url"] == (
        "https://homologacao.focusnfe.com.br/arquivos_development/danfe.pdf"
    )


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch("apps.fiscal.services.apply_focus_response", side_effect=DataError("invalid provider field"))
@patch("apps.fiscal.services.FocusNFeClient.emit", return_value=authorized_response())
def test_pending_reference_survives_unexpected_local_persistence_error(
    mock_emit, mock_apply, api_client, superuser
):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert response.status_code == 500
    assert response.data["code"] == "data_storage_error"
    assert "consultar a situação" in response.data["detail"]
    document = FiscalDocument.objects.get()
    assert document.status == FiscalDocument.Status.PENDING
    assert document.reference


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch("apps.fiscal.services.FocusNFeClient.emit", return_value=authorized_response())
def test_emit_nfe_for_cnpj_with_recipient_snapshot(mock_emit, api_client, superuser):
    package = PackageFactory(quantity=10, unit_value_cents=1200, value_cents=12000)
    api_client.force_authenticate(user=superuser)
    recipient = {
        "name": "Cliente Empresa Ltda",
        "tax_id": "12.345.678/0001-90",
        "email": "financeiro@example.com",
        "state_registration_indicator": "9",
        "address": {
            "street": "Rua Um",
            "number": "10",
            "district": "Centro",
            "city": "Alto Paraíso de Goiás",
            "state": "GO",
            "postal_code": "73770-000",
        },
    }

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "PACKAGE", "source_id": package.id, "recipient": recipient},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["document_type"] == FiscalDocument.DocumentType.NFE
    payload = mock_emit.call_args.args[2]
    assert payload["cnpj_destinatario"] == "12345678000190"
    assert payload["cep_destinatario"] == "73770000"
    assert payload["items"][0]["quantidade_comercial"] == 10
    assert payload["items"][0]["valor_bruto"] == "120.00"


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch("apps.fiscal.services.FocusNFeClient.emit", return_value=authorized_response())
def test_emit_interstate_nfe_uses_destination_state_and_non_contributor_cfop(
    mock_emit, api_client, superuser
):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)
    recipient = {
        "name": "Cliente de São Paulo Ltda",
        "tax_id": "12.345.678/0001-90",
        "state_registration_indicator": "9",
        "state_registration": "394.766.654.980",
        "address": {
            "street": "Rua Um",
            "number": "10",
            "district": "Centro",
            "city": "Ribeirão Preto",
            "state": "SP",
            "postal_code": "14031-140",
        },
    }

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id, "recipient": recipient},
        format="json",
    )

    assert response.status_code == 201
    payload = mock_emit.call_args.args[2]
    assert payload["uf_destinatario"] == "SP"
    assert payload["local_destino"] == 2
    assert payload["items"][0]["cfop"] == "6107"
    assert payload["inscricao_estadual_destinatario"] == "394766654980"


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
def test_exempt_recipient_cannot_send_state_registration(api_client, superuser):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)
    recipient = {
        "name": "Empresa Isenta Ltda",
        "tax_id": "12.345.678/0001-90",
        "state_registration_indicator": "2",
        "state_registration": "123456",
        "address": {
            "street": "Rua Um",
            "number": "10",
            "district": "Centro",
            "city": "Ribeirão Preto",
            "state": "SP",
            "postal_code": "14031-140",
        },
    }

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id, "recipient": recipient},
        format="json",
    )

    assert response.status_code == 400
    assert "state_registration" in str(response.data["recipient"])


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
def test_rejects_unpaid_sale_before_calling_focus(api_client, superuser):
    lunch = LunchFactory(payment_status=Lunch.PaymentStatus.EM_ABERTO)
    api_client.force_authenticate(user=superuser)

    with patch("apps.fiscal.services.FocusNFeClient.emit") as mock_emit:
        response = api_client.post(
            reverse("fiscal-document-emit"),
            {"source_type": "LUNCH", "source_id": lunch.id},
            format="json",
        )

    assert response.status_code == 400
    assert "paga" in str(response.data["source_id"])
    mock_emit.assert_not_called()


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch("apps.fiscal.services.FocusNFeClient.emit", return_value=authorized_response())
def test_prevents_duplicate_active_document(mock_emit, api_client, superuser):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)
    payload = {"source_type": "LUNCH", "source_id": lunch.id}

    first = api_client.post(reverse("fiscal-document-emit"), payload, format="json")
    second = api_client.post(reverse("fiscal-document-emit"), payload, format="json")

    assert first.status_code == 201
    assert second.status_code == 400
    assert mock_emit.call_count == 1


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch(
    "apps.fiscal.services.FocusNFeClient.emit",
    side_effect=FocusNFeError("CSC não configurado", status_code=422, payload={"codigo": "CSC"}),
)
def test_persists_focus_rejection_for_audit(mock_emit, api_client, superuser):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert response.status_code == 422
    assert response.data["status"] == FiscalDocument.Status.REJECTED
    assert response.data["error_message"] == "CSC não configurado"
    assert FiscalDocument.objects.get().response_payload == {"codigo": "CSC"}


@pytest.mark.django_db
@override_settings(**(FISCAL_SETTINGS | {"FISCAL_ALLOW_PACKAGE_EMISSION": False}))
def test_package_emission_is_blocked_until_accounting_confirms_tax_event(api_client, superuser):
    package = PackageFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "PACKAGE", "source_id": package.id},
        format="json",
    )

    assert response.status_code == 400
    assert "pacotes está bloqueada" in str(response.data["source_id"])


@pytest.mark.django_db
@override_settings(**(FISCAL_SETTINGS | {"FISCAL_ALLOW_MANUAL_EMISSION": True}))
@patch("apps.fiscal.services.FocusNFeClient.emit", return_value=authorized_response())
def test_emit_manual_consolidated_value_is_auditable_and_idempotent(
    mock_emit, api_client, superuser
):
    api_client.force_authenticate(user=superuser)
    request_key = uuid.uuid4()
    payload = {
        "source_type": "MANUAL",
        "manual": {
            "sale_date": "2026-07-22",
            "description": "MOVIMENTO SEMANAL 20 A 26/07",
            "value_cents": 125000,
            "payment_method": "99",
            "request_key": str(request_key),
        },
    }

    first = api_client.post(reverse("fiscal-document-emit"), payload, format="json")
    second = api_client.post(reverse("fiscal-document-emit"), payload, format="json")

    assert first.status_code == 201
    assert second.status_code == 201
    assert mock_emit.call_count == 1
    document = FiscalDocument.objects.get()
    assert document.source_type == FiscalDocument.SourceType.MANUAL
    assert document.source_id is None
    assert document.manual_description == "MOVIMENTO SEMANAL 20 A 26/07"
    focus_payload = mock_emit.call_args.args[2]
    assert focus_payload["items"][0]["valor_bruto"] == "1250.00"
    assert focus_payload["formas_pagamento"][0]["forma_pagamento"] == "99"
    assert focus_payload["formas_pagamento"][0]["descricao_pagamento"]


@pytest.mark.django_db
@override_settings(**(FISCAL_SETTINGS | {"FISCAL_ALLOW_MANUAL_EMISSION": False}))
def test_manual_emission_is_blocked_without_explicit_flag(api_client, superuser):
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {
            "source_type": "MANUAL",
            "manual": {
                "sale_date": "2026-07-22",
                "description": "MOVIMENTO SEMANAL",
                "value_cents": 10000,
                "payment_method": "99",
                "request_key": str(uuid.uuid4()),
            },
        },
        format="json",
    )

    assert response.status_code == 400
    assert "manual está bloqueada" in str(response.data["manual"])


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
def test_card_payment_is_blocked_without_credit_or_debit_detail(api_client, superuser):
    lunch = LunchFactory(payment_mode=Lunch.PaymentMode.CARTAO)
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert response.status_code == 400
    assert "crédito e débito" in str(response.data["source_id"])


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
@patch(
    "apps.fiscal.services.FocusNFeClient.emit",
    side_effect=FocusNFeError("Conexão interrompida"),
)
def test_uncertain_network_failure_stays_processing_and_prevents_duplicate(
    mock_emit, api_client, superuser
):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)

    first = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )
    second = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert first.status_code == 201
    assert first.data["status"] == FiscalDocument.Status.PROCESSING
    assert second.status_code == 400
    assert mock_emit.call_count == 1


@pytest.mark.django_db
@override_settings(**FISCAL_SETTINGS)
def test_configuration_does_not_expose_focus_token(api_client, superuser):
    api_client.force_authenticate(user=superuser)

    response = api_client.get(reverse("fiscal-document-configuration"))

    assert response.status_code == 200
    assert response.data["environment"] == "homologation"
    assert response.data["ready"] is True
    assert "token" not in response.data


@pytest.mark.django_db
@override_settings(
    **(
        FISCAL_SETTINGS
        | {
            "FOCUS_NFE_ENVIRONMENT": "production",
            "FOCUS_NFE_ALLOW_PRODUCTION": False,
        }
    )
)
def test_production_emission_requires_explicit_server_flag(api_client, superuser):
    lunch = LunchFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("fiscal-document-emit"),
        {"source_type": "LUNCH", "source_id": lunch.id},
        format="json",
    )

    assert response.status_code == 400
    assert "produção bloqueada" in str(response.data["configuration"])
