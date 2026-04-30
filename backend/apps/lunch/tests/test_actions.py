import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

from apps.lunch.models import Lunch, PackageEntry
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


@pytest.mark.django_db
def test_manual_package_debit_requires_description(api_client, superuser):
    package = PackageFactory(quantity=5, remaining_quantity=5)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-adjust", args=[package.id])

    response = api_client.post(
        url,
        {"entry_type": PackageEntry.EntryType.DEBITO, "quantity": 1, "description": ""},
        format="json",
    )

    assert response.status_code == 400
    assert "description" in response.data
    package.refresh_from_db()
    assert package.remaining_quantity == 5


@pytest.mark.django_db
def test_manual_package_debit_creates_history_entry(api_client, superuser):
    package = PackageFactory(quantity=5, remaining_quantity=5)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-adjust", args=[package.id])

    response = api_client.post(
        url,
        {
            "entry_type": PackageEntry.EntryType.DEBITO,
            "quantity": 2,
            "description": "Ajuste por uso registrado fora do sistema",
        },
        format="json",
    )

    assert response.status_code == 200
    package.refresh_from_db()
    assert package.remaining_quantity == 3
    entry = PackageEntry.objects.get(package=package)
    assert entry.entry_type == PackageEntry.EntryType.DEBITO
    assert entry.origin == PackageEntry.Origin.MANUAL
    assert entry.quantity == 2
    assert entry.description == "Ajuste por uso registrado fora do sistema"
    assert entry.created_by == superuser


@pytest.mark.django_db
def test_package_history_includes_lunch_usage(api_client, superuser):
    package = PackageFactory(quantity=5, remaining_quantity=5)
    beneficiary = MemberFactory()
    lunch = LunchFactory(member=package.member, package=package)
    PackageEntry.objects.create(
        package=package,
        entry_type=PackageEntry.EntryType.DEBITO,
        origin=PackageEntry.Origin.LUNCH,
        quantity=1,
        description="Uso em almoço",
        lunch=lunch,
        beneficiary=beneficiary,
    )
    api_client.force_authenticate(user=superuser)
    url = reverse("package-history", args=[package.id])

    response = api_client.get(url)

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["origin"] == PackageEntry.Origin.LUNCH
    assert response.data["results"][0]["lunch"] == lunch.id
    assert response.data["results"][0]["beneficiary"] == beneficiary.id
    assert response.data["results"][0]["beneficiary_name"] == beneficiary.full_name


@pytest.mark.django_db
def test_package_quantity_update_preserves_used_amount(api_client, superuser):
    package = PackageFactory(quantity=6, remaining_quantity=6, unit_value_cents=1000)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-detail", args=[package.id])

    response = api_client.patch(url, {"quantity": 5}, format="json")

    assert response.status_code == 200
    package.refresh_from_db()
    assert package.quantity == 5
    assert package.remaining_quantity == 5
    assert package.value_cents == 5000


@pytest.mark.django_db
def test_package_quantity_update_ignores_stale_remaining_quantity(api_client, superuser):
    package = PackageFactory(quantity=6, remaining_quantity=6, unit_value_cents=1000)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-detail", args=[package.id])

    response = api_client.patch(url, {"quantity": 5, "remaining_quantity": 6}, format="json")

    assert response.status_code == 200
    package.refresh_from_db()
    assert package.quantity == 5
    assert package.remaining_quantity == 5
    assert package.value_cents == 5000


@pytest.mark.django_db
def test_package_quantity_update_cannot_be_less_than_used(api_client, superuser):
    package = PackageFactory(quantity=6, remaining_quantity=4, unit_value_cents=1000)
    api_client.force_authenticate(user=superuser)
    url = reverse("package-detail", args=[package.id])

    response = api_client.patch(url, {"quantity": 1}, format="json")

    assert response.status_code == 400
    assert "quantity" in response.data
    package.refresh_from_db()
    assert package.quantity == 6
    assert package.remaining_quantity == 4


@pytest.mark.django_db
def test_delete_lunch_with_package_restores_package_balance(api_client, superuser):
    package = PackageFactory(quantity=5, remaining_quantity=5)
    api_client.force_authenticate(user=superuser)
    create_url = reverse("lunch-list")
    create_response = api_client.post(
        create_url,
        {
            "member": package.member_id,
            "package": package.id,
            "value_cents": package.unit_value_cents,
            "date": "2026-01-18",
            "payment_status": Lunch.PaymentStatus.PAGO,
            "payment_mode": Lunch.PaymentMode.PIX,
        },
        format="json",
    )
    assert create_response.status_code == 201
    package.refresh_from_db()
    assert package.remaining_quantity == 4
    assert PackageEntry.objects.filter(package=package).count() == 1

    delete_url = reverse("lunch-detail", args=[create_response.data["id"]])
    delete_response = api_client.delete(delete_url)

    assert delete_response.status_code == 204
    package.refresh_from_db()
    assert package.remaining_quantity == 5
    assert PackageEntry.objects.filter(package=package).count() == 0
