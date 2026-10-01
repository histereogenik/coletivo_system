import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIRequestFactory
from rest_framework.test import APIClient

from apps.common.audit import record_audit_event, request_metadata, snapshot
from apps.common.models import AuditEvent
from apps.users.models import Member

User = get_user_model()


def test_audit_snapshot_excludes_personal_contact_data():
    member = Member(
        full_name="Pessoa Teste",
        email="pessoa@example.com",
        phone="+5562999999999",
        address="Rua de teste",
        heard_about="Indicação",
        role=Member.Role.AVULSO,
        diet=Member.Diet.CARNIVORO,
        observations="Informação pessoal",
    )

    data = snapshot(member)

    assert data["full_name"] == "Pessoa Teste"
    assert "email" not in data
    assert "phone" not in data
    assert "address" not in data
    assert "observations" not in data


@pytest.mark.django_db
def test_audit_second_page_is_reachable_with_frontend_page_size():
    superuser = User.objects.create_superuser(username="auditor", password="strong-password")
    AuditEvent.objects.bulk_create(
        [
            AuditEvent(
                actor=superuser,
                action=AuditEvent.Action.SPECIAL,
                entity_type="tests.Record",
                object_id=str(index),
            )
            for index in range(16)
        ]
    )
    client = APIClient()
    client.force_authenticate(superuser)

    first_page = client.get("/api/common/audit-events/", {"page": 1, "page_size": 15})
    second_page = client.get("/api/common/audit-events/", {"page": 2, "page_size": 15})

    assert first_page.status_code == 200
    assert first_page.data["count"] == 16
    assert len(first_page.data["results"]) == 15
    assert second_page.status_code == 200
    assert len(second_page.data["results"]) == 1


@pytest.mark.django_db
def test_audit_filters_and_filter_options_are_available_to_superuser():
    superuser = User.objects.create_superuser(
        username="auditor-filtros",
        first_name="Pessoa",
        last_name="Auditora",
        password="strong-password",
    )
    matching = AuditEvent.objects.create(
        actor=superuser,
        action=AuditEvent.Action.UPDATE,
        source=AuditEvent.Source.UI,
        entity_type="users.Member",
        object_id="42",
    )
    AuditEvent.objects.create(
        actor=superuser,
        action=AuditEvent.Action.CREATE,
        source=AuditEvent.Source.SYSTEM,
        entity_type="lunch.Lunch",
        object_id="7",
    )
    client = APIClient()
    client.force_authenticate(superuser)

    response = client.get(
        "/api/common/audit-events/",
        {
            "actor": superuser.pk,
            "action": AuditEvent.Action.UPDATE,
            "source": AuditEvent.Source.UI,
            "entity_type": "users.Member",
            "object_id": "42",
        },
    )
    options_response = client.get("/api/common/audit-events/filter-options/")

    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [matching.pk]
    assert options_response.status_code == 200
    assert {
        "value": str(superuser.pk),
        "label": "Pessoa Auditora",
    } in options_response.data["actors"]
    assert "users.Member" in options_response.data["entity_types"]
    assert any(
        option["value"] == AuditEvent.Action.UPDATE
        for option in options_response.data["actions"]
    )


@override_settings(AUDIT_TRUSTED_PROXY_IPS=[])
def test_audit_ignores_forwarded_ip_from_untrusted_client():
    request = APIRequestFactory().get(
        "/",
        REMOTE_ADDR="192.0.2.10",
        HTTP_X_FORWARDED_FOR="203.0.113.20",
    )

    assert request_metadata(request)["ip_address"] == "192.0.2.10"


@override_settings(AUDIT_TRUSTED_PROXY_IPS=["192.0.2.10"])
def test_audit_accepts_valid_forwarded_ip_from_trusted_proxy():
    request = APIRequestFactory().get(
        "/",
        REMOTE_ADDR="192.0.2.10",
        HTTP_X_FORWARDED_FOR="203.0.113.20, 192.0.2.10",
    )

    assert request_metadata(request)["ip_address"] == "203.0.113.20"


@pytest.mark.django_db
@override_settings(AUDIT_TRUSTED_PROXY_IPS=["192.0.2.10"])
def test_invalid_forwarded_ip_cannot_abort_audited_mutation():
    user = User.objects.create_superuser(username="safe-audit", password="strong-password")
    member = Member.objects.create(full_name="Teste", diet=Member.Diet.VEGANO)
    request = APIRequestFactory().post(
        "/",
        REMOTE_ADDR="192.0.2.10",
        HTTP_X_FORWARDED_FOR="not-an-ip",
    )
    request.user = user

    event = record_audit_event(
        request=request,
        instance=member,
        action=AuditEvent.Action.CREATE,
    )

    assert event.ip_address == "192.0.2.10"
