from datetime import date, timedelta

import pytest

from apps.lunch.models import Lunch
from apps.lunch.serializers import LunchSerializer
from apps.users.models import Member
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_lunch_serializer_creates_avulso_without_package_fields():
    member = MemberFactory()
    payload = {
        "member": member.id,
        "value_cents": 3500,
        "date": date.today(),
        "lunch_type": Lunch.LunchType.AVULSO,
        "payment_status": Lunch.PaymentStatus.PAGO,
        "quantity": 5,
        "package_expiration": date.today() + timedelta(days=30),
        "package_status": Lunch.PackageStatus.VALIDO,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    assert instance.lunch_type == Lunch.LunchType.AVULSO
    assert instance.quantity is None
    assert instance.package_expiration is None
    assert instance.package_status is None


@pytest.mark.django_db
def test_lunch_serializer_requires_package_fields_for_pacote():
    member = MemberFactory()
    payload = {
        "member": member.id,
        "value_cents": 4500,
        "date": date.today(),
        "lunch_type": Lunch.LunchType.PACOTE,
        "payment_status": Lunch.PaymentStatus.EM_ABERTO,
    }

    serializer = LunchSerializer(data=payload)
    assert not serializer.is_valid()
    assert "quantity" in serializer.errors
    assert "package_expiration" in serializer.errors
    assert "package_status" in serializer.errors


@pytest.mark.django_db
def test_lunch_serializer_creates_pacote_when_fields_present():
    member = MemberFactory(role=Member.Role.AVULSO)
    payload = {
        "member": member.id,
        "value_cents": 5000,
        "date": date.today(),
        "lunch_type": Lunch.LunchType.PACOTE,
        "payment_status": Lunch.PaymentStatus.EM_ABERTO,
        "quantity": 10,
        "package_expiration": date.today() + timedelta(days=60),
        "package_status": Lunch.PackageStatus.VALIDO,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    member.refresh_from_db()
    assert member.role == Member.Role.MENSALISTA
    assert instance.quantity == payload["quantity"]
    assert instance.package_expiration == payload["package_expiration"]
    assert instance.package_status == payload["package_status"]


@pytest.mark.django_db
def test_lunch_serializer_requires_positive_value():
    member = MemberFactory()
    payload = {
        "member": member.id,
        "value_cents": 0,
        "date": date.today(),
        "lunch_type": Lunch.LunchType.AVULSO,
        "payment_status": Lunch.PaymentStatus.PAGO,
    }

    serializer = LunchSerializer(data=payload)
    assert not serializer.is_valid()
    assert "value_cents" in serializer.errors
