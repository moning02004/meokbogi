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
    exclusive_restaurant_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "keyword", "restaurant_count", "exclusive_restaurant_count"]

    # 목록에서는 annotate된 값을 쓰고, 생성·수정 직후처럼 annotate가 없으면 직접 센다
    def get_restaurant_count(self, instance):
        count = getattr(instance, "restaurant_count", None)
        return instance.restaurants.count() if count is None else count

    def get_exclusive_restaurant_count(self, instance):
        count = getattr(instance, "exclusive_restaurant_count", None)
        if count is not None:
            return count
        return sum(1 for restaurant in instance.restaurants.all() if restaurant.categories.count() == 1)


DEFAULT_CATEGORIES = [
    "한식", "일식", "중식", "동남아", "인도", "양식",
    "치킨", "피자", "햄버거", "족발/보쌈", "회", "찜/탕", "분식", "돈까스",
]


class UserCategoriesMixin(serializers.Serializer):
    """장소 응답에 붙이는 카테고리 목록. 카테고리는 사용자에게 속하므로 어느 장소든 같은 목록이다.

    필드 이름은 화면이 쓰던 그대로 category. 장소 여러 개를 내려줄 때 한 번만 읽도록 context에 둔다.
    """
    category = serializers.SerializerMethodField()

    def get_category(self, zone):
        cache = self.context.setdefault("_user_categories", {})
        if zone.user_id not in cache:
            cache[zone.user_id] = CategoryListSerializer(
                Category.objects.filter(user_id=zone.user_id).order_by("id"), many=True).data
        return cache[zone.user_id]


class ZoneListSerializer(UserCategoriesMixin, serializers.ModelSerializer):
    name = serializers.CharField(max_length=100, trim_whitespace=True)

    class Meta:
        model = Zone
        fields = ["id", "name", "category"]

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["user_id"] = user.id
        instance = super().create(validated_data)
        # 기본 카테고리는 처음 한 번만. 장소를 더 만들어도 복제하지 않는다.
        if not Category.objects.filter(user=user).exists():
            Category.objects.bulk_create([Category(user=user, keyword=keyword) for keyword in DEFAULT_CATEGORIES])
        return instance


class ZoneDashboardSerializer(UserCategoriesMixin, serializers.ModelSerializer):
    restaurant_count = serializers.IntegerField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    monthly_visited_count = serializers.IntegerField(read_only=True)
    delicious_restaurants = serializers.SerializerMethodField(read_only=True)
    recent_restaurants = serializers.SerializerMethodField(read_only=True)
    forgotten_restaurants = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Zone
        fields = ["id", "name", "category", "restaurant_count", "review_count", "monthly_visited_count",
                  "delicious_restaurants", "recent_restaurants", "forgotten_restaurants"]

    def create(self, validated_data):
        validated_data["user_id"] = self.context["request"].user.id
        return super().create(validated_data)

    # 목록은 뷰(ZoneDashboardAPIView)가 계산해 붙여 둔다
    def get_delicious_restaurants(self, value):
        return RestaurantListSerializer(value.delicious_restaurants, many=True).data

    def get_recent_restaurants(self, value):
        return RestaurantListSerializer(value.recently_ordered_restaurants, many=True).data

    def get_forgotten_restaurants(self, value):
        return RestaurantListSerializer(value.forgotten_restaurants, many=True).data
