import uuid

from django.contrib.auth.models import User
from django.db import models


class Zone(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)


class Category(models.Model):
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE)
    keyword = models.CharField(max_length=100)
