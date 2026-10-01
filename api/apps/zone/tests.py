from datetime import date
from unittest import mock

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from apps.restaurant.models import Restaurant, RestaurantReview
from apps.restaurant.testing import make_category, make_restaurant, make_review
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
        self.assertEqual(Category.objects.filter(user=self.user).count(), 14)

        # 장소를 더 만들어도 기본 카테고리를 복제하지 않는다. 어느 장소든 같은 목록.
        second = self.client.post(reverse("zones"), data={"name": "회사"}).json()
        self.assertEqual(Category.objects.filter(user=self.user).count(), 14)
        self.assertEqual(second["category"], response.json()["category"])

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
        category = make_category(zone, "치킨")
        restaurant = make_restaurant(category=category, name="맛집")
        make_review(restaurant=restaurant, user=self.user,
                                        ordered_at="2026-01-01", point=1)

        response = self.client.get(reverse("zone-dashboard", kwargs={"zone_pk": zone.pk}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restaurant_count"], 1)
        self.assertEqual(response.json()["review_count"], 1)

    def test_monthly_count_uses_local_date(self):
        # 10/1 00:00~09:00 KST는 UTC로 아직 9월이다. "이번 달"은 KST 날짜로 잡아야 한다.
        zone = Zone.objects.create(user=self.user, name="내 존")
        category = make_category(zone, "치킨")
        restaurant = make_restaurant(category=category, name="맛집")
        make_review(restaurant=restaurant, user=self.user, ordered_at="2026-09-30", point=1)
        make_review(restaurant=restaurant, user=self.user, ordered_at="2026-10-01", point=1)

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
        make_category(self.zone, "치킨")

        response = self.client.get(reverse("category-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_create_category(self):
        response = self.client.post(reverse("category-list"),
                                    data={"keyword": "피자"})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Category.objects.filter(user=self.user, keyword="피자").exists())
        # 갓 만든 카테고리도 restaurant_count가 내려와야 한다 (annotate가 없는 경로)
        self.assertEqual(response.json()["restaurant_count"], 0)

    def test_list_includes_restaurant_count(self):
        chicken = make_category(self.zone, "치킨")
        make_category(self.zone, "피자")
        make_restaurant(category=chicken, name="맛집1")
        make_restaurant(category=chicken, name="맛집2")

        response = self.client.get(reverse("category-list"))
        self.assertEqual(response.status_code, 200)

        counts = {row["keyword"]: row["restaurant_count"] for row in response.json()}
        self.assertEqual(counts, {"치킨": 2, "피자": 0})

    def test_delete_empty_category(self):
        category = make_category(self.zone, "치킨")

        response = self.client.delete(reverse("category-delete", kwargs={"category_pk": category.pk}))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Category.objects.filter(pk=category.pk).exists())

    def test_cannot_delete_category_with_restaurants(self):
        category = make_category(self.zone, "치킨")
        make_restaurant(category=category, name="맛집")

        response = self.client.delete(reverse("category-delete", kwargs={"category_pk": category.pk}))
        self.assertEqual(response.status_code, 400)
        # 이 카테고리 하나만 붙은 음식점이 카테고리 없이 남지 않게 막는다
        self.assertIn("1곳", response.json()["detail"])
        self.assertTrue(Category.objects.filter(pk=category.pk).exists())
        self.assertEqual(Restaurant.objects.count(), 1)

    def test_delete_tag_shared_with_other_category(self):
        # 다른 카테고리도 붙은 음식점뿐이면 지울 수 있고, 음식점은 남는다
        chicken = make_category(self.zone, "치킨")
        snack = make_category(self.zone, "분식")
        restaurant = make_restaurant(categories=[chicken, snack], zone=self.zone, name="김밥천국")

        response = self.client.delete(reverse("category-delete", kwargs={"category_pk": chicken.pk}))
        self.assertEqual(response.status_code, 204)
        self.assertEqual(list(restaurant.categories.all()), [snack])

    def test_list_counts_exclusive_restaurants(self):
        chicken = make_category(self.zone, "치킨")
        snack = make_category(self.zone, "분식")
        make_restaurant(category=chicken, name="교촌")
        make_restaurant(categories=[chicken, snack], zone=self.zone, name="김밥천국")

        rows = {row["keyword"]: row for row in
                self.client.get(reverse("category-list")).json()}
        self.assertEqual((rows["치킨"]["restaurant_count"], rows["치킨"]["exclusive_restaurant_count"]), (2, 1))
        self.assertEqual((rows["분식"]["restaurant_count"], rows["분식"]["exclusive_restaurant_count"]), (1, 0))

    def test_categories_are_shared_across_zones(self):
        office = Zone.objects.create(user=self.user, name="회사")
        chicken = make_category(self.zone, "치킨")
        make_restaurant(category=chicken, zone=self.zone, name="교촌")
        make_restaurant(category=chicken, zone=office, name="회사 앞 BBQ")

        rows = self.client.get(reverse("category-list")).json()
        self.assertEqual([(r["keyword"], r["restaurant_count"]) for r in rows], [("치킨", 2)])
        # 장소를 지워도 카테고리는 남는다
        self.client.delete(reverse("zone-delete", kwargs={"zone_pk": office.pk}))
        self.assertTrue(Category.objects.filter(pk=chicken.pk).exists())


class ZoneAuthorizationTestCase(TestCase):
    """다른 사용자의 zone/category에 접근할 수 없어야 한다.

    읽기는 403이 아니라 빈 결과로 막는다. 403은 리소스의 존재 여부를 알려주기 때문이다.
    """

    def setUp(self):
        self.victim = User.objects.create_user(username="victim", password="123")
        User.objects.create_user(username="attacker", password="123")

        self.zone = Zone.objects.create(user=self.victim, name="남의 존")
        self.category = make_category(self.zone, "치킨")

        self.client.login(username="attacker", password="123")

    def test_cannot_list_other_users_categories(self):
        response = self.client.get(reverse("category-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_new_category_belongs_to_me(self):
        response = self.client.post(reverse("category-list"), data={"keyword": "해킹"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Category.objects.get(pk=response.json()["id"]).user.username, "attacker")
        self.assertEqual(Category.objects.filter(user=self.victim).count(), 1)

    def test_cannot_delete_other_users_category(self):
        response = self.client.delete(reverse("category-delete", kwargs={"category_pk": self.category.pk}))
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
        self.category = make_category(self.zone, "치킨")
        self.client.login(username="owner", password="123")

    def _restaurant(self, name, visits):
        # visits: [(주문일, 만족도), ...]
        restaurant = make_restaurant(category=self.category, name=name)
        for day, point in visits:
            make_review(restaurant=restaurant, user=self.user, ordered_at=day, point=point)
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
        other = make_restaurant(category=make_category(other_zone, "한식"),
                                          name="회사 앞 백반")
        make_review(restaurant=other, user=self.user, ordered_at="2026-01-01", point=1)

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
            restaurant = make_restaurant(category=make_category(zone, "치킨"),
                                                   name="가게")
            make_review(restaurant=restaurant, user=self.user, ordered_at=day)

        names = [row["name"] for row in self.client.get(reverse("zones")).json()["results"]]
        self.assertEqual(names, [busy.name, quiet.name, empty.name])

    def test_delete_removes_everything_inside(self):
        zone = Zone.objects.create(user=self.user, name="본가")
        restaurant = make_restaurant(category=make_category(zone, "치킨"),
                                               name="가게")
        make_review(restaurant=restaurant, user=self.user, ordered_at="2026-01-01")

        self.client.delete(reverse("zone-delete", kwargs={"zone_pk": zone.pk}))
        # 카테고리는 사용자 것이라 장소와 함께 지워지지 않는다
        self.assertEqual((Category.objects.count(), Restaurant.objects.count(), RestaurantReview.objects.count()),
                         (1, 0, 0))


class ForgottenRestaurantsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.category = make_category(self.zone, "치킨")
        self.client.login(username="owner", password="123")

    def _restaurant(self, name, day, point):
        restaurant = make_restaurant(category=self.category, name=name)
        make_review(restaurant=restaurant, user=self.user, ordered_at=day, point=point)

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
        self.category = make_category(self.zone, "치킨")
        make_category(self.zone, "돈까스")
        self.client.login(username="owner", password="123")
        self.zone_url = reverse("zone-delete", kwargs={"zone_pk": self.zone.pk})
        self.category_url = reverse("category-delete", kwargs={"category_pk": self.category.pk})

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
        response = self.client.post(reverse("category-list"),
                                    data={"keyword": "돈까스"})
        self.assertEqual(response.status_code, 400)

    def test_same_keyword_is_one_category_for_all_zones(self):
        Zone.objects.create(user=self.user, name="회사")
        response = self.client.post(reverse("category-list"), data={"keyword": "돈까스"})
        self.assertEqual(response.status_code, 400)

    def test_other_user_can_have_same_keyword(self):
        User.objects.create_user(username="other", password="123")
        self.client.login(username="other", password="123")
        self.assertEqual(self.client.post(reverse("category-list"), data={"keyword": "돈까스"}).status_code, 201)


class DashboardTagsTestCase(TestCase):
    def test_restaurant_with_two_categories_counted_once(self):
        user = User.objects.create_user(username="owner", password="123")
        zone = Zone.objects.create(user=user, name="우리집")
        chicken = make_category(zone, "치킨")
        snack = make_category(zone, "분식")
        restaurant = make_restaurant(categories=[chicken, snack], zone=zone, name="김밥천국")
        for day in ("2026-09-01", "2026-09-02"):
            make_review(restaurant=restaurant, user=user, ordered_at=day, point=1, menu="김밥")
        self.client.login(username="owner", password="123")

        data = self.client.get(reverse("zone-dashboard", kwargs={"zone_pk": zone.pk})).json()
        self.assertEqual((data["restaurant_count"], data["review_count"]), (1, 2))
        self.assertEqual([r["name"] for r in data["delicious_restaurants"]], ["김밥천국"])
        self.assertEqual([r["name"] for r in data["recent_restaurants"]], ["김밥천국"])
        self.assertEqual([c["keyword"] for c in data["recent_restaurants"][0]["categories"]], ["치킨", "분식"])


class CategoryBrowseTestCase(TestCase):
    """카테고리별로 어느 장소에 어떤 음식점이 있는지."""

    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.home = Zone.objects.create(user=self.user, name="우리집")
        self.office = Zone.objects.create(user=self.user, name="회사")
        self.chicken = make_category(self.home, "치킨")
        self.pizza = make_category(self.home, "피자")
        make_restaurant(category=self.chicken, zone=self.home, name="교촌")
        make_restaurant(category=self.chicken, zone=self.home, name="BBQ")
        bhc = make_restaurant(category=self.chicken, zone=self.office, name="회사 앞 BHC")
        make_review(restaurant=bhc, user=self.user, ordered_at="2026-09-01", point=1, menu="뿌링클")
        self.client.login(username="owner", password="123")

    def test_list_shows_counts_per_zone(self):
        rows = {row["keyword"]: row["zones"] for row in self.client.get(reverse("category-list")).json()}
        self.assertEqual(rows["치킨"], [{"id": self.home.id, "name": "우리집", "count": 2},
                                       {"id": self.office.id, "name": "회사", "count": 1}])
        self.assertEqual(rows["피자"], [])

    def test_restaurants_grouped_by_zone(self):
        groups = self.client.get(reverse("category-restaurants", kwargs={"category_pk": self.chicken.pk})).json()
        self.assertEqual([g["zone"]["name"] for g in groups], ["우리집", "회사"])
        self.assertEqual(sorted(r["name"] for r in groups[0]["restaurants"]), ["BBQ", "교촌"])
        self.assertEqual(groups[1]["restaurants"][0]["review_avg"], 1)

    def test_other_users_category_is_404(self):
        User.objects.create_user(username="attacker", password="123")
        self.client.login(username="attacker", password="123")
        url = reverse("category-restaurants", kwargs={"category_pk": self.chicken.pk})
        self.assertEqual(self.client.get(url).status_code, 404)
