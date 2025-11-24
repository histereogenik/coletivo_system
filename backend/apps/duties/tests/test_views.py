import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

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
def test_superuser_can_create_duty(api_client, superuser):
    members = [MemberFactory(), MemberFactory()]
    for m in members:
        assert m.role == m.Role.MENSALISTA
    api_client.force_authenticate(user=superuser)
    url = reverse("duty-list")
    payload = {
        "name": "Organização",
        "remuneration_cents": 2000,
        "member_ids": [m.id for m in members],
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 201
    assert response.data["name"] == "Organização"
    assert len(response.data["members"]) == 2
    for m in members:
        m.refresh_from_db()
        assert m.role == m.Role.SUSTENTADOR


@pytest.mark.django_db
def test_non_superuser_forbidden(api_client):
    user = User.objects.create_user(username="user", email="user@example.com", password="123456")
    api_client.force_authenticate(user=user)
    url = reverse("duty-list")

    response = api_client.get(url)

    assert response.status_code == 403


@pytest.mark.django_db
def test_superuser_can_list_duties(api_client, superuser):
    DutyFactory()
    api_client.force_authenticate(user=superuser)
    url = reverse("duty-list")

    response = api_client.get(url)

    assert response.status_code == 200
    assert len(response.data) >= 1
