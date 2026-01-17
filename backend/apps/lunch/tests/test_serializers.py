from datetime import date, timedelta

import pytest

from apps.lunch.models import Lunch, Package
from apps.lunch.serializers import LunchSerializer, PackageSerializer
from apps.users.models import Member
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_package_serializer_sets_remaining_when_missing():
    member = MemberFactory(role=Member.Role.AVULSO)
    payload = {
        "member": member.id,
        "value_cents": 5000,
        "date": date.today(),
        "payment_status": Package.PaymentStatus.EM_ABERTO,
        "payment_mode": Package.PaymentMode.PIX,
        "quantity": 10,
        "expiration": date.today() + timedelta(days=30),
        "status": Package.PackageStatus.VALIDO,
    }

    serializer = PackageSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    assert instance.remaining_quantity == payload["quantity"]


@pytest.mark.django_db
def test_lunch_serializer_uses_oldest_package_when_use_package():
    member = MemberFactory()
    old_package = Package.objects.create(
        member=member,
        value_cents=10000,
        date=date.today() - timedelta(days=10),
        payment_status=Package.PaymentStatus.PAGO,
        payment_mode=Package.PaymentMode.PIX,
        quantity=5,
        remaining_quantity=5,
        expiration=date.today() + timedelta(days=30),
        status=Package.PackageStatus.VALIDO,
    )
    newer_package = Package.objects.create(
        member=member,
        value_cents=12000,
        date=date.today() - timedelta(days=2),
        payment_status=Package.PaymentStatus.PAGO,
        payment_mode=Package.PaymentMode.PIX,
        quantity=5,
        remaining_quantity=5,
        expiration=date.today() + timedelta(days=30),
        status=Package.PackageStatus.VALIDO,
    )
    payload = {
        "member": member.id,
        "value_cents": 3000,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.PAGO,
        "use_package": True,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    assert instance.package_id == old_package.id
    old_package.refresh_from_db()
    newer_package.refresh_from_db()
    assert old_package.remaining_quantity == 4
    assert newer_package.remaining_quantity == 5


@pytest.mark.django_db
def test_lunch_serializer_rejects_package_from_other_member():
    member = MemberFactory()
    other_member = MemberFactory()
    package = Package.objects.create(
        member=other_member,
        value_cents=10000,
        date=date.today(),
        payment_status=Package.PaymentStatus.PAGO,
        payment_mode=Package.PaymentMode.PIX,
        quantity=5,
        remaining_quantity=5,
        expiration=date.today() + timedelta(days=30),
        status=Package.PackageStatus.VALIDO,
    )
    payload = {
        "member": member.id,
        "package": package.id,
        "value_cents": 3000,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.PAGO,
    }

    serializer = LunchSerializer(data=payload)
    assert not serializer.is_valid()
    assert "package" in serializer.errors
