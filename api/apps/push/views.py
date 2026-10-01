import secrets

from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.push.models import PushApiKey, PushSubscription
from apps.push.sender import get_vapid, send_to_user
from apps.push.serializers import SendSerializer, SubscriptionSerializer, UnsubscribeSerializer


class PushConfigAPIView(APIView):
    """브라우저가 구독할 때 쓰는 공개키와, 이 사용자의 기기 수."""

    def get(self, request, *args, **kwargs):
        _, public_key = get_vapid()
        return Response({
            "public_key": public_key,
            "device_count": PushSubscription.objects.filter(user=request.user).count(),
        })


class PushSubscriptionAPIView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = SubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # 같은 브라우저로 다른 계정에 로그인했다면 주인을 바꾼다
        subscription, created = PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={"user": request.user, "p256dh": data["keys"]["p256dh"], "auth": data["keys"]["auth"],
                      "user_agent": request.headers.get("User-Agent", "")[:300]},
        )
        return Response({"id": subscription.id}, status=201 if created else 200)

    def delete(self, request, *args, **kwargs):
        serializer = UnsubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        PushSubscription.objects.filter(user=request.user, endpoint=serializer.validated_data["endpoint"]).delete()
        return Response(status=204)


class PushTestAPIView(APIView):
    """내 기기로 시험 알림을 보낸다."""

    def post(self, request, *args, **kwargs):
        return Response(send_to_user(request.user, "먹보기 알림 시험", "알림이 잘 오고 있어요."))


class PushApiKeyAPIView(APIView):
    """외부 스케줄러(n8n)용 개인 키 보기(GET)·새로 만들기(POST)."""

    def get(self, request, *args, **kwargs):
        api_key, _ = PushApiKey.objects.get_or_create(user=request.user)
        return Response({"key": api_key.key})

    def post(self, request, *args, **kwargs):
        api_key, created = PushApiKey.objects.get_or_create(user=request.user)
        if not created:
            api_key.rotate()
        return Response({"key": api_key.key})


class PushSendAPIView(APIView):
    """n8n 같은 외부 스케줄러가 부르는 알림 보내기.

        POST /push/send
        Authorization: Bearer <내정보에서 복사한 키>
        {"title": "점심 뭐 드셨어요?", "content": "먹은 메뉴를 남겨 두세요"}

    키 주인의 모든 기기로 보낸다. 로그인 토큰(JWT)으로 해석하지 않도록 기본 인증을 끈다.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_authenticate_header(self, request):
        # 인증 클래스가 없으면 DRF가 인증 실패를 403으로 바꾼다. 키가 틀린 건 401이 맞다.
        return 'Bearer realm="meokbogi-push"'

    def post(self, request, *args, **kwargs):
        header = request.headers.get("Authorization", "")
        key = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
        api_key = PushApiKey.objects.select_related("user").filter(key=key).first() if key else None
        # 키 비교를 타이밍으로 추측하지 못하게 한 번 더 상수 시간 비교
        if api_key is None or not secrets.compare_digest(api_key.key, key) or not api_key.user.is_active:
            raise AuthenticationFailed("알림 키가 올바르지 않아요. 내정보 → 알림에서 키를 다시 복사해주세요.")

        serializer = SendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(send_to_user(api_key.user, data["title"], data["content"], data["url"]))
