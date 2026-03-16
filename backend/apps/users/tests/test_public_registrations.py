import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.users.models import Member, PublicRegistration
from apps.users.tests.factories import MemberFactory, PublicRegistrationChildFactory, PublicRegistrationFactory

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def superuser():
    return User.objects.create_superuser(
        username="admin-public-registration",
        email="admin-public-registration@example.com",
        password="strong-password",
    )


@pytest.mark.django_db
def test_public_registration_can_be_created_without_children(api_client):
    url = reverse("public-registration-submit")
    payload = {
        "full_name": "Maria Silva",
        "phone": "+55 11 98888-7777",
        "email": "maria@example.com",
        "address": "Rua das Flores, 123",
        "heard_about": "Instagram",
        "role": Member.Role.AVULSO,
        "diet": Member.Diet.VEGETARIANO,
        "observations": "Sem glúten.",
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 201
    assert response.data["detail"] == "Inscrição enviada com sucesso."
    registration = PublicRegistration.objects.get(email="maria@example.com")
    assert registration.status == PublicRegistration.Status.PENDENTE
    assert registration.children.count() == 0


@pytest.mark.django_db
def test_public_registration_can_be_created_with_multiple_children(api_client):
    url = reverse("public-registration-submit")
    payload = {
        "full_name": "João Souza",
        "phone": "+55 21 97777-0000",
        "email": "joao@example.com",
        "address": "Rua A, 42",
        "heard_about": "Amigos",
        "role": Member.Role.SUSTENTADOR,
        "diet": Member.Diet.CARNIVORO,
        "observations": "",
        "children": [
            {
                "full_name": "Ana Souza",
                "diet": Member.Diet.VEGANO,
                "observations": "Não come leite.",
            },
            {
                "full_name": "Pedro Souza",
                "diet": Member.Diet.CARNIVORO,
                "observations": "",
            },
        ],
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 201
    registration = PublicRegistration.objects.get(email="joao@example.com")
    assert registration.children.count() == 2
    assert registration.children.first().full_name == "Ana Souza"


@pytest.mark.django_db
def test_public_registration_requires_role(api_client):
    url = reverse("public-registration-submit")
    payload = {
        "full_name": "Maria Silva",
        "diet": Member.Diet.CARNIVORO,
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 400
    assert "role" in response.data


@pytest.mark.django_db
def test_public_registration_requires_diet_for_adult(api_client):
    url = reverse("public-registration-submit")
    payload = {
        "full_name": "Maria Silva",
        "role": Member.Role.AVULSO,
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 400
    assert "diet" in response.data


@pytest.mark.django_db
def test_public_registration_requires_diet_for_child(api_client):
    url = reverse("public-registration-submit")
    payload = {
        "full_name": "Maria Silva",
        "role": Member.Role.AVULSO,
        "diet": Member.Diet.CARNIVORO,
        "children": [
            {
                "full_name": "Ana Silva",
            }
        ],
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 400
    assert "children" in response.data


@pytest.mark.django_db
def test_public_registration_rejects_duplicate_email(api_client):
    MemberFactory(email="dup@example.com")
    url = reverse("public-registration-submit")
    payload = {
        "full_name": "Maria Silva",
        "email": "DUP@example.com",
        "role": Member.Role.AVULSO,
        "diet": Member.Diet.CARNIVORO,
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 400
    assert "email" in response.data


@pytest.mark.django_db
def test_public_registration_admin_requires_authentication(api_client):
    url = reverse("public-registration-admin-list")

    response = api_client.get(url)

    assert response.status_code == 401


@pytest.mark.django_db
def test_superuser_can_list_public_registrations(api_client, superuser):
    PublicRegistrationFactory()
    PublicRegistrationFactory()
    api_client.force_authenticate(user=superuser)
    url = reverse("public-registration-admin-list")

    response = api_client.get(url)

    assert response.status_code == 200
    assert response.data["count"] == 2
    assert len(response.data["results"]) == 2


@pytest.mark.django_db
def test_approve_public_registration_creates_adult_and_children(api_client, superuser):
    registration = PublicRegistrationFactory(
        full_name="Carlos Lima",
        email="carlos@example.com",
        role=Member.Role.MENSALISTA,
        diet=Member.Diet.VEGETARIANO,
    )
    PublicRegistrationChildFactory(
        registration=registration,
        full_name="Lucas Lima",
        diet=Member.Diet.VEGANO,
        observations="Sem ovo.",
    )
    PublicRegistrationChildFactory(
        registration=registration,
        full_name="Laura Lima",
        diet=Member.Diet.CARNIVORO,
        observations="",
    )
    api_client.force_authenticate(user=superuser)
    url = reverse("public-registration-admin-approve", args=[registration.id])

    response = api_client.post(url, {}, format="json")

    assert response.status_code == 200
    registration.refresh_from_db()
    assert registration.status == PublicRegistration.Status.APROVADO

    adult = Member.objects.get(email="carlos@example.com")
    assert adult.is_child is False

    children = Member.objects.filter(responsible=adult).order_by("full_name")
    assert children.count() == 2
    assert children[0].is_child is True
    assert children[0].role is None


@pytest.mark.django_db
def test_reject_public_registration_updates_status_and_notes(api_client, superuser):
    registration = PublicRegistrationFactory()
    api_client.force_authenticate(user=superuser)
    url = reverse("public-registration-admin-reject", args=[registration.id])

    response = api_client.post(
        url,
        {"review_notes": "Dados incompletos para aprovação."},
        format="json",
    )

    assert response.status_code == 200
    registration.refresh_from_db()
    assert registration.status == PublicRegistration.Status.REJEITADO
    assert registration.review_notes == "Dados incompletos para aprovação."


@pytest.mark.django_db
def test_approve_public_registration_blocks_duplicate_email(api_client, superuser):
    MemberFactory(email="duplicado@example.com")
    registration = PublicRegistrationFactory(email="duplicado@example.com")
    api_client.force_authenticate(user=superuser)
    url = reverse("public-registration-admin-approve", args=[registration.id])

    response = api_client.post(url, {}, format="json")

    assert response.status_code == 400
    assert response.data["detail"] == "Já existe um integrante com este e-mail."
    registration.refresh_from_db()
    assert registration.status == PublicRegistration.Status.PENDENTE
