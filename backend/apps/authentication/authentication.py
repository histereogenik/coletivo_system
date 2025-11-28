from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    Extends JWTAuthentication to also read the access token from an HttpOnly cookie.
    """

    def authenticate(self, request):
        # Try standard header-based auth first.
        result = super().authenticate(request)
        if result is not None:
            return result

        raw_token = request.COOKIES.get("access_token")
        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
