import os

from django.core.exceptions import ImproperlyConfigured

from .base import *


def require_env(name):
    # KeyError 대신 무엇이 빠졌는지 알려주고 죽는다. 컨테이너가 안 뜰 때 로그만 보고 원인을 알 수 있어야 한다.
    try:
        return os.environ[name]
    except KeyError:
        raise ImproperlyConfigured(f"운영 설정에는 {name} 환경변수가 필요합니다.") from None


DEBUG = False

SECRET_KEY = require_env("DJANGO_SECRET_KEY")

ALLOWED_HOSTS = [host for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if host]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": require_env("DB_NAME"),
        "USER": require_env("DB_USER"),
        "PASSWORD": require_env("DB_PASSWORD"),
        "HOST": os.environ.get("DB_HOST"),
        "PORT": os.environ.get("DB_PORT"),
    }
}

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

CORS_ALLOWED_ORIGINS = [origin for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if origin]

# 브라우저블 API는 API 표면과 폼을 그대로 노출하므로 운영에서는 끈다
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

# 프록시(예: ALB, nginx) 뒤에서 HTTPS로 서빙되는 경우
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True