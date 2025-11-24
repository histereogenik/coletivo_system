import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.lunch.models import Lunch
from apps.lunch.tests.factories import LunchFactory


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
def test_decrement_package_quantity(api_client, superuser):
    lunch = LunchFactory(
        lunch_type=Lunch.LunchType.PACOTE,
        quantity=5,
        remaining_quantity=5,
        package_expiration="2025-12-31",
        package_status=Lunch.PackageStatus.VALIDO,
    )
    api_client.force_authenticate(user=superuser)
    url = reverse("lunch-decrement", args=[lunch.id])

    response = api_client.post(url, {"amount": 2}, format="json")

    assert response.status_code == 200
    lunch.refresh_from_db()
    assert lunch.remaining_quantity == 3


@pytest.mark.django_db
def test_decrement_fails_when_insufficient(api_client, superuser):
    lunch = LunchFactory(
        lunch_type=Lunch.LunchType.PACOTE,
        quantity=2,
        remaining_quantity=1,
        package_expiration="2025-12-31",
        package_status=Lunch.PackageStatus.VALIDO,
    )
    api_client.force_authenticate(user=superuser)
    url = reverse("lunch-decrement", args=[lunch.id])

    response = api_client.post(url, {"amount": 2}, format="json")

    assert response.status_code == 400
    lunch.refresh_from_db()
    assert lunch.remaining_quantity == 1


@pytest.mark.django_db
def test_increment_package_quantity(api_client, superuser):
    lunch = LunchFactory(
        lunch_type=Lunch.LunchType.PACOTE,
        quantity=5,
        remaining_quantity=3,
        package_expiration="2025-12-31",
        package_status=Lunch.PackageStatus.VALIDO,
    )
    api_client.force_authenticate(user=superuser)
    url = reverse("lunch-increment", args=[lunch.id])

    response = api_client.post(url, {"amount": 2}, format="json")

    assert response.status_code == 200
    lunch.refresh_from_db()
    assert lunch.remaining_quantity == 5


@pytest.mark.django_db
def test_increment_cannot_exceed_total(api_client, superuser):
    lunch = LunchFactory(
        lunch_type=Lunch.LunchType.PACOTE,
        quantity=5,
        remaining_quantity=4,
        package_expiration="2025-12-31",
        package_status=Lunch.PackageStatus.VALIDO,
    )
    api_client.force_authenticate(user=superuser)
    url = reverse("lunch-increment", args=[lunch.id])

    response = api_client.post(url, {"amount": 5}, format="json")

    assert response.status_code == 400
    lunch.refresh_from_db()
    assert lunch.remaining_quantity == 4


@pytest.mark.django_db
def test_actions_reject_non_package(api_client, superuser):
    lunch = LunchFactory(lunch_type=Lunch.LunchType.AVULSO, payment_status=Lunch.PaymentStatus.PAGO)
    api_client.force_authenticate(user=superuser)

    dec_url = reverse("lunch-decrement", args=[lunch.id])
    inc_url = reverse("lunch-increment", args=[lunch.id])

    dec_response = api_client.post(dec_url, {"amount": 1}, format="json")
    inc_response = api_client.post(inc_url, {"amount": 1}, format="json")

    assert dec_response.status_code == 400
    assert inc_response.status_code == 400
