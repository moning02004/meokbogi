"""테스트용 데이터 만들기. 2.0 구조(장소 + 카테고리 태그, Menu)를 한 줄로 만든다."""
from apps.restaurant.menus import get_or_create_menu
from apps.restaurant.models import Restaurant, RestaurantReview
from apps.zone.models import Category


def make_category(zone, keyword):
    """장소 주인의 카테고리. 카테고리는 사용자에게 속하지만, 테스트에서 make_restaurant(category=...)만으로
    어느 장소의 음식점인지 알 수 있도록 장소를 기억해 둔다 (DB에는 저장되지 않는 속성)."""
    category, _ = Category.objects.get_or_create(user=zone.user, keyword=keyword)
    category.test_zone = zone
    return category


def make_restaurant(category=None, *, zone=None, categories=(), **fields):
    """category 하나(또는 categories 여러 개)를 붙인 음식점. zone을 안 주면 make_category가 기억한 장소."""
    tags = ([category] if category is not None else []) + list(categories)
    restaurant = Restaurant.objects.create(zone=zone or tags[0].test_zone, **fields)
    if tags:
        restaurant.categories.add(*tags)
    return restaurant


def make_review(*, restaurant, menu="", **fields):
    """메뉴를 글자로 받아 그 음식점의 Menu로 연결한 리뷰."""
    return RestaurantReview.objects.create(restaurant=restaurant, menu=get_or_create_menu(restaurant, menu), **fields)
