from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.common.models import AuditEvent


@pytest.mark.django_db
def test_prune_audit_events_is_dry_run_by_default_and_preserves_recent_events():
    old_event = AuditEvent.objects.create(
        action=AuditEvent.Action.SPECIAL,
        entity_type="tests.Record",
        object_id="old",
    )
    recent_event = AuditEvent.objects.create(
        action=AuditEvent.Action.SPECIAL,
        entity_type="tests.Record",
        object_id="recent",
    )
    AuditEvent.objects.filter(pk=old_event.pk).update(
        created_at=timezone.now() - timedelta(days=731)
    )
    output = StringIO()

    call_command("prune_audit_events", days=730, stdout=output)

    assert "Simulacao: 1 evento(s)" in output.getvalue()
    assert AuditEvent.objects.filter(pk=old_event.pk).exists()
    assert AuditEvent.objects.filter(pk=recent_event.pk).exists()

    call_command("prune_audit_events", days=730, confirm=True, stdout=output)

    assert not AuditEvent.objects.filter(pk=old_event.pk).exists()
    assert AuditEvent.objects.filter(pk=recent_event.pk).exists()
