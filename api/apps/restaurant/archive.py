"""내 기록 내보내기·가져오기.

파일 형식(JSON, version 3)은 장소 → 음식점 → 리뷰를 중첩하고, 카테고리는 장소의 태그 목록과
음식점마다 붙은 태그 이름, 지점은 음식점의 지점 이름 목록과 리뷰마다 지점 이름으로 담는다.
id를 담지 않아 다른 서버로 옮겨도 그대로 되살릴 수 있다.
예전 파일도 가져온다: version 1(1.4~1.5, 장소 → 카테고리 → 음식점)은 version 2 모양으로 바꾸고,
version 2(지점 없음)는 그대로 읽는다.

가져오기는 덮어쓰지 않고 합친다.
- 장소는 이름, 카테고리·음식점은 공백·대소문자를 무시한 이름으로 같은 것을 찾는다.
- 이미 있는 음식점에는 파일의 카테고리 태그를 더한다 (빼지는 않는다).
- 지점은 음식점 안에서 공백·대소문자를 무시한 이름으로 같은 것을 찾는다.
- 리뷰는 (먹은 날, 메뉴, 지점, 만족도, 한줄평)이 모두 같으면 이미 있는 것으로 보고 건너뛴다.
  같은 파일을 두 번 가져와도 늘어나지 않는다.
"""
import csv
import io

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import serializers

from apps.restaurant.menus import get_or_create_menu, normalize_menu, tidy_menu
from apps.restaurant.models import Branch, Restaurant, RestaurantReview
from apps.zone.models import Category, Zone

ARCHIVE_FORMAT = "meokbogi-archive"
ARCHIVE_VERSION = 3
POINT_LABELS = {1: "만족", 0: "보통", -1: "실망"}


# ---------------------------------------------------------------- 내보내기

def build_archive(user):
    zones = Zone.objects.filter(user=user).order_by("id").prefetch_related(
        Prefetch("category_set", queryset=Category.objects.order_by("id")),
        Prefetch("restaurant_set", queryset=Restaurant.objects.order_by("id").prefetch_related(
            Prefetch("categories", queryset=Category.objects.order_by("id")),
            Prefetch("branches", queryset=Branch.objects.order_by("id")),
            Prefetch("review_set", queryset=RestaurantReview.objects.select_related("menu", "branch")
                     .order_by("ordered_at", "id")),
        )),
    )
    return {
        "format": ARCHIVE_FORMAT,
        "version": ARCHIVE_VERSION,
        "exported_at": timezone.localtime().isoformat(timespec="seconds"),
        "zones": [
            {
                "name": zone.name,
                "categories": [category.keyword for category in zone.category_set.all()],
                "restaurants": [
                    {
                        "name": restaurant.name,
                        "description": restaurant.description,
                        "address": restaurant.address,
                        "categories": [category.keyword for category in restaurant.categories.all()],
                        "branches": [branch.name for branch in restaurant.branches.all()],
                        "created_at": timezone.localtime(restaurant.created_at).isoformat(timespec="seconds"),
                        "reviews": [
                            {
                                "ordered_at": review.ordered_at.isoformat(),
                                "menu": review.menu_name,
                                "branch": review.branch_name,
                                "point": review.point,
                                "content": review.content,
                            }
                            for review in restaurant.review_set.all()
                        ],
                    }
                    for restaurant in zone.restaurant_set.all()
                ],
            }
            for zone in zones
        ],
    }


CSV_HEADER = ["장소", "카테고리", "음식점", "주소", "설명", "먹은 날", "지점", "메뉴", "만족도", "한줄평"]


def build_csv(user):
    """리뷰 한 건이 한 줄. 리뷰가 없는 음식점도 한 줄로 남긴다. 엑셀이 한글을 알아보도록 BOM을 붙인다."""
    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADER)
    for zone in build_archive(user)["zones"]:
        for restaurant in zone["restaurants"]:
            base = [zone["name"], " / ".join(restaurant["categories"]), restaurant["name"], restaurant["address"],
                    restaurant["description"]]
            if not restaurant["reviews"]:
                writer.writerow(base + ["", "", "", "", ""])
            for review in restaurant["reviews"]:
                writer.writerow(base + [review["ordered_at"], review["branch"], review["menu"],
                                        POINT_LABELS[review["point"]], review["content"]])
    return buffer.getvalue()


# ---------------------------------------------------------------- 가져오기

class ReviewArchiveSerializer(serializers.Serializer):
    ordered_at = serializers.DateField()
    menu = serializers.CharField(max_length=255, allow_blank=True, default="", trim_whitespace=False)
    branch = serializers.CharField(max_length=100, allow_blank=True, default="")
    point = serializers.ChoiceField(choices=[1, 0, -1])
    content = serializers.CharField(max_length=255, allow_blank=True, default="")


class RestaurantArchiveSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=100, allow_blank=True, default="")
    address = serializers.CharField(max_length=255, allow_blank=True, default="")
    categories = serializers.ListField(child=serializers.CharField(max_length=100), default=list)
    branches = serializers.ListField(child=serializers.CharField(max_length=100), default=list)
    reviews = ReviewArchiveSerializer(many=True, default=list)


class ZoneArchiveSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    categories = serializers.ListField(child=serializers.CharField(max_length=100), default=list)
    restaurants = RestaurantArchiveSerializer(many=True, default=list)


