from rest_framework import serializers

from apps.guide.models import MAX_ENTRIES, MAX_MENUS, Guide, GuideEntry


def entry_reviews(entry):
    """이 집의 리뷰. 권하는 지점을 골랐으면 그 지점 것만 본다 (prefetch된 review_set을 쓴다)."""
    reviews = entry.restaurant.review_set.all()
    if entry.branch_id is None:
        return list(reviews)
    return [review for review in reviews if review.branch_id == entry.branch_id]


def visit_days(entry):
    # 같은 날 메뉴 여러 개를 기록해도 주문은 1번
    return {review.ordered_at for review in entry_reviews(entry)}


def menu_counts(entry):
    """그 집에서 기록한 메뉴와 주문 횟수, 많이 먹은 순."""
    counts = {}
    for review in entry.restaurant.review_set.all():
        if review.menu_id:
            counts[review.menu_name] = counts.get(review.menu_name, 0) + 1
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))


def picked_menus(entry):
    """권하는 메뉴 이름, 많이 먹은 순 (한 번도 안 남은 메뉴는 뒤로)."""
    order = {name: index for index, (name, _) in enumerate(menu_counts(entry))}
    return sorted((menu.name for menu in entry.menus.all()), key=lambda name: (order.get(name, len(order)), name))


class GuideEntrySerializer(serializers.ModelSerializer):
    """꾸미기 화면용. 고를 수 있는 메뉴·지점까지 함께 내려 음식점을 하나씩 다시 읽지 않게 한다."""
    restaurant = serializers.SerializerMethodField()
    menus = serializers.SerializerMethodField()
    visit_count = serializers.SerializerMethodField()

    class Meta:
        model = GuideEntry
        fields = ["id", "restaurant", "branch", "comment", "menus", "visit_count"]

    def get_restaurant(self, entry):
        restaurant = entry.restaurant
        return {
            "id": restaurant.id,
            "name": restaurant.name,
            "zone": restaurant.zone.name,
            "description": restaurant.description,
            "address": restaurant.address,
            "categories": [category.keyword for category in restaurant.categories.all()],
            "branches": [{"id": branch.id, "name": branch.name}
                         for branch in sorted(restaurant.branches.all(), key=lambda b: b.id)],
            "menus": [{"menu": name, "review_count": count} for name, count in menu_counts(entry)],
        }

    def get_menus(self, entry):
        return picked_menus(entry)

    def get_visit_count(self, entry):
        return len(visit_days(entry))


class GuideSerializer(serializers.ModelSerializer):
    entry_count = serializers.SerializerMethodField()

    class Meta:
        model = Guide
        fields = ["id", "title", "intro", "edition", "grade", "show_address", "show_visits", "share_token", "entry_count",
                  "updated_at"]
        read_only_fields = ["id", "share_token", "updated_at"]

    def get_entry_count(self, guide):
        count = getattr(guide, "entry_count", None)
        return guide.entries.count() if count is None else count


class GuideDetailSerializer(GuideSerializer):
    entries = GuideEntrySerializer(many=True, read_only=True)

    class Meta(GuideSerializer.Meta):
        fields = GuideSerializer.Meta.fields + ["entries"]

    def get_entry_count(self, guide):
        return len(guide.entries.all())


class EntryWriteSerializer(serializers.Serializer):
    restaurant = serializers.IntegerField()
    branch = serializers.IntegerField(allow_null=True, required=False, default=None)
    comment = serializers.CharField(max_length=100, allow_blank=True, required=False, default="")
    # 음식점 주소. 보내면 음식점 자체의 주소를 고친다 (등록할 때는 주소를 안 적으니 골목에 실을 때 적는다).
    # 안 보내면 그대로 둔다.
    address = serializers.CharField(max_length=255, allow_blank=True, required=False)
    # 메뉴는 리뷰와 같이 글자로 주고받는다. 그 음식점에서 기록한 메뉴여야 한다.
    menus = serializers.ListField(child=serializers.CharField(max_length=255), required=False, default=list)

    def validate_menus(self, menus):
        if len(menus) > MAX_MENUS:
            raise serializers.ValidationError(f"권하는 메뉴는 {MAX_MENUS}개까지 고를 수 있어요.")
        return menus


class EntriesWriteSerializer(serializers.Serializer):
    entries = EntryWriteSerializer(many=True)

    def validate_entries(self, entries):
        if len(entries) > MAX_ENTRIES:
            raise serializers.ValidationError(f"한 골목에는 {MAX_ENTRIES}곳까지 실을 수 있어요.")
        ids = [entry["restaurant"] for entry in entries]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("같은 음식점을 두 번 실을 수 없어요.")
        return entries


def public_guide(guide):
    """로그인 없이 내보내는 내용. 골목에 직접 적은 것과 가게 이름·카테고리만 나간다.

    리뷰 글·만족도·주문 날짜·장소 이름은 여기에 넣지 않는다. 주문 횟수와 첫 주문한 달, 주소는 골목 설정을 따른다.
    """
    entries = []
    for entry in guide.entries.all():
        restaurant = entry.restaurant
        item = {
            "name": restaurant.name,
            "categories": [category.keyword for category in restaurant.categories.all()],
            "branch": entry.branch.name if entry.branch_id else "",
            "comment": entry.comment,
            "menus": picked_menus(entry),
        }
        if guide.show_address:
            item["address"] = restaurant.address
        if guide.show_visits:
            days = visit_days(entry)
            item["visit_count"] = len(days)
            item["first_ordered_month"] = min(days).strftime("%Y-%m") if days else None
        entries.append(item)
    return {"title": guide.title, "intro": guide.intro, "edition": guide.edition,
            "grade": guide.grade, "grade_label": guide.grade_label, "entries": entries}
