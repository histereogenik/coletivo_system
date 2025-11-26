import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.agenda.tests.factories import AgendaEntryFactory
from apps.duties.tests.factories import DutyFactory
from apps.users.tests.factories import MemberFactory

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def superuser():
    return User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="strong-password",
    )


@pytest.mark.django_db
def test_superuser_can_create_agenda_entry(api_client, superuser):
    duty = DutyFactory()
    members = [MemberFactory(), MemberFactory()]
    api_client.force_authenticate(user=superuser)
    url = reverse("agenda-entry-list")
    payload = {
        "date": "2025-12-02",
        "start_time": "09:00",
        "end_time": "10:00",
        "duty": duty.id,
        "member_ids": [m.id for m in members],
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 201
    assert len(response.data["members"]) == 2


@pytest.mark.django_db
def test_non_superuser_forbidden(api_client):
    user = User.objects.create_user(username="user", email="user@example.com", password="123456")
    api_client.force_authenticate(user=user)
    url = reverse("agenda-entry-list")

    response = api_client.get(url)

    assert response.status_code == 403


@pytest.mark.django_db
def test_filter_by_date(api_client, superuser):
    AgendaEntryFactory(date="2025-12-05")
    AgendaEntryFactory(date="2025-12-06")
    api_client.force_authenticate(user=superuser)
    url = reverse("agenda-entry-list")

    response = api_client.get(url, {"date": "2025-12-05"})

    assert response.status_code == 200
    assert len(response.data) == 1
