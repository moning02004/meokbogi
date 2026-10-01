from django.contrib.auth.models import User
from django.db import models

from apps.zone.models import Category, Zone


class Restaurant(models.Model):
    # 2.0: 음식점은 장소에 직접 속하고, 카테고리는 여러 개 붙일 수 있는 태그다 (분식 + 돈까스 파는 김밥집)
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE)
    categories = models.ManyToManyField(Category, related_name="restaurants", blank=True)

    name = models.CharField(max_length=100)
    description = models.CharField(max_length=100, default="", blank=True)
    address = models.CharField(max_length=255, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Menu(models.Model):
    """음식점의 메뉴 하나. 리뷰는 메뉴를 가리킨다.

    name_key는 공백·대소문자를 없앤 비교용 이름이라 "간장치킨"과 "간장 치킨"은 같은 메뉴다.
    name은 처음 쓴 표기를 그대로 둔다.
    """
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="menus")
    name = models.CharField(max_length=255)
    name_key = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["restaurant", "name_key"], name="unique_menu_per_restaurant"),
        ]


class RestaurantReview(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='review_set')
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    ordered_at = models.DateField()
    # 비어 있으면 "메뉴 미기재"
    menu = models.ForeignKey(Menu, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviews")
    content = models.CharField(max_length=255, blank=True)
    point = models.IntegerField(default=0, choices=[(1, 1), (0, 0), (-1, -1)])

    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def menu_name(self):
        return self.menu.name if self.menu_id else ""
