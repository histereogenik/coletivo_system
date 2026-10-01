import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.authentication.capabilities import set_user_capabilities
from apps.authentication.models import OperatorProfile
from apps.common.models import AuditEvent
from apps.credits.tests.factories import CreditEntryFactory
from apps.financial.models import FinancialEntry
from apps.lunch.tests.factories import LunchFactory, PackageFactory

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def superuser():
    return User.objects.create_superuser(username="principal", password="strong-admin-password")


@pytest.mark.django_db
def test_superuser_creates_operator_with_selected_capabilities(client, superuser):
    client.force_authenticate(superuser)

    response = client.post(
        "/api/auth/operators/",
        {
            "username": "cozinha",
            "first_name": "Pessoa",
            "last_name": "Cozinha",
            "password": "a-secure-operator-password",
            "is_active": True,
            "capabilities": ["lunches", "packages", "agenda"],
        },
        format="json",
    )

    assert response.status_code == 201
    operator = User.objects.get(username="cozinha")
    assert not operator.is_superuser
    assert operator.check_password("a-secure-operator-password")
    assert operator.has_perm("authentication.manage_lunches")
    assert operator.has_perm("authentication.manage_packages")
    assert operator.has_perm("authentication.manage_agenda")
    assert not operator.has_perm("authentication.manage_financial")
    assert OperatorProfile.objects.filter(user=operator, created_by=superuser).exists()
    assert AuditEvent.objects.filter(
        actor=superuser,
        action=AuditEvent.Action.CREATE,
        entity_type="auth.User",
        object_id=str(operator.pk),
    ).exists()


@pytest.mark.django_db
def test_non_superuser_cannot_manage_operator_accounts(client):
    operator = User.objects.create_user(username="operator", password="operator-password")
    client.force_authenticate(operator)

    assert client.get("/api/auth/operators/").status_code == 403


