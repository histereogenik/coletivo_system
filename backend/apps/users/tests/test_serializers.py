import pytest

from apps.users.models import Member
from apps.users.serializers import MemberSerializer
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_member_serializer_validates_and_creates_member():
    payload = {
        "full_name": "Maria Silva",
        "phone": "+55 11 98888-7777",
        "email": "maria@example.com",
        "address": "Rua das Flores, 123",
        "heard_about": "Amigos",
        "role": Member.Role.SUSTENTADOR,
        "diet": Member.Diet.VEGETARIANO,
        "observations": "Prefere almoço aos sábados.",
    }

    serializer = MemberSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors

    instance = serializer.save()
    assert instance.pk is not None
    assert instance.email == payload["email"].lower()
    assert instance.full_name == payload["full_name"]
    assert instance.role == Member.Role.SUSTENTADOR
    assert instance.diet == Member.Diet.VEGETARIANO


@pytest.mark.django_db
def test_member_serializer_rejects_duplicate_email():
    member = MemberFactory(email="dup@example.com")

    serializer = MemberSerializer(
        data={
            "full_name": "Outro Nome",
            "phone": "12345678",
            "email": "DUP@example.com",
            "role": Member.Role.MENSALISTA,
            "diet": Member.Diet.CARNIVORO,
        }
    )

    assert not serializer.is_valid()
    assert "email" in serializer.errors
    assert "já existe" in serializer.errors["email"][0].lower()


@pytest.mark.django_db
def test_member_serializer_requires_role_and_diet():
    serializer = MemberSerializer(
        data={
            "full_name": "João Souza",
            "email": "joao@example.com",
        }
    )

    assert not serializer.is_valid()
    assert "role" in serializer.errors
    assert "diet" in serializer.errors
