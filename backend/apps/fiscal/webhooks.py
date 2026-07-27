import hashlib
import json
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from apps.fiscal.models import FiscalDocument, FiscalWebhookEvent
from apps.fiscal.services import apply_focus_response

REFERENCE_KEYS = ("ref", "referencia", "reference")


def _find_value(payload, keys):
    if not isinstance(payload, dict):
        return ""
    for key in keys:
        if payload.get(key) not in (None, ""):
            return str(payload[key])
    for value in payload.values():
        if isinstance(value, dict):
            found = _find_value(value, keys)
            if found:
                return found
    return ""


def _provider_data(payload):
    nested = payload.get("data") or payload.get("documento") or payload.get("document")
    if isinstance(nested, dict):
        return payload | nested
    return payload


def _payload_hash(payload):
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _valid_uuid(value):
    try:
        return UUID(value)
    except (TypeError, ValueError, AttributeError):
        return None


@transaction.atomic
def process_focus_webhook(payload):
    payload_hash = _payload_hash(payload)
    reference = _find_value(payload, REFERENCE_KEYS)
    provider_event = _find_value(payload, ("event", "evento", "type", "tipo"))[:80]
    event = FiscalWebhookEvent.objects.select_for_update().filter(payload_hash=payload_hash).first()
    created = event is None
    if event and event.status != FiscalWebhookEvent.Status.FAILED:
        return event, False
    if event is None:
        event = FiscalWebhookEvent.objects.create(
            payload_hash=payload_hash,
            provider_event=provider_event,
            reference=reference[:100],
            payload=payload,
            status=FiscalWebhookEvent.Status.IGNORED,
        )
    else:
        event.provider_event = provider_event
        event.reference = reference[:100]
        event.payload = payload
        event.error_message = ""

    reference_uuid = _valid_uuid(reference)
    document = None
    if reference_uuid:
        document = (
            FiscalDocument.objects.select_for_update().filter(reference=reference_uuid).first()
        )

    if not document:
        event.error_message = "Referência não encontrada no Coletivo System."
        event.processed_at = timezone.now()
        event.save(update_fields=["error_message", "processed_at"])
        return event, True

    try:
        # The savepoint keeps the audit transaction usable even if persistence of
        # the provider response raises a database error.
        with transaction.atomic():
            apply_focus_response(document, _provider_data(payload))
    except Exception:  # The endpoint returns 500 so Focus retries this delivery.
        event.status = FiscalWebhookEvent.Status.FAILED
        event.document = document
        event.error_message = "Não foi possível aplicar a atualização recebida da Focus."
        event.processed_at = timezone.now()
        event.save(update_fields=["status", "document", "error_message", "processed_at"])
        return event, created

    event.status = FiscalWebhookEvent.Status.PROCESSED
    event.document = document
    event.processed_at = timezone.now()
    event.error_message = ""
    event.save(update_fields=["status", "document", "error_message", "processed_at"])
    return event, created
