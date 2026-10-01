from rest_framework import serializers

from apps.restaurant.menus import get_or_create_menu, normalize_menu, tidy_menu
from apps.restaurant.models import Branch, Restaurant, RestaurantReview
from apps.zone.models import Category


class CategoryTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "keyword"]


class BranchSerializer(serializers.ModelSerializer):
    review_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Branch
        fields = ["id", "name", "review_count"]
        read_only_fields = ["id"]


def ensure_branch_of(restaurant, branch):
    # 다른 음식점(또는 남의 음식점)의 지점을 붙이지 못하게 한다
    if branch is not None and branch.restaurant_id != restaurant.id:
        raise serializers.ValidationError({"branch": "이 음식점의 지점이 아니에요."})


class RestaurantReviewSerializer(serializers.ModelSerializer):
    # API에서는 메뉴를 글자로 주고받는다. 저장할 때 그 음식점의 Menu로 바꾼다.
    menu = serializers.CharField(source="menu_name", max_length=255, allow_blank=True, required=False, default="")
    # 지점은 id로 받는다. 비우면 지점 구분 없음.
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), allow_null=True, required=False)
    branch_name = serializers.CharField(read_only=True)

    class Meta:
        model = RestaurantReview
        fields = ["id", "ordered_at", "menu", "branch", "branch_name", "content", "point"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        ensure_branch_of(validated_data["restaurant"], validated_data.get("branch"))
        name = validated_data.pop("menu_name", "")
        validated_data["menu"] = get_or_create_menu(validated_data["restaurant"], name)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "branch" in validated_data:
            ensure_branch_of(instance.restaurant, validated_data["branch"])
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
    """음식점에 붙일 카테고리 id 목록. 내 카테고리만, 하나 이상."""
    category_ids = serializers.PrimaryKeyRelatedField(source="categories", many=True, write_only=True,
                                                      queryset=Category.objects.all(), allow_empty=False)

    def validate_category_ids(self, categories):
        request = self.context.get("request")
        if request is None or any(category.user_id != request.user.id for category in categories):
            raise serializers.ValidationError("내 카테고리만 붙일 수 있어요.")
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
    branches = serializers.SerializerMethodField()
    menus = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = ["id", "name", "description", "address", "categories", "category_ids",
                  "latest_ordered_at", "ordered_count", "review_avg", "menu_summaries", "review_count", "branches",
                  "menus"]

    def get_menus(self, obj):
        """브랜드의 모든 메뉴(지점 거르기와 상관없이). 리뷰 시트에서 고를 메뉴 목록으로 쓴다."""
        counts = {}
        for review in obj.review_set.all():
            if review.menu_id:
                counts[review.menu_name] = counts.get(review.menu_name, 0) + 1
        return [{"menu": name, "review_count": count}
                for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))]

    def get_branches(self, obj):
        counts = {}
        for review in obj.review_set.all():
            counts[review.branch_id] = counts.get(review.branch_id, 0) + 1
        return [{"id": branch.id, "name": branch.name, "review_count": counts.get(branch.id, 0)}
                for branch in sorted(obj.branches.all(), key=lambda b: b.id)]

    def _branch_filter(self):
        """?branch=<id> 면 그 지점, ?branch=none 이면 지점 없이 남긴 리뷰만, 없으면 전체."""
        request = self.context.get("request")
        value = request.query_params.get("branch") if request is not None else None
        if value == "none":
            return lambda review: review.branch_id is None
        if value and value.isdigit():
            return lambda review: review.branch_id == int(value)
        return lambda review: True

    def get_menu_summaries(self, obj):
        """메뉴별 리뷰 수·평균 만족도·가장 최근 만족도. 리뷰는 최신순으로 prefetch되어 있어 추가 쿼리가 없다."""
        groups = {}
        in_branch = self._branch_filter()
        for review in obj.review_set.all():
            if not in_branch(review):
                continue
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
            # "또 먹었어요"에서 지난번 지점을 미리 골라 두려고 쓴다
            "last_branch": group["last"].branch_id,
        } for group in groups.values()]
        summaries.sort(key=lambda summary: (-summary["review_count"], summary["menu"]))
        return summaries
