"""브라우저 E2E 테스트(web/e2e) 전용 설정.

매 실행마다 새 SQLite 파일을 쓰고, 테스트가 짧은 시간에 로그인을 여러 번 하므로 요청 한도를 푼다.
"""
import os

from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("E2E_DB_PATH", BASE_DIR / "e2e.sqlite3"),
    }
}

# 웹(3100)과 API(8100)는 포트만 다른 같은 사이트라 refresh 쿠키는 Lax로 충분하다
CORS_ALLOWED_ORIGIN_REGEXES = [r"^http://localhost:\d+$", r"^http://127\.0\.0\.1:\d+$"]

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_CLASSES": [],
    # 로그인 뷰는 scope 한도를 직접 달고 있어서 비율 자체를 넉넉히 준다
    "DEFAULT_THROTTLE_RATES": {"anon": "10000/min", "user": "10000/min", "login": "10000/min"},
}
