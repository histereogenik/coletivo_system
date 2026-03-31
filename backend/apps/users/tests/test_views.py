import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.users.models import Member
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
def test_anonymous_cannot_access_members(api_client):
    url = reverse("member-list")
    response = api_client.get(url)

    assert response.status_code == 401


@pytest.mark.django_db
def test_non_superuser_forbidden(api_client):
    user = User.objects.create_user(username="user", email="user@example.com", password="123456")
    api_client.force_authenticate(user=user)
    url = reverse("member-list")

    response = api_client.get(url)

    assert response.status_code == 403


@pytest.mark.django_db
def test_superuser_can_list_members(api_client, superuser):
    MemberFactory()
    MemberFactory()
    api_client.force_authenticate(user=superuser)
    url = reverse("member-list")

    response = api_client.get(url)

    assert response.status_code == 200
    assert len(response.data) == Member.objects.count()


@pytest.mark.django_db
def test_superuser_can_create_member(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    url = reverse("member-list")
    payload = {
        "full_name": "Carla Dias",
        "phone": "+55 21 99999-0000",
        "email": "carla@example.com",
        "address": "Rua A, 42",
        "heard_about": "Instagram",
        "role": Member.Role.AVULSO,
        "diet": Member.Diet.VEGANO,
        "observations": "Chega às 12h.",
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 201
    created = Member.objects.get(email=payload["email"])
    assert created.full_name == payload["full_name"]


@pytest.mark.django_db
def test_member_search_is_accent_insensitive_and_includes_children_by_responsible(
    api_client, superuser
):
    responsible = MemberFactory(full_name="Nádia Souza")
    child = MemberFactory(full_name="Lucas Souza", is_child=True, responsible=responsible)
    other_member = MemberFactory(full_name="Fernanda Lima")
    api_client.force_authenticate(user=superuser)

    response = api_client.get(reverse("member-list"), {"search": "Nadia"})

    assert response.status_code == 200
    returned_ids = {member["id"] for member in response.data}
    assert responsible.id in returned_ids
    assert child.id in returned_ids
    assert other_member.id not in returned_ids