class ArchiveSerializer(serializers.Serializer):
    format = serializers.CharField()
    version = serializers.IntegerField()
    zones = ZoneArchiveSerializer(many=True)

    def validate_format(self, value):
        if value != ARCHIVE_FORMAT:
            raise serializers.ValidationError("먹보기에서 내보낸 파일이 아니에요.")
        return value

    def validate_version(self, value):
        if value > ARCHIVE_VERSION:
            raise serializers.ValidationError("더 새로운 버전의 먹보기에서 내보낸 파일이에요. 서버를 먼저 업데이트해주세요.")
        return value

    def to_internal_value(self, data):
        if isinstance(data, dict) and data.get("version") == 1:
            data = upgrade_v1(data)
        return super().to_internal_value(data)


def upgrade_v1(data):
    """version 1(장소 → 카테고리 → 음식점)을 version 2(장소 → 음식점, 카테고리는 태그)로 바꾼다."""
    zones = []
    for zone in data.get("zones") or []:
        if not isinstance(zone, dict):
            zones.append(zone)  # 모양이 틀린 건 검증에서 걸러지게 그대로 둔다
            continue
        categories, restaurants = [], []
        for category in zone.get("categories") or []:
            keyword = category.get("keyword", "") if isinstance(category, dict) else category
            categories.append(keyword)
            for restaurant in (category.get("restaurants") or []) if isinstance(category, dict) else []:
                if isinstance(restaurant, dict):
                    restaurant = {**restaurant, "categories": [keyword]}
                restaurants.append(restaurant)
        zones.append({"name": zone.get("name"), "categories": categories, "restaurants": restaurants})
    return {**data, "version": 2, "zones": zones}


def _name_key(value):
    return normalize_menu(value)


def import_archive(user, archive, dry_run=False):
    """검증된 archive(dict, version 2)를 합친다. 무엇이 새로 생기고 무엇을 건너뛰었는지 센 결과를 돌려준다.

    dry_run이면 같은 계산을 하고 되돌린다 (가져오기 전 미리보기).
    """
    summary = {key: 0 for key in ("zones_created", "categories_created", "restaurants_created",
                                  "restaurants_matched", "reviews_created", "reviews_skipped")}

    with transaction.atomic():
        zones_by_name = {zone.name.strip(): zone for zone in Zone.objects.filter(user=user)}

        for zone_data in archive["zones"]:
            zone_name = zone_data["name"].strip()
            zone = zones_by_name.get(zone_name)
            if zone is None:
                # 장소 생성 API와 달리 기본 카테고리를 만들지 않는다. 파일에 있는 카테고리만 만든다.
                zone = Zone.objects.create(user=user, name=zone_name)
                zones_by_name[zone_name] = zone
                summary["zones_created"] += 1

            categories = {_name_key(c.keyword): c for c in Category.objects.filter(zone=zone)}

            def category_for(keyword):
                keyword = keyword.strip()
                if not keyword:
                    return None
                category = categories.get(_name_key(keyword))
                if category is None:
                    category = Category.objects.create(zone=zone, keyword=keyword)
                    categories[_name_key(keyword)] = category
                    summary["categories_created"] += 1
                return category

            for keyword in zone_data["categories"]:
                category_for(keyword)

            restaurants = {_name_key(r.name): r for r in Restaurant.objects.filter(zone=zone)}
            for restaurant_data in zone_data["restaurants"]:
                name = restaurant_data["name"].strip()
                restaurant = restaurants.get(_name_key(name))
                if restaurant is None:
                    restaurant = Restaurant.objects.create(zone=zone, name=name,
                                                           description=restaurant_data["description"],
                                                           address=restaurant_data["address"])
                    restaurants[_name_key(name)] = restaurant
                    summary["restaurants_created"] += 1
                else:
                    # 이미 있는 음식점의 이름·설명은 그대로 둔다 (지금 서버 쪽이 더 최신일 수 있다)
                    summary["restaurants_matched"] += 1

                tags = [category_for(keyword) for keyword in restaurant_data["categories"]]
                restaurant.categories.add(*[tag for tag in tags if tag is not None])

                branches = {b.name_key: b for b in Branch.objects.filter(restaurant=restaurant)}

                def branch_for(name, restaurant=restaurant, branches=branches):
                    name = tidy_menu(name)
                    if not name:
                        return None
                    if normalize_menu(name) not in branches:
                        branches[normalize_menu(name)] = Branch.objects.create(
                            restaurant=restaurant, name=name, name_key=normalize_menu(name))
                    return branches[normalize_menu(name)]

                for name in restaurant_data["branches"]:
                    branch_for(name)
                _merge_reviews(user, restaurant, restaurant_data["reviews"], summary, branch_for)

        if dry_run:
            transaction.set_rollback(True)

    return summary


def _merge_reviews(user, restaurant, reviews, summary, branch_for):
    existing = RestaurantReview.objects.filter(restaurant=restaurant).select_related("menu", "branch")
    seen = {(r.ordered_at, normalize_menu(r.menu_name), normalize_menu(r.branch_name), r.point, r.content.strip())
            for r in existing}

    to_create = []
    for review in reviews:
        menu_name = tidy_menu(review["menu"])
        signature = (review["ordered_at"], normalize_menu(menu_name), normalize_menu(review["branch"]), review["point"],
                     review["content"].strip())
        if signature in seen:
            summary["reviews_skipped"] += 1
            continue
        seen.add(signature)
        # 같은 음식점의 메뉴 표기를 맞춘다 (리뷰 작성과 같은 규칙: 처음 쓴 표기)
        to_create.append(RestaurantReview(restaurant=restaurant, user=user, ordered_at=review["ordered_at"],
                                          menu=get_or_create_menu(restaurant, menu_name),
                                          branch=branch_for(review["branch"]), point=review["point"],
                                          content=review["content"].strip()))

    RestaurantReview.objects.bulk_create(to_create)
    summary["reviews_created"] += len(to_create)
