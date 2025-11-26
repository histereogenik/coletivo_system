from datetime import date

import pytest

from apps.lunch.models import Lunch
from apps.lunch.serializers import LunchSerializer
from apps.users.models import Member
from apps.users.tests.factories import MemberFactory


@pytest.mark.django_db
def test_package_purchase_promotes_to_mensalista_when_not_sustentador():
    member = MemberFactory(role=Member.Role.AVULSO)
    payload = {
        "member": member.id,
        "value_cents": 1000,
        "date": date.today(),
        "lunch_type": Lunch.LunchType.PACOTE,
        "payment_status": Lunch.PaymentStatus.PAGO,
        "quantity": 5,
        "package_expiration": date.today(),
        "package_status": Lunch.PackageStatus.VALIDO,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    member.refresh_from_db()
    assert member.role == Member.Role.MENSALISTA


@pytest.mark.django_db
def test_package_purchase_keeps_sustentador_priority():
    member = MemberFactory(role=Member.Role.SUSTENTADOR)
    payload = {
        "member": member.id,
        "value_cents": 1000,
        "date": date.today(),
        "lunch_type": Lunch.LunchType.PACOTE,
        "payment_status": Lunch.PaymentStatus.PAGO,
        "quantity": 5,
        "package_expiration": date.today(),
        "package_status": Lunch.PackageStatus.VALIDO,
    }

    serializer = LunchSerializer(data=payload)
    assert serializer.is_valid(), serializer.errors
    serializer.save()

    member.refresh_from_db()
    assert member.role == Member.Role.SUSTENTADOR
