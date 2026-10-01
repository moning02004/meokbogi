import base64
import binascii

from rest_framework import serializers


def _decode_b64url(value):
    try:
        return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, binascii.Error):
        return b""


class SubscriptionKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=200)
    auth = serializers.CharField(max_length=100)

    # 키가 깨져 있으면 보낼 때 암호화에서 터진다. 받을 때 모양을 확인한다.
    def validate_p256dh(self, value):
        raw = _decode_b64url(value)
        if len(raw) != 65 or raw[0] != 4:
            raise serializers.ValidationError("올바른 구독 키가 아니에요.")
        return value

    def validate_auth(self, value):
        if len(_decode_b64url(value)) != 16:
            raise serializers.ValidationError("올바른 구독 키가 아니에요.")
        return value


class SubscriptionSerializer(serializers.Serializer):
    # 브라우저 PushSubscription.toJSON() 모양 그대로 받는다
    endpoint = serializers.URLField(max_length=1000)
    keys = SubscriptionKeysSerializer()


class UnsubscribeSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)


class SendSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100)
    content = serializers.CharField(max_length=300, allow_blank=True, default="")
    # 알림을 누르면 열 화면. 앱 안의 경로만 받는다.
    url = serializers.RegexField(r"^/[^/\\].*$|^/$", max_length=200, required=False, default="/home",
                                 error_messages={"invalid": "url은 /home 처럼 앱 안의 경로여야 해요."})
