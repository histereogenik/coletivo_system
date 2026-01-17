from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def set_auth_cookies(response: Response, access: str, refresh: str | None = None):
    cookie_params = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
    }
    access_max_age = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie("access_token", access, max_age=access_max_age, **cookie_params)
    if refresh:
        refresh_max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
        response.set_cookie("refresh_token", refresh, max_age=refresh_max_age, **cookie_params)


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
        # Allow refresh to come from cookie if not provided in body.
        refresh_token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response(
                {"refresh": ["Este campo é obrigatório."]}, status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        access = serializer.validated_data.get("access")
        new_refresh = serializer.validated_data.get("refresh") or refresh_token
        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        if access:
            set_auth_cookies(response, access, new_refresh)
        return response


class LogoutView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class AuthStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({"id": user.id, "username": user.get_username()})


__all__ = [
    "TokenObtainPairView",
    "TokenRefreshView",
    "CookieTokenObtainPairView",
    "CookieTokenRefreshView",
    "LogoutView",
    "AuthStatusView",
]
