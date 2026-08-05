import os

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken


class ObtainTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user_id"] = self.user.id
        return data


class RefreshTokenSerializer(TokenRefreshSerializer):
    refresh = None

    def validate(self, attrs):
        attrs["refresh"] = self.context["request"].COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if attrs["refresh"] is None:
            raise serializers.ValidationError({"refresh": "refresh 토큰이 없습니다."})

        data = super().validate(attrs)
        token = RefreshToken(attrs["refresh"])
        data["user_id"] = int(token["user_id"])
        return data


class UserInfoSerializer(serializers.ModelSerializer):
    zone_count = serializers.IntegerField(read_only=True)
    restaurant_count = serializers.IntegerField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = User
        fields = ["username", "first_name", "zone_count", "restaurant_count", "review_count"]
        extra_kwargs = {"username": {"read_only": True}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["version"] = os.environ.get("APP_VERSION", "0.0.1")
        data["release_date"] = os.environ.get("APP_RELEASE_DATE", "2026-07-24")
        data["last_updated_at"] = os.environ.get("APP_LAST_UPDATED_AT", "2026-07-27")
        return data


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("현재 비밀번호가 올바르지 않습니다.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "새 비밀번호가 일치하지 않습니다."})
        validate_password(attrs["new_password"], user=self.context["request"].user)
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user