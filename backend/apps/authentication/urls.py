from django.urls import path
from apps.authentication.views import (
    AuthStatusView,
    CsrfCookieView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    LogoutView,
)

urlpatterns = [
    path("csrf/", CsrfCookieView.as_view(), name="auth_csrf"),
    path("cookie/token/", CookieTokenObtainPairView.as_view(), name="cookie_token_obtain_pair"),
    path("cookie/token/refresh/", CookieTokenRefreshView.as_view(), name="cookie_token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("status/", AuthStatusView.as_view(), name="auth_status"),
]
