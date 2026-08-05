from django.db.models import Sum, Count, FloatField, F, Value, Case, When
from django.db.models.functions import Cast, Coalesce
from rest_framework import serializers

from apps.restaurant.models import Restaurant, RestaurantReview


class DeliciousRestaurantSerializer(serializers.ModelSerializer):
    # {id: 1, name: "어디", ordered_count: 8, total_result: 0.1},

    class Meta:
        model = Restaurant
        fields = ["id", "name"]


class RestaurantReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantReview
        fields = ["id", "ordered_at", "menu", "content", "point"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        validated_data["restaurant_id"] = self.context["view"].kwargs["restaurant_pk"]
        return super().create(validated_data)


class RestaurantListSerializer(serializers.ModelSerializer):
    description = serializers.CharField(required=False, allow_blank=True, default="")
    category_name = serializers.CharField(source="category.keyword", read_only=True)
    review_avg = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    latest_ordered_at = serializers.DateField(read_only=True)
    ordered_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Restaurant
        fields = ["id", "name", "description", "address", "category_name",
                  "latest_ordered_at", "review_avg", "review_count", "ordered_count"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        validated_data["category_id"] = self.context["category_id"]
        return super().create(validated_data)


class RestaurantInfoSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.keyword", read_only=True)
    latest_ordered_at = serializers.DateField(read_only=True)
    ordered_count = serializers.IntegerField(read_only=True)
    review_avg = serializers.FloatField(read_only=True)
    menu_summaries = serializers.SerializerMethodField()
    review_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Restaurant
        fields = ["id", "name", "description", "address", "category", "category_name",
                  "latest_ordered_at", "ordered_count", "review_avg", "menu_summaries", "review_count"]
        extra_kwargs = {"category": {"write_only": True}}

    def validate_category(self, value):
        # 다른 사람의 존에 있는 카테고리로는 옮길 수 없다
        if value.zone.user_id != self.context["request"].user.id:
            raise serializers.ValidationError("이동할 수 없는 카테고리입니다.")
        return value

    def get_menu_summaries(self, obj):
        queryset = obj.review_set.all().values("menu").annotate(
            review_avg=Cast(Sum("point"), FloatField()) / Count("id"),
            review_count=Count("id"),
        ).values("menu", "review_avg", "review_count").order_by()
        return queryset
