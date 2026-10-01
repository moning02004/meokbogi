"""테스트용 데이터 만들기. 2.0 구조(장소 + 카테고리 태그, Menu)를 한 줄로 만든다."""
from apps.restaurant.menus import get_or_create_menu
from apps.restaurant.models import Restaurant, RestaurantReview


def make_restaurant(category=None, *, zone=None, categories=(), **fields):
    """category 하나(또는 categories 여러 개)를 붙인 음식점. zone은 카테고리의 장소."""
    tags = ([category] if category is not None else []) + list(categories)
    restaurant = Restaurant.objects.create(zone=zone or tags[0].zone, **fields)
    if tags:
        restaurant.categories.add(*tags)
    return restaurant


def make_review(*, restaurant, menu="", **fields):
    """메뉴를 글자로 받아 그 음식점의 Menu로 연결한 리뷰."""
    return RestaurantReview.objects.create(restaurant=restaurant, menu=get_or_create_menu(restaurant, menu), **fields)
