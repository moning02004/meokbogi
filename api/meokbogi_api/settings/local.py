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
        # 요청마다 새로 접속하지 않고 미리 열어 둔 접속을 돌려 쓴다 (psycopg 3 필요).
        # ASGI에서는 CONN_MAX_AGE(지속 접속)를 쓰지 말라는 것이 Django 안내라서 풀을 쓴다. 워커마다 풀이 하나씩 생긴다.
        "OPTIONS": {"pool": {"min_size": 2, "max_size": 4}},
    }
}

# 로컬 개발 중 3000번 포트가 사용 중이면 Next.js가 자동으로 다른 포트를 쓰므로
# 로컬 환경에서는 localhost의 다른 포트에서의 요청도 허용한다.
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
]