# 카테고리를 장소에서 사용자로 2/3: 사용자마다 장소별로 따로 있던 같은 이름의 카테고리를 하나로 합친다.
#   이름 비교는 공백·대소문자를 무시한다 ("돈 까스" = "돈까스"). 가장 먼저 만든 것이 남는다.
#   음식점에 붙어 있던 태그는 남는 카테고리로 옮긴다.
# 되돌릴 때는 카테고리를 그 카테고리가 붙은 음식점들의 장소마다 하나씩 다시 만든다.
import re

from django.db import migrations


def _key(keyword):
    return re.sub(r"\s+", "", keyword or "").lower()


def forward(apps, schema_editor):
    Category = apps.get_model("zone", "Category")
    Restaurant = apps.get_model("restaurant", "Restaurant")
    Tag = Restaurant.categories.through

    keep = {}  # (user_id, key) → 남길 카테고리 id
    for category in Category.objects.select_related("zone").order_by("id"):
        user_id = category.zone.user_id
        survivor = keep.setdefault((user_id, _key(category.keyword)), category.id)
        if survivor == category.id:
            category.user_id = user_id
            category.save(update_fields=["user"])
            continue
        # 같은 음식점에 두 카테고리가 다 붙어 있으면 하나만 남긴다
        tagged = set(Tag.objects.filter(category_id=survivor).values_list("restaurant_id", flat=True))
        for tag in Tag.objects.filter(category_id=category.id):
            if tag.restaurant_id in tagged:
                tag.delete()
            else:
                tag.category_id = survivor
                tag.save(update_fields=["category"])
                tagged.add(tag.restaurant_id)
        category.delete()


def backward(apps, schema_editor):
    Category = apps.get_model("zone", "Category")
    Zone = apps.get_model("zone", "Zone")
    Restaurant = apps.get_model("restaurant", "Restaurant")
    Tag = Restaurant.categories.through

    for category in list(Category.objects.order_by("id")):
        zone_ids = sorted(set(Restaurant.objects.filter(categories=category).values_list("zone_id", flat=True)))
        if not zone_ids:
            first_zone = Zone.objects.filter(user_id=category.user_id).order_by("id").first()
            if first_zone is None:
                category.delete()
                continue
            zone_ids = [first_zone.id]
        category.zone_id = zone_ids[0]
        category.save(update_fields=["zone"])
        for zone_id in zone_ids[1:]:
            copy = Category.objects.create(zone_id=zone_id, user_id=category.user_id, keyword=category.keyword)
            Tag.objects.filter(category_id=category.id, restaurant__zone_id=zone_id).update(category_id=copy.id)


class Migration(migrations.Migration):
    dependencies = [
        ("zone", "0004_category_user_add"),
        ("restaurant", "0013_branch"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
