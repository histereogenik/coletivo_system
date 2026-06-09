import pytest
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.lunch.models import Lunch, Package
from apps.lunch.tests.factories import LunchFactory, PackageFactory
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


@pytest.fixture
def member():
    return MemberFactory()


@pytest.mark.django_db
def test_superuser_can_filter_lunches_by_member(api_client, superuser, member):
    other_member = MemberFactory()
    lunch1 = LunchFactory(member=member, payment_status=Lunch.PaymentStatus.PAGO)
    LunchFactory(member=other_member, payment_status=Lunch.PaymentStatus.EM_ABERTO)

    api_client.force_authenticate(user=superuser)
    url = reverse("lunch-list")

    response = api_client.get(url, {"member": member.id})

    assert response.status_code == 200
    ids = {item["id"] for item in response.data}
    assert lunch1.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_superuser_can_filter_lunches_by_payment_status(api_client, superuser):
    lunch_paid = LunchFactory(payment_status=Lunch.PaymentStatus.PAGO)
    LunchFactory(payment_status=Lunch.PaymentStatus.EM_ABERTO)

    api_client.force_authenticate(user=superuser)
    url = reverse("lunch-list")
    response = api_client.get(url, {"payment_status": Lunch.PaymentStatus.PAGO})

    assert response.status_code == 200
    ids = {item["id"] for item in response.data}
    assert lunch_paid.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_superuser_can_filter_lunches_by_package(api_client, superuser):
    package = PackageFactory()
    lunch_with_package = LunchFactory(package=package)
    LunchFactory(package=None)

    api_client.force_authenticate(user=superuser)
    url = reverse("lunch-list")
    response = api_client.get(url, {"package": package.id})

    assert response.status_code == 200
    ids = {item["id"] for item in response.data}
    assert lunch_with_package.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_superuser_can_filter_packages_by_dynamic_status(api_client, superuser):
    today = timezone.localdate()
    valid_package = PackageFactory(
        remaining_quantity=5,
        expiration=today + timedelta(days=30),
    )
    expired_package = PackageFactory(
        remaining_quantity=5,
        expiration=today + timedelta(days=30),
    )
    exhausted_package = PackageFactory(
        remaining_quantity=5,
        expiration=today + timedelta(days=30),
    )
    Package.objects.filter(id=expired_package.id).update(
        expiration=today - timedelta(days=1),
        status=Package.PackageStatus.VALIDO,
    )
    Package.objects.filter(id=exhausted_package.id).update(
        remaining_quantity=0,
        status=Package.PackageStatus.VALIDO,
    )

    api_client.force_authenticate(user=superuser)
    url = reverse("package-list")
    valid_response = api_client.get(url, {"status": Package.PackageStatus.VALIDO})
    expired_response = api_client.get(url, {"status": Package.PackageStatus.EXPIRADO})
    exhausted_response = api_client.get(url, {"status": Package.PackageStatus.ESGOTADO})

    assert valid_response.status_code == 200
    assert expired_response.status_code == 200
    assert exhausted_response.status_code == 200
    assert {item["id"] for item in valid_response.data} == {valid_package.id}
    assert {item["id"] for item in expired_response.data} == {expired_package.id}
    assert {item["id"] for item in exhausted_response.data} == {exhausted_package.id}


@pytest.mark.django_db
def test_non_superuser_forbidden(api_client):
    user = User.objects.create_user(username="user", email="user@example.com", password="123456")
    api_client.force_authenticate(user=user)
    url = reverse("lunch-list")

    response = api_client.get(url)

    assert response.status_code == 403


@pytest.mark.django_db
def test_delete_package_referenced_by_lunch_returns_conflict(api_client, superuser):
    package = PackageFactory()
    LunchFactory(member=package.member, package=package)

    api_client.force_authenticate(user=superuser)
    url = reverse("package-detail", args=[package.id])

    response = api_client.delete(url)

    assert response.status_code == 409
    assert response.data == {
        "detail": "Não é possível excluir este registro porque ele está vinculado a outros dados."
    }
