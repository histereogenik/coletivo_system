import pytest
from django.contrib.auth import get_user_model
from rest_framework.reverse import reverse
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def csrf_api_client():
    return APIClient(enforce_csrf_checks=True)


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
def test_legacy_bearer_token_endpoints_are_removed(api_client):
    assert api_client.post("/api/auth/token/", {}, format="json").status_code == 404
    assert api_client.post("/api/auth/token/refresh/", {}, format="json").status_code == 404


@pytest.mark.django_db
def test_csrf_endpoint_sets_cookie(csrf_api_client):
    url = reverse("auth_csrf")

    response = csrf_api_client.get(url)

    assert response.status_code == 200
    assert "csrftoken" in response.cookies


@pytest.mark.django_db
def test_cookie_token_obtain_pair_requires_csrf(csrf_api_client, user, user_password):
    url = reverse("cookie_token_obtain_pair")

    response = csrf_api_client.post(
        url,
        {"username": user.username, "password": user_password},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_cookie_token_obtain_pair_with_csrf_succeeds(csrf_api_client, user, user_password):
    csrf_response = csrf_api_client.get(reverse("auth_csrf"))
    csrf_token = csrf_response.cookies["csrftoken"].value

    response = csrf_api_client.post(
        reverse("cookie_token_obtain_pair"),
        {"username": user.username, "password": user_password},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    assert response.status_code == 200
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies
    assert response.data == {"detail": "Login realizado com sucesso."}
    assert "access" not in response.data
    assert "refresh" not in response.data


@pytest.mark.django_db
def test_cookie_token_refresh_requires_csrf(csrf_api_client, user, user_password):
    login_response = csrf_api_client.get(reverse("auth_csrf"))
    csrf_token = login_response.cookies["csrftoken"].value

    csrf_api_client.post(
        reverse("cookie_token_obtain_pair"),
        {"username": user.username, "password": user_password},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    refresh_response = csrf_api_client.post(reverse("cookie_token_refresh"), format="json")

    assert refresh_response.status_code == 403


@pytest.mark.django_db
def test_cookie_token_refresh_uses_cookie_and_hides_tokens(csrf_api_client, user, user_password):
    csrf_response = csrf_api_client.get(reverse("auth_csrf"))
    csrf_token = csrf_response.cookies["csrftoken"].value

    login_response = csrf_api_client.post(
        reverse("cookie_token_obtain_pair"),
        {"username": user.username, "password": user_password},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    refreshed_csrf_token = login_response.cookies["csrftoken"].value

    response = csrf_api_client.post(
        reverse("cookie_token_refresh"),
        format="json",
        HTTP_X_CSRFTOKEN=refreshed_csrf_token,
    )

    assert response.status_code == 200
    assert response.data == {"detail": "Sessao renovada com sucesso."}
    assert "access" not in response.data
    assert "refresh" not in response.data
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies
