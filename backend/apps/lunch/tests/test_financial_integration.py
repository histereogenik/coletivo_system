from datetime import date

import pytest

from apps.financial.models import FinancialEntry
from apps.lunch.models import Lunch, Package
from apps.lunch.serializers import LunchSerializer, PackageSerializer
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_paid_lunch_creates_financial_entry():
    member = MemberFactory()
    lunch_date = date(2026, 1, 18)
    payload = {
        "member": member.id,
        "value_cents": 3000,
        "date": lunch_date,
        "payment_status": Lunch.PaymentStatus.PAGO,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    entry = FinancialEntry.objects.get(lunch=instance)
    assert entry.value_cents == payload["value_cents"]
    assert entry.entry_type == FinancialEntry.EntryType.ENTRADA
    assert entry.category == FinancialEntry.EntryCategory.ALMOCO
    assert entry.description == f"Pagamento almoço - {member.full_name} - 18/01/2026"


@pytest.mark.django_db
def test_paid_package_creates_financial_entry_with_pt_br_date():
    member = MemberFactory()
    payload = {
        "member": member.id,
        "unit_value_cents": 1000,
        "date": date(2026, 1, 18),
        "payment_status": Package.PaymentStatus.PAGO,
        "payment_mode": Package.PaymentMode.PIX,
        "quantity": 5,
        "expiration": date(2026, 2, 18),
    }

    serializer = PackageSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    package = serializer.save()

    entry = FinancialEntry.objects.get(package=package)
    assert entry.description == f"Pagamento pacote - {member.full_name} - 18/01/2026"


@pytest.mark.django_db
def test_updating_to_paid_creates_financial_entry():
    member = MemberFactory()
    payload = {
        "member": member.id,
        "value_cents": 4000,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.EM_ABERTO,
    }
    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()
    assert FinancialEntry.objects.filter(lunch=instance).count() == 0

    update_serializer = LunchSerializer(
        instance, data={"payment_status": Lunch.PaymentStatus.PAGO}, partial=True
    )
    assert update_serializer.is_valid(), update_serializer.errors
    updated = update_serializer.save()

    entry = FinancialEntry.objects.get(lunch=updated)
    assert entry.value_cents == payload["value_cents"]


@pytest.mark.django_db
def test_reverting_paid_deletes_financial_entry():
    member = MemberFactory()
    payload = {
        "member": member.id,
        "value_cents": 3500,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.PAGO,
    }
    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()
    assert FinancialEntry.objects.filter(lunch=instance).count() == 1

    update_serializer = LunchSerializer(
        instance, data={"payment_status": Lunch.PaymentStatus.EM_ABERTO}, partial=True
    )
    assert update_serializer.is_valid(), update_serializer.errors
    update_serializer.save()

    assert FinancialEntry.objects.filter(lunch=instance).count() == 0
