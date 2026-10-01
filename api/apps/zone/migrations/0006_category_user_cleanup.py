# 카테고리를 장소에서 사용자로 3/3: zone을 지우고 user를 필수로.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("zone", "0005_category_user_merge"),
    ]

    operations = [
        migrations.RemoveField(model_name="category", name="zone"),
        migrations.AlterField(
            model_name="category",
            name="user",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="categories",
                                    to=settings.AUTH_USER_MODEL),
        ),
    ]
