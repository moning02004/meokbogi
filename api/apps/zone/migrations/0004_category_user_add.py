# 카테고리를 장소에서 사용자로 1/3: user를 더하고, 되돌릴 때를 위해 zone을 비울 수 있게 한다.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("zone", "0003_remove_zone_hash_id"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="user",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE,
                                    related_name="categories", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="category",
            name="zone",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, to="zone.zone"),
        ),
    ]
