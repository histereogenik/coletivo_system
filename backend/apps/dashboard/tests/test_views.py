from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.financial.models import FinancialEntry
from apps.financial.tests.factories import FinancialEntryFactory
from apps.lunch.tests.factories import LunchFactory
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
def test_dashboard_summary(api_client, superuser):
    today = timezone.now().date()
    # Members
    MemberFactory(role=Member.Role.SUSTENTADOR)
    MemberFactory(role=Member.Role.MENSALISTA)
    MemberFactory(role=Member.Role.AVULSO)

    # Financial entries (this month and outside)
    FinancialEntryFactory(
        entry_type=FinancialEntry.EntryType.ENTRADA,
        category=FinancialEntry.EntryCategory.DOACAO,
        value_cents=1000,
        date=today,
    )
    FinancialEntryFactory(
        entry_type=FinancialEntry.EntryType.SAIDA,
        category=FinancialEntry.EntryCategory.DESPESA,
        value_cents=400,
        date=today,
    )
    # Outside current month (should be ignored in balance)
    FinancialEntryFactory(
        entry_type=FinancialEntry.EntryType.ENTRADA,
        category=FinancialEntry.EntryCategory.DOACAO,
        value_cents=999,
        date=today - timedelta(days=40),
    )

    # Lunches last 30 days
    LunchFactory(date=today, payment_status="PAGO")
    LunchFactory(date=today - timedelta(days=1), payment_status="EM_ABERTO")

    url = reverse("dashboard-summary")
    response = api_client.get(url)

    assert response.status_code == 200
    data = response.data
    assert data["monthly_balance_cents"] == 600  # 1000 - 400
    assert data["members"]["total"] >= 3
    assert data["members"]["sustentadores"] >= 1
    assert data["members"]["mensalistas"] >= 1
    assert data["members"]["avulsos"] >= 1
    assert data["lunches"]["total"] >= 2
    assert data["lunches"]["total_em_aberto"] >= 1
