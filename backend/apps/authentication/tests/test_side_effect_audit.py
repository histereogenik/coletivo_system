import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.authentication.capabilities import set_user_capabilities
from apps.common.models import AuditEvent
from apps.lunch.models import Lunch
from apps.lunch.tests.factories import PackageFactory
from apps.users.models import Member
from apps.users.tests.factories import MemberFactory

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


def create_operator(*, username, capability):
    operator = User.objects.create_user(username=username, password="operator-password")
    set_user_capabilities(operator, [capability])
    return operator


def audit_operations(*, entity_type, object_id):
    return {
        event.changes.get("operation")
        for event in AuditEvent.objects.filter(
            entity_type=entity_type,
            object_id=str(object_id),
        )
    }


@pytest.mark.django_db
def test_package_creation_records_automatic_member_promotion(client):
    operator = create_operator(username="pacotes", capability="packages")
    member = MemberFactory(role=Member.Role.AVULSO)
    client.force_authenticate(operator)

    response = client.post(
        "/api/lunch/packages/",
        {
            "member": member.pk,
            "unit_value_cents": 2200,
            "date": "2026-10-01",
            "payment_status": "PAGO",
            "payment_mode": "PIX",
            "quantity": 5,
            "expiration": "2026-12-01",
        },
        format="json",
    )

    assert response.status_code == 201
    member.refresh_from_db()
    assert member.role == Member.Role.MENSALISTA
    assert member.updated_by == operator
    event = AuditEvent.objects.get(
        actor=operator,
        action=AuditEvent.Action.UPDATE,
        entity_type="users.Member",
        object_id=str(member.pk),
    )
    assert event.changes["operation"] == "automatic_role_promotion"
    assert event.changes["role"] == {
        "before": Member.Role.AVULSO,
        "after": Member.Role.MENSALISTA,
    }


@pytest.mark.django_db
def test_duty_creation_records_automatic_member_promotion(client):
    operator = create_operator(username="funcoes", capability="duties")
    member = MemberFactory(role=Member.Role.MENSALISTA)
    client.force_authenticate(operator)

    response = client.post(
        "/api/duties/duties/",
        {"name": "Cozinha", "remuneration_cents": 1000, "member_ids": [member.pk]},
        format="json",
    )

    assert response.status_code == 201
    member.refresh_from_db()
    assert member.role == Member.Role.SUSTENTADOR
    assert member.updated_by == operator
    assert "automatic_role_promotion" in audit_operations(
        entity_type="users.Member",
        object_id=member.pk,
    )


@pytest.mark.django_db
def test_lunch_package_consumption_records_package_actor_and_audit(client):
    operator = create_operator(username="almocos", capability="lunches")
    member = MemberFactory(role=Member.Role.MENSALISTA)
    package = PackageFactory(member=member, quantity=5, remaining_quantity=5)
    client.force_authenticate(operator)

    response = client.post(
        "/api/lunch/lunches/",
        {
            "member": member.pk,
            "package": package.pk,
            "value_cents": package.unit_value_cents,
            "date": "2026-10-01",
            "payment_status": Lunch.PaymentStatus.PAGO,
            "payment_mode": Lunch.PaymentMode.PIX,
        },
        format="json",
    )

    assert response.status_code == 201
    package.refresh_from_db()
    assert package.remaining_quantity == 4
    assert package.updated_by == operator
    assert "lunch_package_consumption" in audit_operations(
        entity_type="lunch.Package",
        object_id=package.pk,
    )


@pytest.mark.django_db
def test_lunch_package_switch_and_delete_audit_every_balance_change(client):
    operator = create_operator(username="almocos", capability="lunches")
    member = MemberFactory(role=Member.Role.MENSALISTA)
    old_package = PackageFactory(member=member, quantity=5, remaining_quantity=5)
    new_package = PackageFactory(member=member, quantity=5, remaining_quantity=5)
    client.force_authenticate(operator)
    create_response = client.post(
        "/api/lunch/lunches/",
        {
            "member": member.pk,
            "package": old_package.pk,
            "value_cents": old_package.unit_value_cents,
            "date": "2026-10-01",
            "payment_status": Lunch.PaymentStatus.PAGO,
            "payment_mode": Lunch.PaymentMode.PIX,
        },
        format="json",
    )
    assert create_response.status_code == 201

    update_response = client.patch(
        f"/api/lunch/lunches/{create_response.data['id']}/",
        {"package": new_package.pk},
        format="json",
    )

    assert update_response.status_code == 200
    old_package.refresh_from_db()
    new_package.refresh_from_db()
    assert old_package.remaining_quantity == 5
    assert new_package.remaining_quantity == 4
    assert old_package.updated_by == operator
    assert new_package.updated_by == operator
    assert "lunch_package_switch_restore" in audit_operations(
        entity_type="lunch.Package",
        object_id=old_package.pk,
    )
    assert "lunch_package_switch_consume" in audit_operations(
        entity_type="lunch.Package",
        object_id=new_package.pk,
    )

    delete_response = client.delete(f"/api/lunch/lunches/{create_response.data['id']}/")

    assert delete_response.status_code == 204
    new_package.refresh_from_db()
    assert new_package.remaining_quantity == 5
    assert new_package.updated_by == operator
    assert "lunch_deletion_package_restore" in audit_operations(
        entity_type="lunch.Package",
        object_id=new_package.pk,
    )
