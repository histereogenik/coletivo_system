from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def set_auth_cookies(response: Response, access: str, refresh: str | None = None):
    cookie_params = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
    }
    response.set_cookie("access_token", access, **cookie_params)
    if refresh:
        response.set_cookie("refresh_token", refresh, **cookie_params)


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        access = response.data.get("access")
        refresh = response.data.get("refresh")
        if access:
            set_auth_cookies(response, access, refresh)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        access = response.data.get("access")
        if access:
            set_auth_cookies(response, access)
        return response


class LogoutView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


__all__ = [
    "TokenObtainPairView",
    "TokenRefreshView",
    "CookieTokenObtainPairView",
    "CookieTokenRefreshView",
    "LogoutView",
]
