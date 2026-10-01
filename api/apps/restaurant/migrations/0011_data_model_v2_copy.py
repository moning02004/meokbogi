# 2.0 데이터 모델 2/3: 옛 구조의 데이터를 새 구조로 옮긴다.
#   음식점: category FK → zone + categories(태그 1개)
#   리뷰: menu 글자 → Menu 행 (같은 음식점 안에서 공백·대소문자 무시하고 처음 쓴 표기로 묶음)
# 마이그레이션은 그 시점의 코드에 기대면 안 되므로 정규화 함수를 여기에 둔다.
import re

from django.db import migrations


def _key(menu):
    return re.sub(r"\s+", "", menu or "").lower()


def _tidy(menu):
    return re.sub(r"\s+", " ", menu or "").strip()


def forward(apps, schema_editor):
    Restaurant = apps.get_model("restaurant", "Restaurant")
    Menu = apps.get_model("restaurant", "Menu")
    RestaurantReview = apps.get_model("restaurant", "RestaurantReview")
    Through = Restaurant.categories.through

    restaurants = list(Restaurant.objects.select_related("category").only("id", "category"))
    for restaurant in restaurants:
        restaurant.zone_id = restaurant.category.zone_id
    Restaurant.objects.bulk_update(restaurants, ["zone"], batch_size=500)
    Through.objects.bulk_create([Through(restaurant_id=r.id, category_id=r.category_id) for r in restaurants],
                                batch_size=500, ignore_conflicts=True)

    menus = {}
    changed = []
    for review in RestaurantReview.objects.order_by("restaurant_id", "id").only("id", "restaurant_id", "menu"):
        name = _tidy(review.menu)
        if not name:
            continue
        key = (review.restaurant_id, _key(name))
        if key not in menus:
            menus[key] = Menu.objects.create(restaurant_id=review.restaurant_id, name=name, name_key=key[1])
        review.menu_ref_id = menus[key].id
        changed.append(review)
    RestaurantReview.objects.bulk_update(changed, ["menu_ref"], batch_size=500)


def backward(apps, schema_editor):
    Restaurant = apps.get_model("restaurant", "Restaurant")
    RestaurantReview = apps.get_model("restaurant", "RestaurantReview")

    # 태그가 여러 개면 가장 먼저 붙인 하나만 옛 카테고리로 남는다
    for restaurant in Restaurant.objects.prefetch_related("categories"):
        first = min(restaurant.categories.all(), key=lambda c: c.id, default=None)
        restaurant.category_id = first.id if first else None
        restaurant.save(update_fields=["category"])
    for review in RestaurantReview.objects.select_related("menu_ref"):
        review.menu = review.menu_ref.name if review.menu_ref_id else ""
        review.save(update_fields=["menu"])


class Migration(migrations.Migration):
    dependencies = [
        ("restaurant", "0010_data_model_v2_add"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
