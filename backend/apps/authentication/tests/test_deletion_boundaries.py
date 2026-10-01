import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.agenda.tests.factories import AgendaEntryFactory
from apps.authentication.capabilities import set_user_capabilities
from apps.credits.models import CreditEntry
from apps.credits.tests.factories import CreditEntryFactory
from apps.duties.tests.factories import DutyFactory
from apps.lunch.tests.factories import LunchFactory, PackageFactory
from apps.users.tests.factories import MemberFactory

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


def create_operator(*, username, capability):
    operator = User.objects.create_user(username=username, password="operator-password")
    set_user_capabilities(operator, [capability])
    return operator


@pytest.mark.django_db
def test_members_operator_cannot_delete_member_with_lunch_or_package(client):
    operator = create_operator(username="integrantes", capability="members")
    member = MemberFactory()
    lunch = LunchFactory(member=member)
    package = PackageFactory(member=member)
    client.force_authenticate(operator)

    response = client.delete(f"/api/users/members/{member.pk}/")

    assert response.status_code == 409
    assert "vinculado" in response.data["detail"]
    assert member.__class__.objects.filter(pk=member.pk).exists()
    assert lunch.__class__.objects.filter(pk=lunch.pk).exists()
    assert package.__class__.objects.filter(pk=package.pk).exists()


@pytest.mark.django_db
def test_duties_operator_cannot_delete_duty_used_by_agenda(client):
    operator = create_operator(username="funcoes", capability="duties")
    duty = DutyFactory()
    agenda_entry = AgendaEntryFactory(duty=duty)
    credit = CreditEntryFactory(
        agenda_entry=agenda_entry,
        origin=CreditEntry.Origin.AGENDA,
    )
    client.force_authenticate(operator)

    response = client.delete(f"/api/duties/duties/{duty.pk}/")

    assert response.status_code == 409
    assert duty.__class__.objects.filter(pk=duty.pk).exists()
    assert agenda_entry.__class__.objects.filter(pk=agenda_entry.pk).exists()
    assert CreditEntry.objects.filter(pk=credit.pk).exists()


@pytest.mark.django_db
def test_agenda_operator_cannot_delete_entry_with_credit(client):
    operator = create_operator(username="agenda", capability="agenda")
    agenda_entry = AgendaEntryFactory()
    credit = CreditEntryFactory(
        agenda_entry=agenda_entry,
        origin=CreditEntry.Origin.AGENDA,
    )
    client.force_authenticate(operator)

    response = client.delete(f"/api/agenda/entries/{agenda_entry.pk}/")

    assert response.status_code == 409
    assert agenda_entry.__class__.objects.filter(pk=agenda_entry.pk).exists()
    assert CreditEntry.objects.filter(pk=credit.pk).exists()
