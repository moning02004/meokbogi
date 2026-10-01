import os
import secrets

from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.push.models import PushSubscription
from apps.push.sender import get_vapid, send_to_all, send_to_user
from apps.push.serializers import SendSerializer, SubscriptionSerializer, UnsubscribeSerializer


class ServiceUnavailable(APIException):
    status_code = 503
    default_code = "push_not_configured"


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


class PushSendAPIView(APIView):
    """n8n 같은 외부 스케줄러가 부르는 알림 보내기. 알림을 켠 모든 사용자의 기기로 보낸다.

        POST /push/send
        Authorization: Bearer <서버 환경변수 PUSH_API_TOKEN>
        {"title": "점심 뭐 드셨어요?", "content": "먹은 메뉴를 남겨 두세요"}

    로그인 토큰(JWT)으로 해석하지 않도록 기본 인증을 끈다.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get_authenticate_header(self, request):
        # 인증 클래스가 없으면 DRF가 인증 실패를 403으로 바꾼다. 토큰이 틀린 건 401이 맞다.
        return 'Bearer realm="meokbogi-push"'

    def post(self, request, *args, **kwargs):
        expected = os.environ.get("PUSH_API_TOKEN", "")
        if not expected:
            # 토큰 없이 열어 두면 누구나 알림을 보낼 수 있으므로 설정 전에는 막는다
            raise ServiceUnavailable("서버에 PUSH_API_TOKEN 환경변수가 설정되지 않았어요.")

        header = request.headers.get("Authorization", "")
        token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
        if not token or not secrets.compare_digest(token.encode(), expected.encode()):
            raise AuthenticationFailed("알림 토큰이 올바르지 않아요. 서버의 PUSH_API_TOKEN 값을 확인해주세요.")

        serializer = SendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(send_to_all(data["title"], data["content"], data["url"]))
