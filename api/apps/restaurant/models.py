import uuid

from django.contrib.auth.models import User
from django.db import models

from apps.zone.models import Category


class Restaurant(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE)

    name = models.CharField(max_length=100)
    description = models.CharField(max_length=100, default="", blank=True)
    address = models.CharField(max_length=255, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class RestaurantReview(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='review_set')
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    ordered_at = models.DateField()
    menu = models.CharField(max_length=255, default="", blank=True)
    content = models.CharField(max_length=255, blank=True)
    point = models.IntegerField(default=0, choices=[(1, 1), (0, 0), (-1, -1)])

    created_at = models.DateTimeField(auto_now_add=True)
