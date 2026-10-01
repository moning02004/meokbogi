import re

from django.db import migrations


def _key(menu):
    return re.sub(r"\s+", "", menu or "").lower()


def _tidy(menu):
    return re.sub(r"\s+", " ", menu or "").strip()


def merge_menu_spellings(apps, schema_editor):
    # 같은 음식점 안에서 공백·대소문자만 다른 메뉴("간장치킨" / "간장 치킨")를 처음 쓴 표기로 합친다.
    # apps.restaurant.menus를 import하지 않는 이유: 마이그레이션은 그 시점의 코드에 기대면 안 된다.
    RestaurantReview = apps.get_model("restaurant", "RestaurantReview")

    first_spelling = {}
    changed = []
    for review in RestaurantReview.objects.order_by("restaurant_id", "id").only("id", "restaurant_id", "menu"):
        tidy = _tidy(review.menu)
        if not tidy:
            if review.menu != "":
                review.menu = ""
                changed.append(review)
            continue
        canonical = first_spelling.setdefault((review.restaurant_id, _key(tidy)), tidy)
        if review.menu != canonical:
            review.menu = canonical
            changed.append(review)

    RestaurantReview.objects.bulk_update(changed, ["menu"], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ("restaurant", "0008_alter_restaurantreview_content"),
    ]

    # 되돌릴 때는 원래 표기를 알 수 없으므로 그대로 둔다
    operations = [
        migrations.RunPython(merge_menu_spellings, migrations.RunPython.noop),
    ]
