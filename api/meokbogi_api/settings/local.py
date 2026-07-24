from .base import *  # noqa: F401,F403

DEBUG = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ.get("DB_HOST"),
        "PORT": os.environ.get("DB_PORT"),
    }
}

# 로컬 개발 중 3000번 포트가 사용 중이면 Next.js가 자동으로 다른 포트를 쓰므로
# 로컬 환경에서는 localhost의 다른 포트에서의 요청도 허용한다.
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
]