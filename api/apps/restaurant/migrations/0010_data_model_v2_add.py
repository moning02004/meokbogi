# 2.0 데이터 모델 1/3: 새 필드·모델을 더한다. 옛 필드(category, menu 글자)는 아직 둔다.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("restaurant", "0009_merge_menu_spellings"),
        ("zone", "0003_remove_zone_hash_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="restaurant",
            name="zone",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to="zone.zone"),
        ),
        migrations.AddField(
            model_name="restaurant",
            name="categories",
            field=models.ManyToManyField(blank=True, related_name="restaurants", to="zone.category"),
        ),
        # 되돌릴 때 데이터를 다시 채울 수 있도록 옛 카테고리 FK를 비울 수 있게 한다
        migrations.AlterField(
            model_name="restaurant",
            name="category",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to="zone.category"),
        ),
        migrations.CreateModel(
            name="Menu",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("name_key", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("restaurant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="menus",
                                                 to="restaurant.restaurant")),
            ],
            options={
                "constraints": [models.UniqueConstraint(fields=("restaurant", "name_key"),
                                                        name="unique_menu_per_restaurant")],
            },
        ),
        migrations.AddField(
            model_name="restaurantreview",
            name="menu_ref",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name="reviews", to="restaurant.menu"),
        ),
    ]
