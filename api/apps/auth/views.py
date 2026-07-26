from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.auth.serializers import ObtainTokenSerializer, RefreshTokenSerializer, UserInfoSerializer

settings.REFRESH_COOKIE_NAME = "refreshtoken"


@api_view(['GET'])
@permission_classes([AllowAny])
def exists_user(request):
    return Response({"exists": User.objects.all().exists()})


def _with_refresh_cookie(response: Response) -> Response:
    response.data["access_token"] = response.data.pop("access")
    refresh = response.data.pop("refresh", None)
    if refresh is not None:
        max_age = int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds())
        response.set_cookie(key=settings.REFRESH_COOKIE_NAME, value=refresh, max_age=max_age, httponly=True,
                            samesite="Lax")
    return response


class ObtainTokenAPIView(TokenObtainPairView):
    serializer_class = ObtainTokenSerializer

    def post(self, request: Request, *args, **kwargs) -> Response:
        return _with_refresh_cookie(super().post(request, *args, **kwargs))


class RefreshTokenAPIView(TokenRefreshView):
    serializer_class = RefreshTokenSerializer

    def post(self, request: Request, *args, **kwargs) -> Response:
        response = super().post(request, *args, **kwargs)
        return _with_refresh_cookie(response)


class LogoutAPIView(APIView):
    # 액세스 토큰이 이미 만료된 상태에서도 로그아웃(=refresh 토큰 무효화)이 가능해야 한다.
    permission_classes = [AllowAny]

    def delete(self, request: Request, *args, **kwargs) -> Response:
        response = Response(status=204)
        response.delete_cookie(settings.REFRESH_COOKIE_NAME)
        return response


class UserInfoAPIView(RetrieveAPIView):
    serializer_class = UserInfoSerializer

    def get_object(self):
        queryset = User.objects.all()
        queryset = queryset.annotate(
            zone_count=Count("zone", distinct=True),
            restaurant_count=Count("zone__category__restaurant", distinct=True),
            review_count=Count("zone__category__restaurant__review_set", distinct=True),
        )
        return queryset.get(id=self.request.user.id)