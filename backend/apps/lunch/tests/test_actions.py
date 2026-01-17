import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.lunch.tests.factories import PackageFactory

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
    package = PackageFactory(quantity=5, remaining_quantity=5)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-decrement", args=[package.id])

    response = api_client.post(url, {"amount": 2}, format="json")

    assert response.status_code == 200
    package.refresh_from_db()
    assert package.remaining_quantity == 3


@pytest.mark.django_db
def test_decrement_fails_when_insufficient(api_client, superuser):
    package = PackageFactory(quantity=2, remaining_quantity=1)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-decrement", args=[package.id])

    response = api_client.post(url, {"amount": 2}, format="json")

    assert response.status_code == 400
    package.refresh_from_db()
    assert package.remaining_quantity == 1


@pytest.mark.django_db
def test_increment_package_quantity(api_client, superuser):
    package = PackageFactory(quantity=5, remaining_quantity=3)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-increment", args=[package.id])

    response = api_client.post(url, {"amount": 2}, format="json")

    assert response.status_code == 200
    package.refresh_from_db()
    assert package.remaining_quantity == 5


@pytest.mark.django_db
def test_increment_cannot_exceed_total(api_client, superuser):
    package = PackageFactory(quantity=5, remaining_quantity=4)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-increment", args=[package.id])

    response = api_client.post(url, {"amount": 5}, format="json")

    assert response.status_code == 400
    package.refresh_from_db()
    assert package.remaining_quantity == 4
