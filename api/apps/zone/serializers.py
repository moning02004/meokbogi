from rest_framework import serializers

from apps.restaurant.serializers import RestaurantListSerializer
from apps.zone.models import Zone, Category


class CategoryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "keyword"]


class CategoryManageSerializer(serializers.ModelSerializer):
    """카테고리 관리 화면용. 음식점이 몇 개 묶여 있는지 함께 보여준다."""

    restaurant_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "keyword", "restaurant_count"]

    def get_restaurant_count(self, instance):
        # 목록에서는 annotate된 값을 쓰고, 생성 직후처럼 annotate가 없으면 직접 센다
        count = getattr(instance, "restaurant_count", None)
        return instance.restaurant_set.count() if count is None else count


class ZoneListSerializer(serializers.ModelSerializer):
    category = CategoryListSerializer(source="category_set", many=True, read_only=True)

    class Meta:
        model = Zone
        fields = ["id", "name", "category"]

    def create(self, validated_data):
        validated_data["user_id"] = self.context["request"].user.id
        instance = super().create(validated_data)

        category_keywords = [
            "한식", "일식", "중식", "동남아", "인도", "양식",
            "치킨", "피자", "햄버거", "족발/보쌈", "회", "찜/탕", "분식", "돈까스",
            ]
        bulk_creates = list()
        for keyword in category_keywords:
            bulk_creates.append(Category(zone=instance, keyword=keyword))
        Category.objects.bulk_create(bulk_creates)

        return instance


class ZoneDashboardSerializer(serializers.ModelSerializer):
    category = CategoryListSerializer(source="category_set", many=True, read_only=True)
    restaurant_count = serializers.IntegerField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    monthly_visited_count = serializers.IntegerField(read_only=True)
    delicious_restaurants = serializers.SerializerMethodField(read_only=True)
    recent_restaurants = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Zone
        fields = ["id", "name", "category", "restaurant_count", "review_count", "monthly_visited_count",
                  "delicious_restaurants", "recent_restaurants"]

    def create(self, validated_data):
        validated_data["user_id"] = self.context["request"].user.id
        return super().create(validated_data)

    def get_delicious_restaurants(self, value):
        restaurants = []
        for category in value.category_set.all():
            restaurants.extend(category.delicious_restaurants)

        restaurants.sort(key=lambda r: r.review_avg, reverse=True)
        return RestaurantListSerializer(restaurants[:5], many=True).data

    def get_recent_restaurants(self, value):
        restaurants = []
        for category in value.category_set.all():
            restaurants.extend(category.recently_ordered_restaurants)

        restaurants.sort(key=lambda r: r.latest_ordered_at, reverse=True)
        return RestaurantListSerializer(restaurants[:3], many=True).data
