import base64
import json
import logging
import os

from cryptography.hazmat.primitives import serialization
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush
from requests import RequestException

from apps.push.models import PushSubscription, VapidKey

logger = logging.getLogger(__name__)

# 브라우저 푸시 서비스가 이 시간 안에 기기에 못 전하면 버린다 (꺼진 폰에 다음 날 "점심 뭐 먹었어요?"가 오지 않게)
TTL_SECONDS = 60 * 60 * 3


def _public_key_of(vapid):
    raw = vapid.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def get_vapid():
    """(서명용 Vapid, 브라우저에 줄 공개키). 환경변수 VAPID_PRIVATE_KEY가 있으면 그걸 쓰고, 없으면 DB에 하나 만든다."""
    env_key = os.environ.get("VAPID_PRIVATE_KEY")
    if env_key:
        vapid = Vapid02.from_string(env_key)
        return vapid, _public_key_of(vapid)

    stored = VapidKey.objects.order_by("id").first()
    if stored is None:
        with transaction.atomic():
            # 동시에 두 요청이 만들지 않도록 잠근 뒤 다시 확인한다
            stored = VapidKey.objects.select_for_update().order_by("id").first()
            if stored is None:
                vapid = Vapid02()
                vapid.generate_keys()
                stored = VapidKey.objects.create(private_pem=vapid.private_pem().decode(),
                                                 public_key=_public_key_of(vapid))
    return Vapid02.from_pem(stored.private_pem.encode()), stored.public_key


def vapid_subject():
    # 애플 푸시 서비스는 sub가 mailto: 나 https: 가 아니면 거절한다
    if getattr(settings, "VAPID_SUBJECT", ""):
        return settings.VAPID_SUBJECT
    origin = os.environ.get("PUBLIC_WEB_ORIGIN", "")
    return origin if origin.startswith("https://") else "mailto:meokbogi@example.com"


def send_to_user(user, title, content, url="/home"):
    """한 사용자의 모든 기기로 보낸다 (시험 알림)."""
    return _send(PushSubscription.objects.filter(user=user), title, content, url)


def send_to_all(title, content, url="/home"):
    """알림을 켠 모든 사용자의 모든 기기로 보낸다 (외부 스케줄러 알림)."""
    return _send(PushSubscription.objects.filter(user__is_active=True), title, content, url)


def _send(subscriptions, title, content, url):
    """더는 없는 구독(404·410)은 지운다. 기기 하나의 실패가 나머지 전송을 막지 않는다."""
    vapid, _ = get_vapid()
    payload = json.dumps({"title": title, "body": content, "url": url}, ensure_ascii=False)
    result = {"sent": 0, "removed": 0, "failed": 0}

    for subscription in subscriptions:
        try:
            webpush(subscription.as_subscription_info(), data=payload, vapid_private_key=vapid,
                    vapid_claims={"sub": vapid_subject()}, ttl=TTL_SECONDS, timeout=10)
        except WebPushException as error:
            status = getattr(error.response, "status_code", None)
            if status in (404, 410):
                # 사용자가 알림을 끄거나 앱을 지운 기기
                subscription.delete()
                result["removed"] += 1
            else:
                logger.warning("푸시 전송 실패 (%s): %s", status, error)
                result["failed"] += 1
            continue
        except RequestException as error:
            # 푸시 서비스에 닿지 못한 기기 하나 때문에 나머지 기기까지 못 받지 않게 한다
            logger.warning("푸시 서비스 연결 실패: %s", error)
            result["failed"] += 1
            continue
        except Exception:  # noqa: BLE001 - 기기 하나의 이상한 구독 정보(암호화 실패 등)가 전체 전송을 막지 않게
            logger.exception("푸시 전송 중 오류 (구독 %s)", subscription.pk)
            result["failed"] += 1
            continue
        subscription.last_sent_at = timezone.now()
        subscription.save(update_fields=["last_sent_at"])
        result["sent"] += 1
    return result
