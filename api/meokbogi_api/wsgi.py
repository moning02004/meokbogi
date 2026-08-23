"""
WSGI config for meokbogi_api project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# 실서버 진입점이므로 운영 설정을 기본값으로 둔다. 개발용 base 설정으로 조용히 폴백하면
# DEBUG=True + sqlite + 개발용 SECRET_KEY 로 서비스가 떠버린다.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'meokbogi_api.settings.product')

application = get_wsgi_application()
