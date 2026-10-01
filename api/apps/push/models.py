from django.contrib.auth.models import User
from django.db import models


class PushSubscription(models.Model):
    """알림을 받기로 한 기기(브라우저) 하나. endpoint는 브라우저 푸시 서비스가 정해 준 주소다."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    def as_subscription_info(self):
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": self.auth}}


class VapidKey(models.Model):
    """서버가 푸시를 보낼 때 서명하는 키. 환경변수가 없으면 처음 쓸 때 만들어 한 줄만 둔다.

    키가 바뀌면 기존 구독이 모두 무효가 되므로 한 번 만든 키는 바꾸지 않는다.
    """
    private_pem = models.TextField()
    public_key = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
