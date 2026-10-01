from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.authentication.views import (
    AuthStatusView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CsrfCookieView,
    LogoutView,
    OperatorAccountViewSet,
    CapabilityListView,
)

router = DefaultRouter()
router.register(r"operators", OperatorAccountViewSet, basename="operator-account")

urlpatterns = [
    path("csrf/", CsrfCookieView.as_view(), name="auth_csrf"),
    path("cookie/token/", CookieTokenObtainPairView.as_view(), name="cookie_token_obtain_pair"),
    path("cookie/token/refresh/", CookieTokenRefreshView.as_view(), name="cookie_token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("status/", AuthStatusView.as_view(), name="auth_status"),
    path("capabilities/", CapabilityListView.as_view(), name="auth_capabilities"),
    path("", include(router.urls)),
]
