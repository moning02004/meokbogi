"""내 기록 내보내기·가져오기.

파일 형식(JSON, version 5)은 장소 → 음식점 → 리뷰를 중첩한다. 카테고리는 사용자 것이라 파일 맨 위의
목록과 음식점마다 붙은 이름으로, 지점은 음식점의 지점 이름 목록과 리뷰마다 지점 이름으로 담는다.
골목(먹골목)은 파일 맨 위의 guides에 담고, 실린 집은 장소 이름과 음식점 이름으로 가리킨다 (version 5부터).
id를 담지 않아 다른 서버로 옮겨도 그대로 되살릴 수 있다. 공개 주소는 담지 않으므로 가져온 골목은 비공개로 시작한다.
예전 파일도 가져온다: version 1(1.4~1.5, 장소 → 카테고리 → 음식점)은 version 2 모양으로 바꾸고,
version 2·3의 장소별 카테고리 목록은 사용자 카테고리로 합친다.

가져오기는 덮어쓰지 않고 합친다.
- 장소는 이름, 카테고리·음식점은 공백·대소문자를 무시한 이름으로 같은 것을 찾는다.
- 이미 있는 음식점에는 파일의 카테고리 태그를 더한다 (빼지는 않는다).
- 지점은 음식점 안에서 공백·대소문자를 무시한 이름으로 같은 것을 찾는다.
- 리뷰는 (먹은 날, 메뉴, 지점, 만족도, 한줄평)이 모두 같으면 이미 있는 것으로 보고 건너뛴다.
  같은 파일을 두 번 가져와도 늘어나지 않는다.
- 골목은 제목이 같은 것이 이미 있으면 건너뛴다 (지금 서버에서 꾸민 쪽을 남긴다).
"""
import csv
import io

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import serializers

from apps.guide.models import GuideEntry
from apps.restaurant.menus import normalize_menu, tidy_menu
from apps.restaurant.models import Branch, Menu, Restaurant, RestaurantReview
from apps.zone.models import Category, Zone

ARCHIVE_FORMAT = "meokbogi-archive"
ARCHIVE_VERSION = 5
POINT_LABELS = {1: "만족", 0: "보통", -1: "실망"}


# ---------------------------------------------------------------- 내보내기

