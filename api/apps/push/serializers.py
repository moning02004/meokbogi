from rest_framework import serializers


class SubscriptionKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=200)
    auth = serializers.CharField(max_length=100)


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
