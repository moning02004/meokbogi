import re

from apps.restaurant.models import RestaurantReview


def normalize_menu(menu):
    """같은 메뉴인지 비교할 때 쓰는 키. "간장 치킨"과 "간장치킨", "Pizza"와 "pizza"를 같게 본다."""
    return re.sub(r"\s+", "", menu or "").lower()


def tidy_menu(menu):
    """저장할 때 앞뒤 공백을 지우고 연속 공백을 하나로 줄인다. 표기 자체는 사용자가 쓴 대로 둔다."""
    return re.sub(r"\s+", " ", menu or "").strip()


def canonical_menu(restaurant, menu, exclude_review_id=None):
    """같은 음식점에 이미 같은 메뉴가 있으면 그 표기를 돌려준다.

    "간장치킨"으로 3번 기록한 뒤 "간장 치킨"으로 쓰면 메뉴별 요약이 둘로 갈라졌다.
    처음 쓴 표기를 기준으로 묶는다.
    """
    menu = tidy_menu(menu)
    key = normalize_menu(menu)
    if not key:
        return menu

    reviews = RestaurantReview.objects.filter(restaurant=restaurant).exclude(menu="")
    if exclude_review_id is not None:
        reviews = reviews.exclude(pk=exclude_review_id)
    for existing in reviews.order_by("id").values_list("menu", flat=True).distinct():
        if normalize_menu(existing) == key:
            return existing
    return menu
