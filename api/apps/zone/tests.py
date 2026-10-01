from datetime import date
from unittest import mock

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

    def test_monthly_count_uses_local_date(self):
        # 10/1 00:00~09:00 KST는 UTC로 아직 9월이다. "이번 달"은 KST 날짜로 잡아야 한다.
        zone = Zone.objects.create(user=self.user, name="내 존")
        category = Category.objects.create(zone=zone, keyword="치킨")
        restaurant = Restaurant.objects.create(category=category, name="맛집")
        RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at="2026-09-30", point=1)
        RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at="2026-10-01", point=1)

        with mock.patch("apps.zone.views.timezone.localdate", return_value=date(2026, 10, 1)):
            response = self.client.get(reverse("zone-dashboard", kwargs={"zone_pk": zone.pk}))
        self.assertEqual(response.json()["monthly_visited_count"], 1)

    def test_categories_keep_creation_order(self):
        response = self.client.post(reverse("zones"), data={"name": "우리집"})
        created = [row["keyword"] for row in response.json()["category"]]

        response = self.client.get(reverse("zones"))
        listed = [row["keyword"] for row in response.json()["results"][0]["category"]]
        self.assertEqual(listed, created)


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
        client = Client(raise_request_exception=False)
        client.login(username="attacker", password="123")

        response = client.get(reverse("zone-dashboard", kwargs={"zone_pk": self.zone.pk}))
        self.assertEqual(response.status_code, 404)


class DashboardTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.category = Category.objects.create(zone=self.zone, keyword="치킨")
        self.client.login(username="owner", password="123")

    def _restaurant(self, name, visits):
        # visits: [(주문일, 만족도), ...]
        restaurant = Restaurant.objects.create(category=self.category, name=name)
        for day, point in visits:
            RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at=day, point=point)
        return restaurant

    def _dashboard(self):
        return self.client.get(reverse("zone-dashboard", kwargs={"zone_pk": self.zone.pk})).json()

    def test_delicious_requires_two_visits_and_good_average(self):
        self._restaurant("두번 만족", [("2026-01-01", 1), ("2026-01-02", 1)])
        self._restaurant("한번 만족", [("2026-01-01", 1)])
        self._restaurant("두번 애매", [("2026-01-01", 1), ("2026-01-02", 0)])
        self._restaurant("같은날 두번", [("2026-01-01", 1), ("2026-01-01", 1)])

        names = [row["name"] for row in self._dashboard()["delicious_restaurants"]]
        self.assertEqual(names, ["두번 만족"])

    def test_delicious_is_top_five_by_average(self):
        for i in range(6):
            # 앞의 다섯 곳은 평균 1.0, 마지막 한 곳은 평균 2/3
            points = [1, 1, 1] if i < 5 else [1, 1, 0]
            self._restaurant(f"가게{i}", [(f"2026-01-0{d + 1}", p) for d, p in enumerate(points)])

        rows = self._dashboard()["delicious_restaurants"]
        self.assertEqual(len(rows), 5)
        self.assertNotIn("가게5", [row["name"] for row in rows])

    def test_recent_is_latest_three(self):
        for i, day in enumerate(["2026-01-01", "2026-03-01", "2026-02-01", "2026-04-01"]):
            self._restaurant(f"가게{i}", [(day, 0)])
        self._restaurant("미방문", [])

        names = [row["name"] for row in self._dashboard()["recent_restaurants"]]
        self.assertEqual(names, ["가게3", "가게1", "가게2"])

    def test_monthly_count_is_distinct_restaurant_days(self):
        # 같은 가게 같은 날 메뉴 두 개 = 1번, 다른 가게 같은 날 = 따로 1번
        self._restaurant("교촌", [("2026-10-02", 1), ("2026-10-02", 0)])
        self._restaurant("BBQ", [("2026-10-02", 1), ("2026-09-30", 1)])

        with mock.patch("apps.zone.views.timezone.localdate", return_value=date(2026, 10, 15)):
            self.assertEqual(self._dashboard()["monthly_visited_count"], 2)

    def test_counts_ignore_other_zones(self):
        self._restaurant("교촌", [("2026-01-01", 1)])
        other_zone = Zone.objects.create(user=self.user, name="회사")
        other = Restaurant.objects.create(category=Category.objects.create(zone=other_zone, keyword="한식"),
                                          name="회사 앞 백반")
        RestaurantReview.objects.create(restaurant=other, user=self.user, ordered_at="2026-01-01", point=1)

        data = self._dashboard()
        self.assertEqual((data["restaurant_count"], data["review_count"]), (1, 1))


class ZoneListTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.client.login(username="owner", password="123")

    def test_requires_authentication(self):
        self.client.logout()
        self.assertEqual(self.client.get(reverse("zones")).status_code, 401)

    def test_create_requires_name(self):
        self.assertEqual(self.client.post(reverse("zones"), data={"name": ""}).status_code, 400)

    def test_ordered_by_latest_visit(self):
        # 최근에 기록한 장소가 첫 번째 = 로그인 직후 기본 선택 장소다
        quiet = Zone.objects.create(user=self.user, name="본가")
        busy = Zone.objects.create(user=self.user, name="회사")
        empty = Zone.objects.create(user=self.user, name="새 장소")
        for zone, day in ((quiet, "2026-01-01"), (busy, "2026-09-01")):
            restaurant = Restaurant.objects.create(category=Category.objects.create(zone=zone, keyword="치킨"),
                                                   name="가게")
            RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at=day)

        names = [row["name"] for row in self.client.get(reverse("zones")).json()["results"]]
        self.assertEqual(names, [busy.name, quiet.name, empty.name])

    def test_delete_removes_everything_inside(self):
        zone = Zone.objects.create(user=self.user, name="본가")
        restaurant = Restaurant.objects.create(category=Category.objects.create(zone=zone, keyword="치킨"),
                                               name="가게")
        RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at="2026-01-01")

        self.client.delete(reverse("zone-delete", kwargs={"zone_pk": zone.pk}))
        self.assertEqual((Category.objects.count(), Restaurant.objects.count(), RestaurantReview.objects.count()),
                         (0, 0, 0))


class ForgottenRestaurantsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.category = Category.objects.create(zone=self.zone, keyword="치킨")
        self.client.login(username="owner", password="123")

    def _restaurant(self, name, day, point):
        restaurant = Restaurant.objects.create(category=self.category, name=name)
        RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at=day, point=point)

    def test_good_but_not_visited_for_60_days(self):
        self._restaurant("잊은 맛집", "2026-07-01", 1)
        self._restaurant("더 오래 잊은 맛집", "2026-03-01", 1)
        self._restaurant("최근 맛집", "2026-09-20", 1)
        self._restaurant("오래된 실망", "2026-03-01", -1)

        with mock.patch("apps.zone.views.timezone.localdate", return_value=date(2026, 10, 1)):
            response = self.client.get(reverse("zone-dashboard", kwargs={"zone_pk": self.zone.pk}))
        names = [row["name"] for row in response.json()["forgotten_restaurants"]]
        self.assertEqual(names, ["더 오래 잊은 맛집", "잊은 맛집"])


class RenameTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.category = Category.objects.create(zone=self.zone, keyword="치킨")
        Category.objects.create(zone=self.zone, keyword="돈까스")
        self.client.login(username="owner", password="123")
        self.zone_url = reverse("zone-delete", kwargs={"zone_pk": self.zone.pk})
        self.category_url = reverse("category-delete", kwargs={"zone_pk": self.zone.pk,
                                                               "category_pk": self.category.pk})

    def _patch(self, url, body):
        return self.client.patch(url, data=body, content_type="application/json")

    def test_rename_zone(self):
        response = self._patch(self.zone_url, {"name": "  새 집 "})
        self.assertEqual(response.status_code, 200)
        self.zone.refresh_from_db()
        self.assertEqual(self.zone.name, "새 집")

    def test_rename_zone_rejects_blank(self):
        self.assertEqual(self._patch(self.zone_url, {"name": " "}).status_code, 400)

    def test_cannot_rename_other_users_zone(self):
        User.objects.create_user(username="attacker", password="123")
        self.client.login(username="attacker", password="123")
        self.assertEqual(self._patch(self.zone_url, {"name": "뺏음"}).status_code, 404)

    def test_rename_category(self):
        response = self._patch(self.category_url, {"keyword": "치킨/닭강정"})
        self.assertEqual(response.status_code, 200)
        self.category.refresh_from_db()
        self.assertEqual(self.category.keyword, "치킨/닭강정")

    def test_rename_category_to_same_name_with_spacing_change(self):
        # 자기 자신과는 중복으로 보지 않는다
        self.assertEqual(self._patch(self.category_url, {"keyword": "치 킨"}).status_code, 200)

    def test_rename_category_rejects_duplicate(self):
        response = self._patch(self.category_url, {"keyword": "돈 까스"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("이미 있는", response.json()["keyword"])

    def test_create_category_rejects_duplicate(self):
        response = self.client.post(reverse("category-list", kwargs={"zone_pk": self.zone.pk}),
                                    data={"keyword": "돈까스"})
        self.assertEqual(response.status_code, 400)

    def test_same_keyword_allowed_in_another_zone(self):
        other_zone = Zone.objects.create(user=self.user, name="회사")
        response = self.client.post(reverse("category-list", kwargs={"zone_pk": other_zone.pk}),
                                    data={"keyword": "돈까스"})
        self.assertEqual(response.status_code, 201)
