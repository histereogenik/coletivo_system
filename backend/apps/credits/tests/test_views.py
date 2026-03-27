import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.credits.models import CreditEntry
from apps.credits.tests.factories import CreditEntryFactory
from apps.users.tests.factories import MemberFactory

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def superuser():
    return User.objects.create_superuser(
        username="credits-admin",
        email="credits-admin@example.com",
        password="strong-password",
    )


@pytest.mark.django_db
def test_anonymous_cannot_access_credit_entries(api_client):
    response = api_client.get(reverse("credit-entry-list"))

    assert response.status_code == 401


@pytest.mark.django_db
def test_superuser_can_list_credit_entries(api_client, superuser):
    CreditEntryFactory()
    CreditEntryFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.get(reverse("credit-entry-list"))

    assert response.status_code == 200
    assert response.data["count"] == 2


@pytest.mark.django_db
def test_superuser_can_create_manual_credit(api_client, superuser):
    owner = MemberFactory()
    beneficiary = MemberFactory()
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("credit-manual-credit"),
        {
            "owner": owner.id,
            "beneficiary": beneficiary.id,
            "value_cents": 2000,
            "description": "Crédito manual de apoio à equipe.",
        },
        format="json",
    )

    assert response.status_code == 201
    entry = CreditEntry.objects.get(origin=CreditEntry.Origin.MANUAL)
    assert entry.entry_type == CreditEntry.EntryType.CREDITO
    assert entry.created_by == superuser


@pytest.mark.django_db
def test_manual_debit_blocks_balance_overflow(api_client, superuser):
    owner = MemberFactory()
    CreditEntryFactory(owner=owner, beneficiary=owner, value_cents=1000)
    api_client.force_authenticate(user=superuser)

    response = api_client.post(
        reverse("credit-manual-debit"),
        {
            "owner": owner.id,
            "value_cents": 1500,
            "description": "Ajuste manual acima do saldo.",
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.data["owner"] == ["Saldo de créditos insuficiente para este lançamento."]


@pytest.mark.django_db
def test_credit_summary_returns_owner_balance(api_client, superuser):
    owner = MemberFactory()
    beneficiary = MemberFactory()
    CreditEntryFactory(owner=owner, beneficiary=owner, value_cents=3000)
    CreditEntryFactory(
        owner=owner,
        beneficiary=beneficiary,
        value_cents=1200,
        entry_type=CreditEntry.EntryType.DEBITO,
    )
    api_client.force_authenticate(user=superuser)

    response = api_client.get(reverse("credit-summary"), {"owner": owner.id})

    assert response.status_code == 200
    assert response.data["owner"] == owner.id
    assert response.data["credits_cents"] == 3000
    assert response.data["debits_cents"] == 1200
    assert response.data["balance_cents"] == 1800
