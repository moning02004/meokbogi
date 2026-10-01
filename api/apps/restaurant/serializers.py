from rest_framework import serializers

from apps.restaurant.menus import get_or_create_menu, normalize_menu, tidy_menu
from apps.restaurant.models import Restaurant, RestaurantReview
from apps.zone.models import Category


class CategoryTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "keyword"]


class RestaurantReviewSerializer(serializers.ModelSerializer):
    # API에서는 메뉴를 글자로 주고받는다. 저장할 때 그 음식점의 Menu로 바꾼다.
    menu = serializers.CharField(source="menu_name", max_length=255, allow_blank=True, required=False, default="")

    class Meta:
        model = RestaurantReview
        fields = ["id", "ordered_at", "menu", "content", "point"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        name = validated_data.pop("menu_name", "")
        validated_data["menu"] = get_or_create_menu(validated_data["restaurant"], name)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "menu_name" in validated_data:
            name = tidy_menu(validated_data.pop("menu_name"))
            current = instance.menu
            if (current is not None and name and normalize_menu(name) == current.name_key
                    and current.reviews.exclude(pk=instance.pk).count() == 0):
                # 이 리뷰만 쓰는 메뉴의 띄어쓰기를 고친 것이면 메뉴 이름 자체를 고친다
                current.name = name
                current.save(update_fields=["name"])
                validated_data["menu"] = current
            else:
                validated_data["menu"] = get_or_create_menu(instance.restaurant, name)
        return super().update(instance, validated_data)


class CategoryIdsMixin(serializers.Serializer):
    """음식점에 붙일 카테고리 id 목록. 같은 장소의 내 카테고리만, 하나 이상."""
    category_ids = serializers.PrimaryKeyRelatedField(source="categories", many=True, write_only=True,
                                                      queryset=Category.objects.all(), allow_empty=False)

    def validate_category_ids(self, categories):
        zone = self.context.get("zone") or getattr(self.instance, "zone", None)
        if zone is None or any(category.zone_id != zone.id for category in categories):
            raise serializers.ValidationError("이 장소의 카테고리만 붙일 수 있어요.")
        return categories


class RestaurantListSerializer(CategoryIdsMixin, serializers.ModelSerializer):
    description = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    categories = CategoryTagSerializer(many=True, read_only=True)
    review_avg = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    latest_ordered_at = serializers.DateField(read_only=True)
    ordered_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Restaurant
        fields = ["id", "name", "description", "address", "categories", "category_ids",
                  "latest_ordered_at", "review_avg", "review_count", "ordered_count"]
        read_only_fields = ["id"]


class RestaurantInfoSerializer(CategoryIdsMixin, serializers.ModelSerializer):
    categories = CategoryTagSerializer(many=True, read_only=True)
    latest_ordered_at = serializers.DateField(read_only=True)
    ordered_count = serializers.IntegerField(read_only=True)
    review_avg = serializers.FloatField(read_only=True)
    menu_summaries = serializers.SerializerMethodField()
    review_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Restaurant
        fields = ["id", "name", "description", "address", "categories", "category_ids",
                  "latest_ordered_at", "ordered_count", "review_avg", "menu_summaries", "review_count"]

    def get_menu_summaries(self, obj):
        """메뉴별 리뷰 수·평균 만족도·가장 최근 만족도. 리뷰는 최신순으로 prefetch되어 있어 추가 쿼리가 없다."""
        groups = {}
        for review in obj.review_set.all():
            name = review.menu_name
            group = groups.setdefault(name, {"menu": name, "points": [], "last": None})
            group["points"].append(review.point)
            if group["last"] is None or (review.ordered_at, review.id) > (group["last"].ordered_at, group["last"].id):
                group["last"] = review

        summaries = [{
            "menu": group["menu"],
            "review_avg": sum(group["points"]) / len(group["points"]),
            "review_count": len(group["points"]),
            "last_point": group["last"].point,
            "last_ordered_at": group["last"].ordered_at,
        } for group in groups.values()]
        summaries.sort(key=lambda summary: (-summary["review_count"], summary["menu"]))
        return summaries
