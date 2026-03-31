import logging

from django.conf import settings
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.authentication.authentication import enforce_csrf

logger = logging.getLogger("apps.authentication")


def get_client_ip(request) -> str:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def set_csrf_cookie(response: Response, request):
    csrf_token = get_token(request)
    response.set_cookie(
        settings.CSRF_COOKIE_NAME,
        csrf_token,
        max_age=settings.CSRF_COOKIE_AGE,
        domain=settings.CSRF_COOKIE_DOMAIN,
        path=settings.CSRF_COOKIE_PATH,
        secure=settings.CSRF_COOKIE_SECURE,
        httponly=settings.CSRF_COOKIE_HTTPONLY,
        samesite=settings.CSRF_COOKIE_SAMESITE,
    )


def set_auth_cookies(response: Response, access: str, refresh: str | None = None):
    cookie_params = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
    }
    if settings.AUTH_COOKIE_DOMAIN:
        cookie_params["domain"] = settings.AUTH_COOKIE_DOMAIN
    access_max_age = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie("access_token", access, max_age=access_max_age, **cookie_params)
    if refresh:
        refresh_max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
        response.set_cookie("refresh_token", refresh, max_age=refresh_max_age, **cookie_params)


def clear_auth_cookies(response: Response):
    delete_params = {}
    if settings.AUTH_COOKIE_DOMAIN:
        delete_params["domain"] = settings.AUTH_COOKIE_DOMAIN
    response.delete_cookie("access_token", **delete_params)
    response.delete_cookie("refresh_token", **delete_params)


def build_cookie_auth_response(
    *, detail: str, request, access: str, refresh: str | None = None
) -> Response:
    response = Response({"detail": detail}, status=status.HTTP_200_OK)
    set_auth_cookies(response, access, refresh)
    set_csrf_cookie(response, request)
    return response


class CookieTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_login"

    def post(self, request, *args, **kwargs):
        enforce_csrf(request)
        serializer = self.get_serializer(data=request.data)
        username = str(request.data.get("username", "")).strip()

        try:
            serializer.is_valid(raise_exception=True)
        except APIException:
            logger.warning(
                "Falha de login por cookie.",
                extra={"username": username, "client_ip": get_client_ip(request)},
            )
            raise

        access = serializer.validated_data["access"]
        refresh = serializer.validated_data["refresh"]
        logger.info(
            "Login por cookie realizado com sucesso.",
            extra={"username": username, "client_ip": get_client_ip(request)},
        )
        return build_cookie_auth_response(
            detail="Login realizado com sucesso.",
            request=request,
            access=access,
            refresh=refresh,
        )


class CookieTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_refresh"

    def post(self, request, *args, **kwargs):
        enforce_csrf(request)
        refresh_token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if not refresh_token:
            logger.warning(
                "Refresh por cookie falhou por ausencia de refresh token.",
                extra={"client_ip": get_client_ip(request)},
            )
            return Response(
                {"refresh": ["Este campo e obrigatorio."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except APIException:
            logger.warning(
                "Refresh por cookie falhou por token invalido.",
                extra={"client_ip": get_client_ip(request)},
            )
            raise

        access = serializer.validated_data.get("access")
        new_refresh = serializer.validated_data.get("refresh") or refresh_token
        if not access:
            logger.warning(
                "Refresh por cookie nao retornou novo access token.",
                extra={"client_ip": get_client_ip(request)},
            )
            return Response(
                {"detail": "Nao foi possivel renovar a sessao."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            "Sessao renovada por cookie.",
            extra={"client_ip": get_client_ip(request)},
        )
        return build_cookie_auth_response(
            detail="Sessao renovada com sucesso.",
            request=request,
            access=access,
            refresh=new_refresh,
        )


class LogoutView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_refresh"

    def post(self, request, *args, **kwargs):
        enforce_csrf(request)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        set_csrf_cookie(response, request)
        logger.info(
            "Sessao encerrada por cookie.",
            extra={
                "user_id": getattr(request.user, "id", None),
                "client_ip": get_client_ip(request),
            },
        )
        return response


class AuthStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        response = Response({"id": user.id, "username": user.get_username()})
        set_csrf_cookie(response, request)
        return response


class CsrfCookieView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        response = Response({"detail": "CSRF cookie definido."}, status=status.HTTP_200_OK)
        set_csrf_cookie(response, request)
        return response


__all__ = [
    "CookieTokenObtainPairView",
    "CookieTokenRefreshView",
    "LogoutView",
    "AuthStatusView",
    "CsrfCookieView",
]
