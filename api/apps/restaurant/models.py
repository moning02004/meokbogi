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


class Branch(models.Model):
    """음식점(브랜드)의 지점. 메뉴는 브랜드에 하나지만 맛은 지점마다 달라서 리뷰는 지점별로 남긴다.

    지점이 없는 동네 가게는 지점 없이 기록한다 (리뷰의 branch가 비어 있음).
    """
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="branches")
    name = models.CharField(max_length=100)
    name_key = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["restaurant", "name_key"], name="unique_branch_per_restaurant"),
        ]


class RestaurantReview(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name='review_set')
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    ordered_at = models.DateField()
    # 비어 있으면 "메뉴 미기재"
    menu = models.ForeignKey(Menu, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviews")
    # 비어 있으면 지점 구분 없음. 지점을 지우면 리뷰는 남고 지점만 비워진다.
    branch = models.ForeignKey(Branch, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviews")
    content = models.CharField(max_length=255, blank=True)
    point = models.IntegerField(default=0, choices=[(1, 1), (0, 0), (-1, -1)])

    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def menu_name(self):
        return self.menu.name if self.menu_id else ""

    @property
    def branch_name(self):
        return self.branch.name if self.branch_id else ""
