from django.contrib.auth.models import User
from django.db import models


class Zone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)


class Category(models.Model):
    # 2.0: 카테고리는 장소가 아니라 사용자에게 속한다. 우리집·회사 어디서든 같은 "치킨"을 쓴다.
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories")
    keyword = models.CharField(max_length=100)
