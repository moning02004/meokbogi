# 2.0 데이터 모델 3/3: 옛 필드를 지우고 새 필드를 본 이름으로 바꾼다.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("restaurant", "0011_data_model_v2_copy"),
    ]

    operations = [
        migrations.RemoveField(model_name="restaurant", name="category"),
        migrations.RemoveField(model_name="restaurantreview", name="menu"),
        migrations.RenameField(model_name="restaurantreview", old_name="menu_ref", new_name="menu"),
        migrations.AlterField(
            model_name="restaurant",
            name="zone",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="zone.zone"),
        ),
    ]
