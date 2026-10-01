import base64
import json
import os
from unittest import mock

import http_ece
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from pywebpush import WebPushException

from apps.push.models import PushApiKey, PushSubscription, VapidKey
from apps.push.sender import get_vapid, send_to_user


def b64url(raw):
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def fake_browser_subscription(endpoint="https://push.example.com/send/abc"):
    """브라우저가 구독할 때 만드는 것과 같은 키를 만든다 (받는 쪽 개인키를 들고 있어 복호화할 수 있다)."""
    receiver = ec.generate_private_key(ec.SECP256R1())
    public = receiver.public_key().public_bytes(serialization.Encoding.X962,
                                                serialization.PublicFormat.UncompressedPoint)
    auth = os.urandom(16)
    return receiver, auth, {"endpoint": endpoint, "keys": {"p256dh": b64url(public), "auth": b64url(auth)}}


class PushTestBase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.client.login(username="owner", password="123")

    def subscribe(self, endpoint="https://push.example.com/send/abc", user=None):
        _, _, info = fake_browser_subscription(endpoint)
        return PushSubscription.objects.create(user=user or self.user, endpoint=info["endpoint"],
                                               p256dh=info["keys"]["p256dh"], auth=info["keys"]["auth"])


class VapidKeyTestCase(PushTestBase):
    def test_key_is_created_once_and_reused(self):
        _, first = get_vapid()
        _, second = get_vapid()
        self.assertEqual(first, second)
        self.assertEqual(VapidKey.objects.count(), 1)
        # 브라우저 applicationServerKey 형식: 65바이트 비압축 공개키의 base64url
        self.assertEqual(len(base64.urlsafe_b64decode(first + "==")), 65)

    def test_config_returns_public_key(self):
        response = self.client.get(reverse("push-config"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["public_key"], get_vapid()[1])
        self.assertEqual(response.json()["device_count"], 0)


class SubscriptionTestCase(PushTestBase):
    def test_subscribe_and_unsubscribe(self):
        _, _, info = fake_browser_subscription()
        response = self.client.post(reverse("push-subscriptions"), data=info, content_type="application/json",
                                    HTTP_USER_AGENT="iPhone Safari")
        self.assertEqual(response.status_code, 201)
        subscription = PushSubscription.objects.get()
        self.assertEqual((subscription.user, subscription.user_agent), (self.user, "iPhone Safari"))

        # 같은 기기에서 다시 켜도 하나만 남는다
        self.assertEqual(self.client.post(reverse("push-subscriptions"), data=info,
                                          content_type="application/json").status_code, 200)
        self.assertEqual(PushSubscription.objects.count(), 1)

        response = self.client.delete(reverse("push-subscriptions"), data={"endpoint": info["endpoint"]},
                                      content_type="application/json")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(PushSubscription.objects.exists())

    def test_cannot_unsubscribe_other_users_device(self):
        other = User.objects.create_user(username="other", password="123")
        subscription = self.subscribe(user=other)
        self.client.delete(reverse("push-subscriptions"), data={"endpoint": subscription.endpoint},
                           content_type="application/json")
        self.assertTrue(PushSubscription.objects.filter(pk=subscription.pk).exists())

    def test_rejects_malformed_subscription(self):
        response = self.client.post(reverse("push-subscriptions"), data={"endpoint": "not-a-url"},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 400)

        _, _, info = fake_browser_subscription()
        for broken in ({**info["keys"], "p256dh": "AAAA"}, {**info["keys"], "auth": "!!not-base64!!"}):
            response = self.client.post(reverse("push-subscriptions"), content_type="application/json",
                                        data={"endpoint": info["endpoint"], "keys": broken})
            self.assertEqual(response.status_code, 400)
        self.assertFalse(PushSubscription.objects.exists())

    def test_requires_login(self):
        self.client.logout()
        self.assertEqual(self.client.get(reverse("push-config")).status_code, 401)


class SenderTestCase(PushTestBase):
    def test_payload_is_encrypted_for_the_browser(self):
        # 실제 pywebpush로 암호화한 요청을 가로채, 브라우저처럼 복호화해서 내용을 확인한다
        receiver, auth, info = fake_browser_subscription()
        PushSubscription.objects.create(user=self.user, endpoint=info["endpoint"], p256dh=info["keys"]["p256dh"],
                                        auth=info["keys"]["auth"])
        session = mock.Mock()
        session.post.return_value = mock.Mock(status_code=201)

        with mock.patch("apps.push.sender.webpush", wraps=__import__("pywebpush").webpush) as spy:
            spy.side_effect = lambda *args, **kwargs: __import__("pywebpush").webpush(
                *args, requests_session=session, **kwargs)
            result = send_to_user(self.user, "점심 뭐 드셨어요?", "먹은 메뉴를 남겨 두세요", "/restaurant")

        self.assertEqual(result, {"sent": 1, "removed": 0, "failed": 0})
        url, = session.post.call_args.args
        request = session.post.call_args.kwargs
        self.assertEqual(url, info["endpoint"])
        self.assertTrue(request["headers"]["Authorization"].startswith("vapid t="))
        self.assertEqual(request["headers"]["Content-Encoding"], "aes128gcm")
        self.assertEqual(int(request["headers"]["TTL"]), 3 * 60 * 60)

        plain = http_ece.decrypt(request["data"], private_key=receiver, auth_secret=auth, version="aes128gcm")
        self.assertEqual(json.loads(plain), {"title": "점심 뭐 드셨어요?", "body": "먹은 메뉴를 남겨 두세요",
                                             "url": "/restaurant"})
        self.assertIsNotNone(PushSubscription.objects.get().last_sent_at)

    def test_gone_subscriptions_are_removed(self):
        alive = self.subscribe("https://push.example.com/alive")
        self.subscribe("https://push.example.com/gone")
        self.subscribe("https://push.example.com/flaky")

        def fake_webpush(info, **kwargs):
            if info["endpoint"].endswith("gone"):
                raise WebPushException("gone", response=mock.Mock(status_code=410))
            if info["endpoint"].endswith("flaky"):
                raise WebPushException("server error", response=mock.Mock(status_code=500))

        with mock.patch("apps.push.sender.webpush", side_effect=fake_webpush):
            result = send_to_user(self.user, "제목", "내용")

        self.assertEqual(result, {"sent": 1, "removed": 1, "failed": 1})
        self.assertEqual(sorted(PushSubscription.objects.values_list("endpoint", flat=True)),
                         sorted([alive.endpoint, "https://push.example.com/flaky"]))

    def test_unreachable_push_service_does_not_stop_others(self):
        self.subscribe("https://push.example.com/down")
        self.subscribe("https://push.example.com/ok")

        def fake_webpush(info, **kwargs):
            if info["endpoint"].endswith("down"):
                raise __import__("requests").ConnectionError("no route")

        with mock.patch("apps.push.sender.webpush", side_effect=fake_webpush):
            result = send_to_user(self.user, "제목", "내용")
        self.assertEqual(result, {"sent": 1, "removed": 0, "failed": 1})
        self.assertEqual(PushSubscription.objects.count(), 2)  # 일시적 실패는 지우지 않는다

    def test_broken_subscription_does_not_stop_others(self):
        broken = self.subscribe("https://push.example.com/broken")
        broken.p256dh = "AAAA"  # 예전에 검증 없이 저장된 구독이라고 가정
        broken.save()
        self.subscribe("https://push.example.com/ok")

        sent_to = []

        def fake_webpush(info, **kwargs):
            if info["keys"]["p256dh"] == "AAAA":
                raise ValueError("Invalid EC key")
            sent_to.append(info["endpoint"])

        with mock.patch("apps.push.sender.webpush", side_effect=fake_webpush):
            result = send_to_user(self.user, "제목", "내용")
        self.assertEqual(result, {"sent": 1, "removed": 0, "failed": 1})
        self.assertEqual(sent_to, ["https://push.example.com/ok"])

    def test_sends_only_to_that_users_devices(self):
        other = User.objects.create_user(username="other", password="123")
        self.subscribe("https://push.example.com/mine")
        self.subscribe("https://push.example.com/theirs", user=other)

        with mock.patch("apps.push.sender.webpush") as webpush:
            send_to_user(self.user, "제목", "내용")
        self.assertEqual([c.args[0]["endpoint"] for c in webpush.call_args_list], ["https://push.example.com/mine"])

    def test_test_endpoint_sends_to_me(self):
        self.subscribe()
        with mock.patch("apps.push.sender.webpush") as webpush:
            response = self.client.post(reverse("push-test"))
        self.assertEqual(response.json()["sent"], 1)
        self.assertEqual(json.loads(webpush.call_args.kwargs["data"])["title"], "먹보기 알림 시험")


class ApiKeyAndSendTestCase(PushTestBase):
    def setUp(self):
        super().setUp()
        self.subscribe()
        self.key = self.client.get(reverse("push-api-key")).json()["key"]
        self.anonymous = self.client_class()

    def _send(self, body, key=None, client=None):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {key if key is not None else self.key}"}
        return (client or self.anonymous).post(reverse("push-send"), data=body, content_type="application/json",
                                               **headers)

    def test_key_is_stable_until_rotated(self):
        self.assertTrue(self.key.startswith("mkb_"))
        self.assertEqual(self.client.get(reverse("push-api-key")).json()["key"], self.key)

        rotated = self.client.post(reverse("push-api-key")).json()["key"]
        self.assertNotEqual(rotated, self.key)
        self.assertEqual(self._send({"title": "제목"}).status_code, 401)  # 예전 키는 더 못 쓴다

    def test_send_with_title_and_content_only(self):
        with mock.patch("apps.push.sender.webpush") as webpush:
            response = self._send({"title": "점심 뭐 드셨어요?", "content": "먹은 메뉴를 남겨 두세요"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"sent": 1, "removed": 0, "failed": 0})
        payload = json.loads(webpush.call_args.kwargs["data"])
        self.assertEqual(payload, {"title": "점심 뭐 드셨어요?", "body": "먹은 메뉴를 남겨 두세요", "url": "/home"})

    def test_send_without_login_session_or_jwt(self):
        # n8n은 로그인하지 않는다. 키만 있으면 된다.
        with mock.patch("apps.push.sender.webpush"):
            self.assertEqual(self._send({"title": "제목"}).status_code, 200)

    def test_wrong_or_missing_key(self):
        self.assertEqual(self._send({"title": "제목"}, key="mkb_wrong").status_code, 401)
        response = self.anonymous.post(reverse("push-send"), data={"title": "제목"}, content_type="application/json")
        self.assertEqual(response.status_code, 401)

    def test_inactive_user_key_is_rejected(self):
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self._send({"title": "제목"}).status_code, 401)

    def test_validates_body(self):
        self.assertEqual(self._send({"content": "제목 없음"}).status_code, 400)
        self.assertEqual(self._send({"title": "가" * 101}).status_code, 400)
        # 알림을 눌러 다른 사이트로 보내지 못하게 앱 안 경로만 받는다
        self.assertEqual(self._send({"title": "제목", "url": "https://evil.example.com"}).status_code, 400)
        self.assertEqual(self._send({"title": "제목", "url": "//evil.example.com"}).status_code, 400)

    def test_custom_url(self):
        with mock.patch("apps.push.sender.webpush") as webpush:
            self._send({"title": "제목", "url": "/play"})
        self.assertEqual(json.loads(webpush.call_args.kwargs["data"])["url"], "/play")

    def test_reports_zero_when_no_devices(self):
        PushSubscription.objects.all().delete()
        response = self._send({"title": "제목"})
        self.assertEqual(response.json()["sent"], 0)

    def test_api_key_requires_login(self):
        self.assertEqual(self.anonymous.get(reverse("push-api-key")).status_code, 401)
        self.assertFalse(PushApiKey.objects.exclude(user=self.user).exists())