def build_archive(user):
    zones = Zone.objects.filter(user=user).order_by("id").prefetch_related(
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
        "categories": list(Category.objects.filter(user=user).order_by("id").values_list("keyword", flat=True)),
        "zones": [
            {
                "name": zone.name,
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
        "guides": [
            {
                "title": guide.title,
                "intro": guide.intro,
                "edition": guide.edition,
                "grade": guide.grade,
                "pamphlet_layout": guide.pamphlet_layout,
                "show_address": guide.show_address,
                "show_visits": guide.show_visits,
                "entries": [
                    {
                        "zone": entry.restaurant.zone.name,
                        "restaurant": entry.restaurant.name,
                        "branch": entry.branch.name if entry.branch_id else "",
                        "comment": entry.comment,
                        "menus": [menu.name for menu in entry.menus.all()],
                    }
                    for entry in sorted(guide.entries.all(), key=lambda e: (e.position, e.id))
                ],
            }
            for guide in user.guides.order_by("id").prefetch_related(
                "entries__restaurant__zone", "entries__branch", "entries__menus")
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
    # version 2·3: 장소마다 카테고리 목록이 있었다. 가져올 때 사용자 카테고리로 합친다.
    categories = serializers.ListField(child=serializers.CharField(max_length=100), default=list)
    restaurants = RestaurantArchiveSerializer(many=True, default=list)


class GuideEntryArchiveSerializer(serializers.Serializer):
    zone = serializers.CharField(max_length=100)
    restaurant = serializers.CharField(max_length=100)
    branch = serializers.CharField(max_length=100, allow_blank=True, default="")
    comment = serializers.CharField(max_length=100, allow_blank=True, default="")
    menus = serializers.ListField(child=serializers.CharField(max_length=255), default=list)


class GuideArchiveSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=50)
    intro = serializers.CharField(max_length=200, allow_blank=True, default="")
    edition = serializers.CharField(max_length=20, allow_blank=True, default="")
    show_address = serializers.BooleanField(default=True)
    show_visits = serializers.BooleanField(default=True)
    # 2.5부터. 없으면 등급 없음.
    grade = serializers.ChoiceField(choices=[0, 1, 2, 3], default=0)
    # 2.6부터. 없으면 기본 모양(차림표).
    pamphlet_layout = serializers.ChoiceField(choices=["menu", "booklet", "list", "receipt"], default="menu")
    entries = GuideEntryArchiveSerializer(many=True, default=list)


class ArchiveSerializer(serializers.Serializer):
    format = serializers.CharField()
    version = serializers.IntegerField()
    categories = serializers.ListField(child=serializers.CharField(max_length=100), default=list)
    zones = ZoneArchiveSerializer(many=True)
    # version 5부터. 예전 파일에는 없다.
    guides = GuideArchiveSerializer(many=True, default=list)

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


class _Place:
    """가져오는 동안 음식점 하나에 대해 알고 있는 것. 새 음식점은 아직 저장 전이라 id가 없다."""

    def __init__(self, restaurant):
        self.restaurant = restaurant
        self.category_ids = set()
        self.branches = {}   # name_key → Branch
        self.menus = {}      # name_key → Menu
        self.seen = set()    # 이미 있는 리뷰의 (먹은 날, 메뉴, 지점, 만족도, 한줄평)


def _existing_places(user):
    """사용자의 음식점과 태그·지점·메뉴·리뷰를 한 번에 읽는다. 음식점마다 다시 읽지 않으려고."""
    places = {restaurant.id: _Place(restaurant) for restaurant in Restaurant.objects.filter(zone__user=user)}
    for restaurant_id, category_id in Restaurant.categories.through.objects.filter(
            restaurant_id__in=places).values_list("restaurant_id", "category_id"):
        places[restaurant_id].category_ids.add(category_id)
    for branch in Branch.objects.filter(restaurant_id__in=places):
        places[branch.restaurant_id].branches[branch.name_key] = branch
    for menu in Menu.objects.filter(restaurant_id__in=places):
        places[menu.restaurant_id].menus[menu.name_key] = menu
    for restaurant_id, ordered_at, menu, branch, point, content in RestaurantReview.objects.filter(
            restaurant_id__in=places).values_list("restaurant_id", "ordered_at", "menu__name", "branch__name", "point",
                                                  "content"):
        places[restaurant_id].seen.add((ordered_at, normalize_menu(menu), normalize_menu(branch), point, content.strip()))
    return places


def import_archive(user, archive, dry_run=False):
    """검증된 archive(dict, version 2)를 합친다. 무엇이 새로 생기고 무엇을 건너뛰었는지 센 결과를 돌려준다.

    dry_run이면 같은 계산을 하고 되돌린다 (가져오기 전 미리보기).
    이미 있는 기록은 처음에 한 번에 읽고, 새로 만들 것은 모아 두었다가 끝에 종류별로 한꺼번에 저장한다.
    """
    summary = {key: 0 for key in ("zones_created", "categories_created", "restaurants_created",
                                  "restaurants_matched", "reviews_created", "reviews_skipped",
                                  "guides_created", "guides_skipped")}

    with transaction.atomic():
        zones_by_name = {zone.name.strip(): zone for zone in Zone.objects.filter(user=user)}
        categories = {_name_key(c.keyword): c for c in Category.objects.filter(user=user)}

        def category_for(keyword):
            keyword = keyword.strip()
            if not keyword:
                return None
            category = categories.get(_name_key(keyword))
            if category is None:
                category = Category.objects.create(user=user, keyword=keyword)
                categories[_name_key(keyword)] = category
                summary["categories_created"] += 1
            return category

        for keyword in archive["categories"]:
            category_for(keyword)

        # (장소 id, 이름 키) → _Place
        places = {(place.restaurant.zone_id, _name_key(place.restaurant.name)): place
                  for place in _existing_places(user).values()}
        new_restaurants, new_tags, new_branches, new_menus, new_reviews = [], [], [], [], []

        def branch_for(place, name):
            name = tidy_menu(name)
            if not name:
                return None
            key = normalize_menu(name)
            if key not in place.branches:
                place.branches[key] = Branch(restaurant=place.restaurant, name=name, name_key=key)
                new_branches.append(place.branches[key])
            return place.branches[key]

        def menu_for(place, name):
            # 리뷰 작성과 같은 규칙: 같은 음식점에서 공백·대소문자만 다른 메뉴는 처음 쓴 표기를 쓴다
            name = tidy_menu(name)
            if not name:
                return None
            key = normalize_menu(name)
            if key not in place.menus:
                place.menus[key] = Menu(restaurant=place.restaurant, name=name, name_key=key)
                new_menus.append(place.menus[key])
            return place.menus[key]

        for zone_data in archive["zones"]:
            zone_name = zone_data["name"].strip()
            zone = zones_by_name.get(zone_name)
            if zone is None:
                # 장소 생성 API와 달리 기본 카테고리를 만들지 않는다. 파일에 있는 카테고리만 만든다.
                zone = Zone.objects.create(user=user, name=zone_name)
                zones_by_name[zone_name] = zone
                summary["zones_created"] += 1

            for keyword in zone_data["categories"]:
                category_for(keyword)

            for restaurant_data in zone_data["restaurants"]:
                name = restaurant_data["name"].strip()
                place = places.get((zone.id, _name_key(name)))
                if place is None:
                    place = _Place(Restaurant(zone=zone, name=name, description=restaurant_data["description"],
                                              address=restaurant_data["address"]))
                    places[(zone.id, _name_key(name))] = place
                    new_restaurants.append(place.restaurant)
                    summary["restaurants_created"] += 1
                else:
                    # 이미 있는 음식점의 이름·설명은 그대로 둔다 (지금 서버 쪽이 더 최신일 수 있다)
                    summary["restaurants_matched"] += 1

                # 이미 붙은 태그에 더하기만 한다
                for category in filter(None, map(category_for, restaurant_data["categories"])):
                    if category.id not in place.category_ids:
                        place.category_ids.add(category.id)
                        new_tags.append((place.restaurant, category.id))

                for branch_name in restaurant_data["branches"]:
                    branch_for(place, branch_name)

                for review in restaurant_data["reviews"]:
                    menu_name = tidy_menu(review["menu"])
                    signature = (review["ordered_at"], normalize_menu(menu_name), normalize_menu(review["branch"]),
                                 review["point"], review["content"].strip())
                    if signature in place.seen:
                        summary["reviews_skipped"] += 1
                        continue
                    place.seen.add(signature)
                    new_reviews.append(RestaurantReview(
                        restaurant=place.restaurant, user=user, ordered_at=review["ordered_at"],
                        menu=menu_for(place, menu_name), branch=branch_for(place, review["branch"]),
                        point=review["point"], content=review["content"].strip()))

        # 음식점을 먼저 저장해야 id가 생기고, 그 뒤에 음식점을 가리키는 것들을 저장할 수 있다
        Restaurant.objects.bulk_create(new_restaurants)
        Tag = Restaurant.categories.through
        Tag.objects.bulk_create([Tag(restaurant_id=restaurant.id, category_id=category_id)
                                 for restaurant, category_id in new_tags])
        Branch.objects.bulk_create(new_branches)
        Menu.objects.bulk_create(new_menus)
        RestaurantReview.objects.bulk_create(new_reviews)
        summary["reviews_created"] = len(new_reviews)

        _merge_guides(user, archive["guides"], summary)

        if dry_run:
            transaction.set_rollback(True)

    return summary


def _merge_guides(user, guides, summary):
    """골목을 되살린다. 음식점·리뷰를 다 합친 뒤에 불러서 실린 집과 메뉴를 이름으로 찾는다.

    찾지 못한 집·지점·메뉴는 조용히 뺀다 (파일을 손으로 고친 경우). 같은 집이 두 번 나오면 처음 것만 싣는다.
    """
    titles = {_name_key(guide.title) for guide in user.guides.all()}
    restaurants = {(r.zone.name.strip(), _name_key(r.name)): r for r in
                   Restaurant.objects.filter(zone__user=user).select_related("zone")
                   .prefetch_related("branches", "menus")}

    entries, entry_menus = [], []
    for guide_data in guides:
        title = guide_data["title"].strip()
        if _name_key(title) in titles:
            summary["guides_skipped"] += 1
            continue
        titles.add(_name_key(title))
        guide = user.guides.create(title=title, intro=guide_data["intro"], edition=guide_data["edition"],
                                   show_address=guide_data["show_address"], show_visits=guide_data["show_visits"],
                                   grade=guide_data["grade"], pamphlet_layout=guide_data["pamphlet_layout"])
        summary["guides_created"] += 1

        seen = set()
        for entry_data in guide_data["entries"]:
            restaurant = restaurants.get((entry_data["zone"].strip(), _name_key(entry_data["restaurant"])))
            if restaurant is None or restaurant.id in seen:
                continue
            seen.add(restaurant.id)
            branches = {branch.name_key: branch for branch in restaurant.branches.all()}
            menus = {menu.name_key: menu for menu in restaurant.menus.all()}
            entry = GuideEntry(guide=guide, restaurant=restaurant, position=len(seen) - 1,
                               branch=branches.get(normalize_menu(entry_data["branch"])),
                               comment=entry_data["comment"].strip())
            entries.append(entry)
            entry_menus.extend((entry, menus[key]) for key in dict.fromkeys(map(normalize_menu, entry_data["menus"]))
                               if key in menus)

    GuideEntry.objects.bulk_create(entries)
    EntryMenu = GuideEntry.menus.through
    EntryMenu.objects.bulk_create([EntryMenu(guideentry_id=entry.id, menu_id=menu.id) for entry, menu in entry_menus])
