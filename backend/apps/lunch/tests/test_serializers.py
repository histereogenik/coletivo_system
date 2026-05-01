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
        "unit_value_cents": 500,
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


@pytest.mark.django_db
def test_lunch_serializer_creates_package_entry_with_beneficiary():
    owner = MemberFactory()
    beneficiary = MemberFactory()
    package = Package.objects.create(
        member=owner,
        value_cents=10000,
        unit_value_cents=2000,
        date=date.today(),
        payment_status=Package.PaymentStatus.PAGO,
        payment_mode=Package.PaymentMode.PIX,
        quantity=5,
        remaining_quantity=5,
        expiration=date.today() + timedelta(days=30),
        status=Package.PackageStatus.VALIDO,
    )
    payload = {
        "member": owner.id,
        "package": package.id,
        "package_beneficiary": beneficiary.id,
        "value_cents": package.unit_value_cents,
        "date": date.today(),
        "payment_status": Lunch.PaymentStatus.PAGO,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    instance = serializer.save()

    package.refresh_from_db()
    assert package.remaining_quantity == 4
    assert instance.package_beneficiary == beneficiary
    assert instance.package_entry.beneficiary == beneficiary


@pytest.mark.django_db
def test_lunch_serializer_updates_package_entry_beneficiary_without_changing_package():
    owner = MemberFactory()
    first_beneficiary = MemberFactory()
    second_beneficiary = MemberFactory()
    package = Package.objects.create(
        member=owner,
        value_cents=10000,
        unit_value_cents=2000,
        date=date.today(),
        payment_status=Package.PaymentStatus.PAGO,
        payment_mode=Package.PaymentMode.PIX,
        quantity=5,
        remaining_quantity=5,
        expiration=date.today() + timedelta(days=30),
        status=Package.PackageStatus.VALIDO,
    )
    serializer = LunchSerializer(
        data={
            "member": owner.id,
            "package": package.id,
            "package_beneficiary": first_beneficiary.id,
            "value_cents": package.unit_value_cents,
            "date": date.today(),
            "payment_status": Lunch.PaymentStatus.PAGO,
        }
    )
    assert serializer.is_valid(), serializer.errors
    lunch = serializer.save()

    update_serializer = LunchSerializer(
        lunch,
        data={"package_beneficiary": second_beneficiary.id},
        partial=True,
    )
    assert update_serializer.is_valid(), update_serializer.errors
    updated = update_serializer.save()

    package.refresh_from_db()
    updated.refresh_from_db()
    assert package.remaining_quantity == 4
    assert updated.package_beneficiary == second_beneficiary
    assert updated.package_entry.beneficiary == second_beneficiary
