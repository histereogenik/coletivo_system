import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient


User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_password():
    return "strong-password"


@pytest.fixture
def user(user_password):
    return User.objects.create_user(
        username="testuser",
        email="testuser@example.com",
        password=user_password,
    )


@pytest.mark.django_db
def test_token_obtain_pair(api_client, user, user_password):
    url = reverse("token_obtain_pair")
    response = api_client.post(
        url,
        {"username": user.username, "password": user_password},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_token_refresh(api_client, user, user_password):
    obtain_url = reverse("token_obtain_pair")
    refresh_url = reverse("token_refresh")

    obtain_response = api_client.post(
        obtain_url,
        {"username": user.username, "password": user_password},
        format="json",
    )

    refresh = obtain_response.data["refresh"]
    response = api_client.post(refresh_url, {"refresh": refresh}, format="json")

    assert response.status_code == 200
    assert "access" in response.data


@pytest.mark.django_db
def test_token_obtain_pair_invalid_credentials(api_client):
    url = reverse("token_obtain_pair")
    response = api_client.post(url, {"username": "bad", "password": "wrong"}, format="json")

    assert response.status_code == 401
