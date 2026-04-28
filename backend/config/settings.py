import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

DEBUG = os.environ.get("DEBUG", "True").lower() == "true"

# Render sets RENDER when running on the platform (used for production defaults).
IS_RENDER = "RENDER" in os.environ


def _split_env_list(key: str, default: str) -> list[str]:
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


ALLOWED_HOSTS = _split_env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "channels",
    "import_export",
    "monitor",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# PostgreSQL only (Heroku Postgres sets DATABASE_URL automatically).
_database_url = (os.environ.get("DATABASE_URL") or "").strip()
if not _database_url:
    raise ImproperlyConfigured(
        "DATABASE_URL is required and must be a PostgreSQL URL, e.g. "
        "postgres://USER:PASSWORD@HOST:PORT/DBNAME. "
        "Heroku sets this when you attach the Postgres add-on. "
        "For local development, run Postgres (e.g. Docker) and set DATABASE_URL in backend/.env — "
        "see .env.example."
    )

DATABASES = {
    "default": dj_database_url.parse(
        _database_url,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        # Heroku Redis often uses TLS with a certificate chain that isn't trusted
        # by all dyno environments. Disabling cert verification lets Channels
        # connect so WebSockets work.
        "CONFIG": {
            "hosts": [
                {"address": redis_url, "ssl_cert_reqs": None}
                if str(redis_url).startswith("rediss://")
                else redis_url
            ]
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/var/data/media/"
MEDIA_ROOT = "/media/"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = _split_env_list(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.6:5173",
)

# HTTPS behind Render / other reverse proxies
if not DEBUG or IS_RENDER:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

# JWT: short-lived access tokens, refresh valid for 1 day (user must log in again after that).
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
