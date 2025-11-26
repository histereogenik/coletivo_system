import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.financial.models import FinancialEntry
from apps.financial.tests.factories import FinancialEntryFactory

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
def test_superuser_can_create_financial_entry(api_client, superuser):
    api_client.force_authenticate(user=superuser)
    url = reverse("financial-entry-list")
    payload = {
        "entry_type": FinancialEntry.EntryType.ENTRADA,
        "category": FinancialEntry.EntryCategory.ALMOCO,
        "description": "Pagamento almoço",
        "value_cents": 2500,
        "date": "2025-12-10",
    }

    response = api_client.post(url, payload, format="json")

    assert response.status_code == 201
    assert response.data["entry_type"] == FinancialEntry.EntryType.ENTRADA
    assert response.data["value_cents"] == 2500


@pytest.mark.django_db
def test_non_superuser_forbidden(api_client):
    user = User.objects.create_user(username="user", email="user@example.com", password="123456")
    api_client.force_authenticate(user=user)
    url = reverse("financial-entry-list")

    response = api_client.get(url)

    assert response.status_code == 403


@pytest.mark.django_db
def test_filter_by_entry_type(api_client, superuser):
    FinancialEntryFactory(entry_type=FinancialEntry.EntryType.ENTRADA)
    FinancialEntryFactory(
        entry_type=FinancialEntry.EntryType.SAIDA, category=FinancialEntry.EntryCategory.DESPESA
    )

    api_client.force_authenticate(user=superuser)
    url = reverse("financial-entry-list")

    response = api_client.get(url, {"entry_type": FinancialEntry.EntryType.ENTRADA})

    assert response.status_code == 200
    assert all(item["entry_type"] == FinancialEntry.EntryType.ENTRADA for item in response.data)
