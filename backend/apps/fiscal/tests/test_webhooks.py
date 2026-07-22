import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.fiscal.models import FiscalDocument, FiscalWebhookEvent
from apps.lunch.tests.factories import LunchFactory

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def document():
    lunch = LunchFactory()
    return FiscalDocument.objects.create(
        document_type=FiscalDocument.DocumentType.NFCE,
        environment=FiscalDocument.Environment.HOMOLOGATION,
        status=FiscalDocument.Status.PROCESSING,
        source_kind=FiscalDocument.SourceType.LUNCH,
        lunch=lunch,
        sale_date=lunch.date,
        recipient={},
        items=[],
        payment_methods=[],
        request_payload={},
        emitted_at=timezone.now(),
    )


@pytest.mark.django_db
@override_settings(FOCUS_WEBHOOK_SECRET="webhook-secret")
def test_webhook_requires_configured_custom_header(api_client, document):
    response = api_client.post(
        reverse("focus-webhook"),
        {"ref": str(document.reference), "status": "autorizado"},
        format="json",
    )

    assert response.status_code == 401
    assert FiscalWebhookEvent.objects.count() == 0


@pytest.mark.django_db
@override_settings(FOCUS_WEBHOOK_SECRET="webhook-secret")
def test_webhook_updates_document_and_is_idempotent(api_client, document):
    payload = {
        "event": "nfe",
        "ref": str(document.reference),
        "data": {
            "status": "autorizado",
            "numero": "7",
            "serie": "1",
            "chave_nfe": f"NFe{'5' * 44}",
        },
    }
    headers = {"HTTP_X_FOCUS_WEBHOOK_TOKEN": "webhook-secret"}

    first = api_client.post(reverse("focus-webhook"), payload, format="json", **headers)
    second = api_client.post(reverse("focus-webhook"), payload, format="json", **headers)

    assert first.status_code == 200
    assert first.data["duplicate"] is False
    assert second.status_code == 200
    assert second.data["duplicate"] is True
    assert FiscalWebhookEvent.objects.count() == 1
    document.refresh_from_db()
    assert document.status == FiscalDocument.Status.AUTHORIZED
    assert document.number == "7"
    assert document.access_key == "5" * 44


@pytest.mark.django_db
@override_settings(FOCUS_WEBHOOK_SECRET="webhook-secret")
def test_unknown_reference_is_audited_without_retry_loop(api_client):
    response = api_client.post(
        reverse("focus-webhook"),
        {"event": "nfe", "ref": str(uuid.uuid4()), "status": "autorizado"},
        format="json",
        HTTP_X_FOCUS_WEBHOOK_TOKEN="webhook-secret",
    )

    assert response.status_code == 200
    event = FiscalWebhookEvent.objects.get()
    assert event.status == FiscalWebhookEvent.Status.IGNORED
    assert "não encontrada" in event.error_message


@pytest.mark.django_db
@override_settings(FOCUS_WEBHOOK_SECRET="webhook-secret")
def test_failed_webhook_is_audited_and_can_be_retried(api_client, document):
    payload = {
        "event": "nfe",
        "ref": str(document.reference),
        "status": "autorizado",
    }
    headers = {"HTTP_X_FOCUS_WEBHOOK_TOKEN": "webhook-secret"}

    with patch(
        "apps.fiscal.webhooks.apply_focus_response",
        side_effect=RuntimeError("temporary failure"),
    ):
        first = api_client.post(reverse("focus-webhook"), payload, format="json", **headers)

    assert first.status_code == 500
    event = FiscalWebhookEvent.objects.get()
    assert event.status == FiscalWebhookEvent.Status.FAILED

    second = api_client.post(reverse("focus-webhook"), payload, format="json", **headers)

    assert second.status_code == 200
    assert second.data["duplicate"] is True
    assert FiscalWebhookEvent.objects.count() == 1
    event.refresh_from_db()
    assert event.status == FiscalWebhookEvent.Status.PROCESSED
