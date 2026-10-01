"""내 기록 내보내기·가져오기.

파일 형식(JSON)은 장소 → 카테고리 → 음식점 → 리뷰를 그대로 중첩한 구조이고 id를 담지 않는다.
그래서 다른 서버로 옮기거나, 2.0처럼 데이터 구조가 바뀐 뒤에도 같은 파일로 되살릴 수 있다.

가져오기는 덮어쓰지 않고 합친다.
- 장소는 이름, 카테고리는 공백·대소문자를 무시한 이름, 음식점은 장소 안에서 같은 이름이면 같은 것으로 본다.
- 리뷰는 (먹은 날, 메뉴, 만족도, 한줄평)이 모두 같으면 이미 있는 것으로 보고 건너뛴다.
  같은 파일을 두 번 가져와도 늘어나지 않는다.
"""
import csv
import io

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.restaurant.menus import normalize_menu, tidy_menu
from apps.restaurant.models import Restaurant, RestaurantReview
from apps.zone.models import Category, Zone

ARCHIVE_FORMAT = "meokbogi-archive"
ARCHIVE_VERSION = 1
POINT_LABELS = {1: "만족", 0: "보통", -1: "실망"}


# ---------------------------------------------------------------- 내보내기

def build_archive(user):
    zones = (Zone.objects.filter(user=user).order_by("id")
             .prefetch_related("category_set__restaurant_set__review_set"))
    return {
        "format": ARCHIVE_FORMAT,
        "version": ARCHIVE_VERSION,
        "exported_at": timezone.localtime().isoformat(timespec="seconds"),
        "zones": [
            {
                "name": zone.name,
                "categories": [
                    {
                        "keyword": category.keyword,
                        "restaurants": [
                            {
                                "name": restaurant.name,
                                "description": restaurant.description,
                                "address": restaurant.address,
                                "created_at": timezone.localtime(restaurant.created_at).isoformat(timespec="seconds"),
                                "reviews": [
                                    {
                                        "ordered_at": review.ordered_at.isoformat(),
                                        "menu": review.menu,
                                        "point": review.point,
                                        "content": review.content,
                                    }
                                    for review in sorted(restaurant.review_set.all(),
                                                         key=lambda r: (r.ordered_at, r.id))
                                ],
                            }
                            for restaurant in sorted(category.restaurant_set.all(), key=lambda r: r.id)
                        ],
                    }
                    for category in sorted(zone.category_set.all(), key=lambda c: c.id)
                ],
            }
            for zone in zones
        ],
    }


CSV_HEADER = ["장소", "카테고리", "음식점", "주소", "설명", "먹은 날", "메뉴", "만족도", "한줄평"]


def build_csv(user):
    """리뷰 한 건이 한 줄. 리뷰가 없는 음식점도 한 줄로 남긴다. 엑셀이 한글을 알아보도록 BOM을 붙인다."""
    buffer = io.StringIO()
    buffer.write("﻿")
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADER)
    for zone in build_archive(user)["zones"]:
        for category in zone["categories"]:
            for restaurant in category["restaurants"]:
                base = [zone["name"], category["keyword"], restaurant["name"], restaurant["address"],
                        restaurant["description"]]
                if not restaurant["reviews"]:
                    writer.writerow(base + ["", "", "", ""])
                for review in restaurant["reviews"]:
                    writer.writerow(base + [review["ordered_at"], review["menu"], POINT_LABELS[review["point"]],
                                            review["content"]])
    return buffer.getvalue()


# ---------------------------------------------------------------- 가져오기

class ReviewArchiveSerializer(serializers.Serializer):
    ordered_at = serializers.DateField()
    menu = serializers.CharField(max_length=255, allow_blank=True, default="", trim_whitespace=False)
    point = serializers.ChoiceField(choices=[1, 0, -1])
    content = serializers.CharField(max_length=255, allow_blank=True, default="")


class RestaurantArchiveSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=100, allow_blank=True, default="")
    address = serializers.CharField(max_length=255, allow_blank=True, default="")
    reviews = ReviewArchiveSerializer(many=True, default=list)


class CategoryArchiveSerializer(serializers.Serializer):
    keyword = serializers.CharField(max_length=100)
    restaurants = RestaurantArchiveSerializer(many=True, default=list)


class ZoneArchiveSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    categories = CategoryArchiveSerializer(many=True, default=list)


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


def _name_key(value):
    return normalize_menu(value)


def import_archive(user, archive, dry_run=False):
    """검증된 archive(dict)를 합친다. 무엇이 새로 생기고 무엇을 건너뛰었는지 센 결과를 돌려준다.

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
            restaurants = {_name_key(r.name): r for r in Restaurant.objects.filter(category__zone=zone)}

            for category_data in zone_data["categories"]:
                keyword = category_data["keyword"].strip()
                category = categories.get(_name_key(keyword))
                if category is None:
                    category = Category.objects.create(zone=zone, keyword=keyword)
                    categories[_name_key(keyword)] = category
                    summary["categories_created"] += 1

                for restaurant_data in category_data["restaurants"]:
                    name = restaurant_data["name"].strip()
                    restaurant = restaurants.get(_name_key(name))
                    if restaurant is None:
                        restaurant = Restaurant.objects.create(category=category, name=name,
                                                               description=restaurant_data["description"],
                                                               address=restaurant_data["address"])
                        restaurants[_name_key(name)] = restaurant
                        summary["restaurants_created"] += 1
                    else:
                        # 이미 있는 음식점의 카테고리·설명은 그대로 둔다 (지금 서버 쪽이 더 최신일 수 있다)
                        summary["restaurants_matched"] += 1

                    _merge_reviews(user, restaurant, restaurant_data["reviews"], summary)

        if dry_run:
            transaction.set_rollback(True)

    return summary


def _merge_reviews(user, restaurant, reviews, summary):
    existing = list(RestaurantReview.objects.filter(restaurant=restaurant).values_list(
        "ordered_at", "menu", "point", "content"))
    # 같은 음식점의 메뉴 표기를 맞춘다 (리뷰 작성과 같은 규칙: 처음 쓴 표기)
    spelling = {}
    for _, menu, _, _ in existing:
        if menu:
            spelling.setdefault(normalize_menu(menu), menu)
    seen = {(ordered_at, normalize_menu(menu), point, content.strip()) for ordered_at, menu, point, content in existing}

    to_create = []
    for review in reviews:
        menu = tidy_menu(review["menu"])
        if menu:
            menu = spelling.setdefault(normalize_menu(menu), menu)
        signature = (review["ordered_at"], normalize_menu(menu), review["point"], review["content"].strip())
        if signature in seen:
            summary["reviews_skipped"] += 1
            continue
        seen.add(signature)
        to_create.append(RestaurantReview(restaurant=restaurant, user=user, ordered_at=review["ordered_at"],
                                          menu=menu, point=review["point"], content=review["content"].strip()))

    RestaurantReview.objects.bulk_create(to_create)
    summary["reviews_created"] += len(to_create)
