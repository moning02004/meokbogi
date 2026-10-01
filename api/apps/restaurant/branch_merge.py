"""지점 기능이 생기기 전에 "교촌치킨 역삼점"처럼 지점을 이름에 넣어 따로 등록한 음식점을
브랜드("교촌치킨")의 지점으로 옮긴다.

자동으로 바꾸지 않는다. "홍콩반점"처럼 이름이 "점"으로 끝나는 가게가 있어서, 같은 장소에
앞부분 이름("교촌치킨")의 음식점이 따로 있을 때만 후보로 잡고 사람이 확인한 뒤 옮긴다.
"""
from dataclasses import dataclass

from django.db import transaction

from apps.restaurant.menus import get_or_create_menu, normalize_menu, tidy_menu
from apps.restaurant.models import Branch, Restaurant


@dataclass
class MergeCandidate:
    source: Restaurant      # "교촌치킨 역삼점"
    brand: Restaurant       # "교촌치킨"
    branch_name: str        # "역삼점"

    def describe(self):
        reviews = self.source.review_set.count()
        return (f"[{self.source.zone.name}] {self.source.name} → {self.brand.name} / {self.branch_name} 지점 "
                f"(리뷰 {reviews}개)")


def find_candidates(queryset=None):
    """같은 장소에서 "브랜드 이름 + 공백 + …점" 꼴인 음식점. 가장 긴 브랜드 이름에 붙인다."""
    queryset = queryset if queryset is not None else Restaurant.objects.all()
    candidates = []
    by_zone = {}
    for restaurant in queryset.select_related("zone").order_by("zone_id", "id"):
        by_zone.setdefault(restaurant.zone_id, []).append(restaurant)

    for restaurants in by_zone.values():
        for source in restaurants:
            name = tidy_menu(source.name)
            matches = [brand for brand in restaurants
                       if brand.id != source.id and name.startswith(tidy_menu(brand.name) + " ")]
            if not matches:
                continue
            brand = max(matches, key=lambda b: len(b.name))
            branch_name = name[len(tidy_menu(brand.name)):].strip()
            if branch_name.endswith("점"):
                candidates.append(MergeCandidate(source=source, brand=brand, branch_name=branch_name))
    return candidates


@transaction.atomic
def merge(candidate):
    """리뷰를 브랜드로 옮기고 지점을 붙인다. 메뉴는 브랜드 메뉴로 합치고, 카테고리는 합집합, 설명은 비어 있을 때만 가져온다."""
    source, brand = candidate.source, candidate.brand
    branch, _ = Branch.objects.get_or_create(restaurant=brand, name_key=normalize_menu(candidate.branch_name),
                                             defaults={"name": candidate.branch_name})

    moved = 0
    for review in source.review_set.select_related("menu", "branch"):
        review.restaurant = brand
        review.menu = get_or_create_menu(brand, review.menu_name)
        # 원래 음식점에 따로 지점이 붙어 있지 않았다면 이름에서 떼어 낸 지점
        review.branch = branch if review.branch_id is None else _branch_on(brand, review.branch.name)
        review.save(update_fields=["restaurant", "menu", "branch"])
        moved += 1

    brand.categories.add(*source.categories.all())
    if not brand.description and source.description:
        brand.description = source.description
        brand.save(update_fields=["description"])
    source.delete()
    return moved


def _branch_on(brand, name):
    branch, _ = Branch.objects.get_or_create(restaurant=brand, name_key=normalize_menu(name), defaults={"name": name})
    return branch