@pytest.mark.django_db
def test_superuser_updates_operator_capabilities(client, superuser):
    operator = User.objects.create_user(username="gestora", password="operator-password")
    OperatorProfile.objects.create(user=operator, created_by=superuser)
    set_user_capabilities(operator, ["lunches"])
    refresh = RefreshToken.for_user(operator)
    client.force_authenticate(superuser)

    response = client.patch(
        f"/api/auth/operators/{operator.pk}/",
        {"capabilities": ["financial"], "is_active": True},
        format="json",
    )

    assert response.status_code == 200
    operator.refresh_from_db()
    assert operator.has_perm("authentication.manage_financial")
    assert not operator.has_perm("authentication.manage_lunches")
    assert response.data["granted_capabilities"] == ["financial"]
    assert BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "update_payload",
    [
        {"capabilities": ["financial"]},
        {"password": "new-secure-operator-password"},
    ],
)
def test_security_change_immediately_revokes_operator_access_token(
    client, superuser, update_payload
):
    operator = User.objects.create_user(username="sessao", password="old-operator-password")
    OperatorProfile.objects.create(user=operator, created_by=superuser)
    set_user_capabilities(operator, ["lunches"])
    operator_client = APIClient(enforce_csrf_checks=True)
    csrf_response = operator_client.get("/api/auth/csrf/")
    csrf_token = csrf_response.cookies["csrftoken"].value
    login_response = operator_client.post(
        "/api/auth/cookie/token/",
        {"username": operator.username, "password": "old-operator-password"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    assert login_response.status_code == 200
    assert operator_client.get("/api/auth/status/").status_code == 200

    client.force_authenticate(superuser)
    update_response = client.patch(
        f"/api/auth/operators/{operator.pk}/",
        update_payload,
        format="json",
    )

    assert update_response.status_code == 200
    revoked_response = operator_client.get("/api/auth/status/")
    assert revoked_response.status_code == 401
    assert revoked_response.data["code"] == "token_not_valid"


@pytest.mark.django_db
def test_superuser_password_change_revokes_operator_sessions(client, superuser):
    operator = User.objects.create_user(username="gestora", password="old-operator-password")
    OperatorProfile.objects.create(user=operator, created_by=superuser)
    set_user_capabilities(operator, ["lunches"])
    refresh = RefreshToken.for_user(operator)
    client.force_authenticate(superuser)

    response = client.patch(
        f"/api/auth/operators/{operator.pk}/",
        {"password": "new-secure-operator-password"},
        format="json",
    )

    assert response.status_code == 200
    operator.refresh_from_db()
    assert operator.check_password("new-secure-operator-password")
    assert BlacklistedToken.objects.filter(token__jti=refresh["jti"]).exists()
    audit_event = AuditEvent.objects.get(
        actor=superuser,
        action=AuditEvent.Action.UPDATE,
        entity_type="auth.User",
        object_id=str(operator.pk),
    )
    assert audit_event.changes["password_changed"] is True
    assert "password" not in audit_event.changes


@pytest.mark.django_db
def test_operator_partial_update_does_not_require_capabilities(client, superuser):
    operator = User.objects.create_user(username="atendimento", password="operator-password")
    OperatorProfile.objects.create(user=operator, created_by=superuser)
    set_user_capabilities(operator, ["lunches"])
    client.force_authenticate(superuser)

    response = client.patch(
        f"/api/auth/operators/{operator.pk}/",
        {"is_active": False},
        format="json",
    )

    assert response.status_code == 200
    operator.refresh_from_db()
    assert operator.is_active is False
    assert operator.user_permissions.filter(codename="manage_lunches").exists()


@pytest.mark.django_db
def test_operator_can_only_access_selected_area(client):
    operator = User.objects.create_user(username="almoco", password="operator-password")
    set_user_capabilities(operator, ["lunches"])
    credit = CreditEntryFactory()
    client.force_authenticate(operator)

    assert client.get("/api/lunch/lunches/").status_code == 200
    assert client.get("/api/lunch/packages/").status_code == 403
    assert client.get("/api/financial/entries/").status_code == 403
    assert client.get("/api/users/member-options/").status_code == 200
    assert client.get("/api/users/members/").status_code == 403
    assert client.get("/api/credits/summary/").status_code == 403
    owner_options_response = client.get("/api/credits/owner-options/")
    assert owner_options_response.status_code == 200
    option = next(
        item for item in owner_options_response.data["results"] if item["owner"] == credit.owner_id
    )
    assert set(option) == {"owner", "owner_name", "balance_cents"}
    lunch_owner_options_response = client.get("/api/lunch/credit-owner-options/")
    assert lunch_owner_options_response.status_code == 200
    assert any(
        item["owner"] == credit.owner_id
        for item in lunch_owner_options_response.data["results"]
    )
    assert client.get("/api/dashboard/summary/").status_code == 403


@pytest.mark.django_db
def test_lunches_and_packages_are_independent_capabilities(client):
    package_operator = User.objects.create_user(username="pacotes", password="operator-password")
    set_user_capabilities(package_operator, ["packages"])
    client.force_authenticate(package_operator)

    assert client.get("/api/lunch/packages/").status_code == 200
    assert client.get("/api/lunch/lunches/").status_code == 403
    assert client.get("/api/users/member-options/").status_code == 200


@pytest.mark.django_db
def test_related_read_endpoints_do_not_grant_write_access(client):
    fiscal_operator = User.objects.create_user(username="fiscal", password="operator-password")
    set_user_capabilities(fiscal_operator, ["fiscal"])
    lunch = LunchFactory()
    package = PackageFactory()
    client.force_authenticate(fiscal_operator)

    assert client.get("/api/lunch/lunches/").status_code == 403
    sources_response = client.get("/api/fiscal/sources/", {"source_type": "LUNCH"})
    assert sources_response.status_code == 200
    lunch_source = next(
        item for item in sources_response.data["results"] if item["id"] == lunch.id
    )
    assert set(lunch_source) == {"id", "member_name", "value_cents", "date", "payment_mode"}
    package_sources_response = client.get(
        "/api/fiscal/sources/", {"source_type": "PACKAGE"}
    )
    package_source = next(
        item for item in package_sources_response.data["results"] if item["id"] == package.id
    )
    assert set(package_source) == {
        "id",
        "member_name",
        "value_cents",
        "date",
        "payment_mode",
        "quantity",
    }
    assert client.post("/api/lunch/lunches/", {}, format="json").status_code == 403

    agenda_operator = User.objects.create_user(username="agenda", password="operator-password")
    set_user_capabilities(agenda_operator, ["agenda"])
    client.force_authenticate(agenda_operator)

    assert client.get("/api/duties/options/").status_code == 200
    assert client.get("/api/duties/duties/").status_code == 403


@pytest.mark.django_db
def test_financial_mutations_record_authorship_and_audit(client):
    operator = User.objects.create_user(username="financeiro", password="operator-password")
    set_user_capabilities(operator, ["financial"])
    client.force_authenticate(operator)

    create_response = client.post(
        "/api/financial/entries/",
        {
            "entry_type": "SAIDA",
            "category": "DESPESA",
            "description": "Compra de teste",
            "value_cents": 2500,
            "date": "2026-09-30",
        },
        format="json",
    )

    assert create_response.status_code == 201
    entry = FinancialEntry.objects.get(pk=create_response.data["id"])
    assert entry.created_by == operator
    assert entry.updated_by == operator
    assert AuditEvent.objects.filter(
        actor=operator,
        action=AuditEvent.Action.CREATE,
        entity_type="financial.FinancialEntry",
        object_id=str(entry.pk),
    ).exists()

    update_response = client.patch(
        f"/api/financial/entries/{entry.pk}/",
        {"description": "Compra corrigida"},
        format="json",
    )
    assert update_response.status_code == 200
    assert AuditEvent.objects.filter(
        actor=operator,
        action=AuditEvent.Action.UPDATE,
        object_id=str(entry.pk),
    ).exists()

    delete_response = client.delete(f"/api/financial/entries/{entry.pk}/")
    assert delete_response.status_code == 204
    assert AuditEvent.objects.filter(
        actor=operator,
        action=AuditEvent.Action.DELETE,
        object_id=str(entry.pk),
    ).exists()
