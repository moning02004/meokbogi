from rest_framework import serializers

from apps.restaurant.serializers import RestaurantListSerializer
from apps.zone.models import Zone, Category


class CategoryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "keyword"]


class ZoneListSerializer(serializers.ModelSerializer):
    category = CategoryListSerializer(source="category_set", many=True, read_only=True)

    class Meta:
        model = Zone
        fields = ["id", "name", "category"]

    def create(self, validated_data):
        validated_data["user_id"] = self.context["request"].user.id
        instance = super().create(validated_data)

        category_keywords = ["치킨", "피자", "파스타", "족발/보쌈", "회", "찜/탕", "중식", "분식", "돈까스", "일식", "동남아"]
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
                  "delicious_restaurants",
                  "recent_restaurants"]

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
