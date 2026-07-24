import os

from django.conf import settings
from django.contrib.auth.models import User
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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["version"] = os.environ.get("APP_VERSION", "0.0.1")
        return data