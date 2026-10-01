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
        ).values("menu", "review_avg", "review_count").order_by("-review_count", "menu")

        # 메뉴별 가장 최근 리뷰의 만족도. 상세 조회는 review_set을 최신순으로 prefetch해 두므로 추가 쿼리가 없다.
        latest = {}
        for review in sorted(obj.review_set.all(), key=lambda r: (r.ordered_at, r.id), reverse=True):
            latest.setdefault(review.menu, review)
        return [
            {**row, "last_point": latest[row["menu"]].point, "last_ordered_at": latest[row["menu"]].ordered_at}
            for row in queryset
        ]
