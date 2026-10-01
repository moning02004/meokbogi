import re

from apps.restaurant.models import Menu


def normalize_menu(menu):
    """같은 메뉴인지 비교할 때 쓰는 키. "간장 치킨"과 "간장치킨", "Pizza"와 "pizza"를 같게 본다."""
    return re.sub(r"\s+", "", menu or "").lower()


def tidy_menu(menu):
    """저장할 때 앞뒤 공백을 지우고 연속 공백을 하나로 줄인다. 표기 자체는 사용자가 쓴 대로 둔다."""
    return re.sub(r"\s+", " ", menu or "").strip()


def get_or_create_menu(restaurant, name):
    """리뷰에 적힌 메뉴 이름을 그 음식점의 Menu로 바꾼다. 비어 있으면 None(메뉴 미기재).

    이미 공백·대소문자만 다른 메뉴가 있으면 그 메뉴를 쓴다 (처음 쓴 표기가 남는다).
    """
    name = tidy_menu(name)
    if not name:
        return None
    menu, _ = Menu.objects.get_or_create(restaurant=restaurant, name_key=normalize_menu(name),
                                         defaults={"name": name})
    return menu
