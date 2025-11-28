from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.authentication.views import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    LogoutView,
)

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("cookie/token/", CookieTokenObtainPairView.as_view(), name="cookie_token_obtain_pair"),
    path("cookie/token/refresh/", CookieTokenRefreshView.as_view(), name="cookie_token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
]
