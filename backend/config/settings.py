import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEFAULT_DEV_SECRET_KEY = "django-insecure-zwawm$es001krk@ga^o5r8-if9th7=o7ur5i0tfbe*u#i6c&rs"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", DEFAULT_DEV_SECRET_KEY)

DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",")
    if host.strip()
]

SITE_NAME = "coletivo_system"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "apps.users",
    "apps.authentication",
    "apps.lunch",
    "apps.duties",
    "apps.agenda",
    "apps.financial",
    "apps.credits",
    "apps.common",
    "apps.dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": (
        {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "postgres"),
            "USER": os.getenv("POSTGRES_USER", "postgres"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),
            "HOST": os.getenv("POSTGRES_HOST", "db"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
        if os.getenv("POSTGRES_DB")
        else {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

default_renderer_classes = ["rest_framework.renderers.JSONRenderer"]
if DEBUG:
    default_renderer_classes.append("rest_framework.renderers.BrowsableAPIRenderer")

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.authentication.authentication.CookieJWTAuthentication",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.DefaultPagination",
    "DEFAULT_RENDERER_CLASSES": default_renderer_classes,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("DRF_THROTTLE_ANON", "60/min"),
        "user": os.getenv("DRF_THROTTLE_USER", "600/min"),
        "public_registration": os.getenv("DRF_THROTTLE_PUBLIC_REGISTRATION", "10/min"),
        "auth_login": os.getenv("DRF_THROTTLE_AUTH_LOGIN", "10/min"),
        "auth_refresh": os.getenv("DRF_THROTTLE_AUTH_REFRESH", "30/min"),
    },
}

cors_allow_all_env = os.getenv("CORS_ALLOW_ALL_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = DEBUG if cors_allow_all_env is None else cors_allow_all_env == "True"
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "False") == "True"
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN") or None
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", str(AUTH_COOKIE_SECURE)) == "True"
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", AUTH_COOKIE_SAMESITE)
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", str(AUTH_COOKIE_SECURE)) == "True"
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", AUTH_COOKIE_SAMESITE)
csrf_cookie_domain_env = os.getenv("CSRF_COOKIE_DOMAIN")
CSRF_COOKIE_DOMAIN = csrf_cookie_domain_env or AUTH_COOKIE_DOMAIN
CSRF_COOKIE_HTTPONLY = False

SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True" if not DEBUG else "False") == "True"
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.getenv("SECURE_HSTS_INCLUDE_SUBDOMAINS", "True" if not DEBUG else "False") == "True"
)
SECURE_HSTS_PRELOAD = os.getenv("SECURE_HSTS_PRELOAD", "True" if not DEBUG else "False") == "True"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
SECURE_CROSS_ORIGIN_OPENER_POLICY = os.getenv(
    "SECURE_CROSS_ORIGIN_OPENER_POLICY",
    "same-origin",
)
X_FRAME_OPTIONS = os.getenv("X_FRAME_OPTIONS", "DENY")

if not DEBUG:
    if SECRET_KEY == DEFAULT_DEV_SECRET_KEY:
        raise RuntimeError("Defina DJANGO_SECRET_KEY em producao.")
    if not AUTH_COOKIE_SECURE:
        raise RuntimeError("AUTH_COOKIE_SECURE deve ser True em producao.")
    if not SESSION_COOKIE_SECURE:
        raise RuntimeError("SESSION_COOKIE_SECURE deve ser True em producao.")
    if not CSRF_COOKIE_SECURE:
        raise RuntimeError("CSRF_COOKIE_SECURE deve ser True em producao.")
    if CORS_ALLOW_ALL_ORIGINS:
        raise RuntimeError("CORS_ALLOW_ALL_ORIGINS deve ser False em producao.")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        }
    },
    "loggers": {
        "apps.authentication": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_AUTH_LOG_LEVEL", "INFO"),
            "propagate": False,
        }
    },
}
