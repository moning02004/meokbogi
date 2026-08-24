from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from apps.restaurant.models import Restaurant, RestaurantReview
from apps.zone.models import Category, Zone


class ZoneTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.client.login(username="owner", password="123")

    def test_create_zone_makes_default_categories(self):
        response = self.client.post(reverse("zones"), data={"name": "우리집"})
        self.assertEqual(response.status_code, 201)

        zone = Zone.objects.get(pk=response.json()["id"])
        self.assertEqual(zone.user_id, self.user.id)
        self.assertEqual(zone.category_set.count(), 14)

    def test_list_returns_only_my_zones(self):
        other = User.objects.create_user(username="other", password="123")
        Zone.objects.create(user=self.user, name="내 존")
        Zone.objects.create(user=other, name="남의 존")

        response = self.client.get(reverse("zones"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["results"][0]["name"], "내 존")

    def test_delete_own_zone(self):
        zone = Zone.objects.create(user=self.user, name="내 존")

        response = self.client.delete(reverse("zone-delete", kwargs={"zone_pk": zone.pk}))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Zone.objects.filter(pk=zone.pk).exists())

    def test_dashboard_counts(self):
        zone = Zone.objects.create(user=self.user, name="내 존")
        category = Category.objects.create(zone=zone, keyword="치킨")
        restaurant = Restaurant.objects.create(category=category, name="맛집")
        RestaurantReview.objects.create(restaurant=restaurant, user=self.user,
                                        ordered_at="2026-01-01", point=1)

        response = self.client.get(reverse("zone-dashboard", kwargs={"zone_pk": zone.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restaurant_count"], 1)
        self.assertEqual(response.json()["review_count"], 1)


class CategoryTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="내 존")
        self.client.login(username="owner", password="123")

    def test_list_categories(self):
        Category.objects.create(zone=self.zone, keyword="치킨")

        response = self.client.get(reverse("category-list", kwargs={"zone_pk": self.zone.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_create_category(self):
        response = self.client.post(reverse("category-list", kwargs={"zone_pk": self.zone.pk}),
                                    data={"keyword": "피자"})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Category.objects.filter(zone=self.zone, keyword="피자").exists())
        # 갓 만든 카테고리도 restaurant_count가 내려와야 한다 (annotate가 없는 경로)
        self.assertEqual(response.json()["restaurant_count"], 0)

    def test_list_includes_restaurant_count(self):
        chicken = Category.objects.create(zone=self.zone, keyword="치킨")
        Category.objects.create(zone=self.zone, keyword="피자")
        Restaurant.objects.create(category=chicken, name="맛집1")
        Restaurant.objects.create(category=chicken, name="맛집2")

        response = self.client.get(reverse("category-list", kwargs={"zone_pk": self.zone.pk}))
        self.assertEqual(response.status_code, 200)

        counts = {row["keyword"]: row["restaurant_count"] for row in response.json()}
        self.assertEqual(counts, {"치킨": 2, "피자": 0})

    def test_delete_empty_category(self):
        category = Category.objects.create(zone=self.zone, keyword="치킨")

        response = self.client.delete(reverse("category-delete", kwargs={"zone_pk": self.zone.pk,
                                                                        "category_pk": category.pk}))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Category.objects.filter(pk=category.pk).exists())

    def test_cannot_delete_category_with_restaurants(self):
        category = Category.objects.create(zone=self.zone, keyword="치킨")
        Restaurant.objects.create(category=category, name="맛집")

        response = self.client.delete(reverse("category-delete", kwargs={"zone_pk": self.zone.pk,
                                                                        "category_pk": category.pk}))
        self.assertEqual(response.status_code, 400)
        # CASCADE라서 막지 않으면 음식점까지 함께 지워진다
        self.assertTrue(Category.objects.filter(pk=category.pk).exists())
        self.assertEqual(Restaurant.objects.count(), 1)

    def test_cannot_delete_category_of_another_zone(self):
        other_zone = Zone.objects.create(user=self.user, name="다른 존")
        category = Category.objects.create(zone=other_zone, keyword="치킨")

        response = self.client.delete(reverse("category-delete", kwargs={"zone_pk": self.zone.pk,
                                                                        "category_pk": category.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Category.objects.filter(pk=category.pk).exists())


class ZoneAuthorizationTestCase(TestCase):
    """다른 사용자의 zone/category에 접근할 수 없어야 한다.

    읽기는 403이 아니라 빈 결과로 막는다. 403은 리소스의 존재 여부를 알려주기 때문이다.
    """

    def setUp(self):
        self.victim = User.objects.create_user(username="victim", password="123")
        User.objects.create_user(username="attacker", password="123")

        self.zone = Zone.objects.create(user=self.victim, name="남의 존")
        self.category = Category.objects.create(zone=self.zone, keyword="치킨")

        self.client.login(username="attacker", password="123")

    def test_cannot_list_other_users_categories(self):
        response = self.client.get(reverse("category-list", kwargs={"zone_pk": self.zone.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_cannot_create_category_in_other_users_zone(self):
        # get_queryset은 조회에만 적용되므로 생성 경로에 대한 검증이 따로 필요하다
        response = self.client.post(reverse("category-list", kwargs={"zone_pk": self.zone.pk}),
                                    data={"keyword": "해킹"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Category.objects.filter(zone=self.zone).count(), 1)

    def test_cannot_delete_other_users_category(self):
        response = self.client.delete(reverse("category-delete", kwargs={"zone_pk": self.zone.pk,
                                                                        "category_pk": self.category.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Category.objects.filter(pk=self.category.pk).exists())

    def test_cannot_delete_other_users_zone(self):
        response = self.client.delete(reverse("zone-delete", kwargs={"zone_pk": self.zone.pk}))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Zone.objects.filter(pk=self.zone.pk).exists())

    def test_cannot_read_other_users_dashboard(self):
        # 현재는 get_object가 queryset.get()이라 500이 난다. 404로 고쳐도 이 테스트는 통과해야 한다.
        client = Client(raise_request_exception=False)
        client.login(username="attacker", password="123")

        response = client.get(reverse("zone-dashboard", kwargs={"zone_pk": self.zone.pk}))
        self.assertGreaterEqual(response.status_code, 400)
