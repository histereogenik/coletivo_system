from datetime import date

import pytest

from apps.lunch.models import Package
from apps.lunch.serializers import PackageSerializer
from apps.users.models import Member
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_package_purchase_promotes_to_mensalista_when_not_sustentador():
    member = MemberFactory(role=Member.Role.AVULSO)
    payload = {
        "member": member.id,
        "unit_value_cents": 200,
        "date": date.today(),
        "payment_status": Package.PaymentStatus.PAGO,
        "payment_mode": Package.PaymentMode.PIX,
        "quantity": 5,
        "expiration": date.today(),
        "status": Package.PackageStatus.VALIDO,
    }

    serializer = PackageSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    member.refresh_from_db()
    assert member.role == Member.Role.MENSALISTA


@pytest.mark.django_db
def test_package_purchase_keeps_sustentador_priority():
    member = MemberFactory(role=Member.Role.SUSTENTADOR)
    payload = {
        "member": member.id,
        "unit_value_cents": 200,
        "date": date.today(),
        "payment_status": Package.PaymentStatus.PAGO,
        "payment_mode": Package.PaymentMode.PIX,
        "quantity": 5,
        "expiration": date.today(),
        "status": Package.PackageStatus.VALIDO,
    }

    serializer = PackageSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    member.refresh_from_db()
    assert member.role == Member.Role.SUSTENTADOR
