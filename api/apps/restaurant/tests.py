from datetime import date, datetime
from importlib import import_module
from types import SimpleNamespace
from unittest import mock

from django.apps import apps as django_apps

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from apps.restaurant.menus import canonical_menu, normalize_menu
from apps.restaurant.models import Restaurant, RestaurantReview
from apps.restaurant.picking import pick_restaurant, pick_weight
from apps.zone.models import Zone, Category


class RestaurantTestCase(TestCase):

    def test_get_restaurant(self):
        user = User.objects.create_user(username='test', password='123')
        zone = Zone.objects.create(user=user, name="test")
        category = Category.objects.create(keyword="test", zone=zone)

        self.client.login(username="test", password="123")
        url = reverse("all-restaurants", kwargs={"zone_pk": zone.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_create_restaurant(self):
        user = User.objects.create_user(username='test', password='123')
        zone = Zone.objects.create(user=user, name="test")
        category1 = Category.objects.create(keyword="test1", zone=zone)
        category2 = Category.objects.create(keyword="test2", zone=zone)

        self.client.login(username="test", password="123")
        url = reverse("restaurants", kwargs={"zone_pk": zone.pk, "category_pk": category1.pk})
        body = {
            "name": "test",
            "description": "test",
            "address": "test",
        }
        response = self.client.post(url, data=body)
        self.assertEqual(response.status_code, 201)

        url = reverse("all-restaurants", kwargs={"zone_pk": zone.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

        url = reverse("restaurants", kwargs={"zone_pk": zone.pk, "category_pk": category2.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    def test_restaurant_detail(self):
        user = User.objects.create_user(username='test', password='123')
        zone = Zone.objects.create(user=user, name="test")
        category1 = Category.objects.create(keyword="test1", zone=zone)

        self.client.login(username="test", password="123")
        url = reverse("restaurants", kwargs={"zone_pk": zone.pk, "category_pk": category1.pk})
        body = {
            "name": "test",
            "description": "test",
            "address": "test",
        }
        response = self.client.post(url, data=body)
        self.assertEqual(response.status_code, 201)
        restaurant_id = response.json()["id"]

        url = reverse("restaurant-info", kwargs={"restaurant_pk": restaurant_id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        url = reverse("review-create", kwargs={"restaurant_pk": restaurant_id})
        body = {
            "ordered_at": datetime.now().date(),
            "content": "good",
            "point": 1,
        }
        response = self.client.post(url, data=body)
        self.assertEqual(response.status_code, 201)
        review_id = response.json()["id"]

        url = reverse("restaurant-info", kwargs={"restaurant_pk": restaurant_id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["review_count"], 1)

        url = reverse("review-delete", kwargs={"restaurant_pk": restaurant_id,
                                               "review_pk": review_id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)

        url = reverse("restaurant-info", kwargs={"restaurant_pk": restaurant_id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["review_count"], 0)

    def test_menu_summaries_grouped_by_menu_with_accurate_average(self):
        user = User.objects.create_user(username='test', password='123')
        zone = Zone.objects.create(user=user, name="test")
        category = Category.objects.create(keyword="test", zone=zone)
        restaurant = Restaurant.objects.create(category=category, name="restaurant")

        # 김치찌개: point 1, 0, 0 -> 평균 1/3 (정수 나눗셈이면 0으로 잘림)
        RestaurantReview.objects.create(restaurant=restaurant, user=user, menu="김치찌개",
                                        ordered_at=datetime.now().date(), content="good", point=1)
        RestaurantReview.objects.create(restaurant=restaurant, user=user, menu="김치찌개",
                                        ordered_at=datetime.now().date(), content="soso", point=0)
        RestaurantReview.objects.create(restaurant=restaurant, user=user, menu="김치찌개",
                                        ordered_at=datetime.now().date(), content="bad", point=0)
        # 된장찌개: point 1 -> 평균 1
        RestaurantReview.objects.create(restaurant=restaurant, user=user, menu="된장찌개",
                                        ordered_at=datetime.now().date(), content="good", point=1)

        self.client.login(username="test", password="123")
        url = reverse("restaurant-info", kwargs={"restaurant_pk": restaurant.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        summaries = {s["menu"]: s for s in response.json()["menu_summaries"]}
        self.assertEqual(set(summaries.keys()), {"김치찌개", "된장찌개"})

        self.assertEqual(summaries["김치찌개"]["review_count"], 3)
        self.assertAlmostEqual(summaries["김치찌개"]["review_avg"], 1 / 3)

        self.assertEqual(summaries["된장찌개"]["review_count"], 1)
        self.assertAlmostEqual(summaries["된장찌개"]["review_avg"], 1.0)


class RestaurantAuthorizationTestCase(TestCase):
    """다른 사용자의 음식점/리뷰에 접근할 수 없어야 한다.

    읽기는 403이 아니라 빈 결과로 막는다. 403은 리소스의 존재 여부를 알려주기 때문이다.
    """

    def setUp(self):
        self.victim = User.objects.create_user(username="victim", password="123")
        User.objects.create_user(username="attacker", password="123")

        self.zone = Zone.objects.create(user=self.victim, name="남의 존")
        self.category = Category.objects.create(zone=self.zone, keyword="치킨")
        self.restaurant = Restaurant.objects.create(category=self.category, name="비밀맛집")
        self.review = RestaurantReview.objects.create(restaurant=self.restaurant, user=self.victim,
                                                      ordered_at="2026-01-01", point=1)

        self.client.login(username="attacker", password="123")

    def test_cannot_list_other_users_restaurants(self):
        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        self.assertEqual(self.client.get(url).json()["count"], 0)

    def test_cannot_list_other_users_restaurants_by_category(self):
        url = reverse("restaurants", kwargs={"zone_pk": self.zone.pk, "category_pk": self.category.pk})
        self.assertEqual(self.client.get(url).json()["count"], 0)

    def test_cannot_create_restaurant_in_other_users_category(self):
        # get_queryset은 조회에만 적용되므로 생성 경로에 대한 검증이 따로 필요하다
        url = reverse("restaurants", kwargs={"zone_pk": self.zone.pk, "category_pk": self.category.pk})
        response = self.client.post(url, data={"name": "침입맛집"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Restaurant.objects.count(), 1)

    def test_cannot_read_other_users_reviews(self):
        url = reverse("review-create", kwargs={"restaurant_pk": self.restaurant.pk})
        self.assertEqual(self.client.get(url).json()["count"], 0)

    def test_cannot_write_review_on_other_users_restaurant(self):
        url = reverse("review-create", kwargs={"restaurant_pk": self.restaurant.pk})
        response = self.client.post(url, data={"ordered_at": "2026-02-02", "point": -1})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(RestaurantReview.objects.count(), 1)

    def test_cannot_delete_other_users_review(self):
        url = reverse("review-delete", kwargs={"restaurant_pk": self.restaurant.pk,
                                               "review_pk": self.review.pk})
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertTrue(RestaurantReview.objects.filter(pk=self.review.pk).exists())

    def test_cannot_read_other_users_restaurant_detail(self):
        client = Client(raise_request_exception=False)
        client.login(username="attacker", password="123")

        url = reverse("restaurant-info", kwargs={"restaurant_pk": self.restaurant.pk})
        self.assertEqual(client.get(url).status_code, 404)

    def test_cannot_update_other_users_restaurant(self):
        client = Client(raise_request_exception=False)
        client.login(username="attacker", password="123")

        url = reverse("restaurant-info", kwargs={"restaurant_pk": self.restaurant.pk})
        response = client.patch(url, data='{"name": "바뀜"}', content_type="application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Restaurant.objects.get(pk=self.restaurant.pk).name, "비밀맛집")


class RestaurantListBehaviorTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.category = Category.objects.create(zone=self.zone, keyword="치킨")
        self.client.login(username="owner", password="123")

    def _review(self, restaurant, ordered_at, menu="후라이드", point=1):
        return RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at=ordered_at,
                                               menu=menu, point=point)

    def test_restaurants_ordered_by_latest_visit_with_unvisited_last(self):
        old = Restaurant.objects.create(category=self.category, name="오래전")
        recent = Restaurant.objects.create(category=self.category, name="최근")
        unvisited = Restaurant.objects.create(category=self.category, name="미방문")
        self._review(old, "2026-01-01")
        self._review(recent, "2026-09-01")

        response = self.client.get(reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk}))
        names = [row["name"] for row in response.json()["results"]]
        self.assertEqual(names, [recent.name, old.name, unvisited.name])

    def test_search_by_name(self):
        Restaurant.objects.create(category=self.category, name="교촌치킨")
        Restaurant.objects.create(category=self.category, name="미뜨레피자")

        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        response = self.client.get(url, {"search": "교촌"})
        self.assertEqual([row["name"] for row in response.json()["results"]], ["교촌치킨"])

    def test_non_numeric_category_filter_is_ignored(self):
        Restaurant.objects.create(category=self.category, name="교촌치킨")

        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        response = self.client.get(url, {"category": "abc"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_missing_restaurant_is_404(self):
        response = self.client.get(reverse("restaurant-info", kwargs={"restaurant_pk": 999999}))
        self.assertEqual(response.status_code, 404)

    def test_reviews_ordered_by_ordered_at_desc(self):
        restaurant = Restaurant.objects.create(category=self.category, name="교촌치킨")
        first = self._review(restaurant, "2026-01-01")
        third = self._review(restaurant, "2026-03-01")
        second = self._review(restaurant, "2026-02-01")

        response = self.client.get(reverse("review-create", kwargs={"restaurant_pk": restaurant.pk}))
        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [third.id, second.id, first.id])

    def test_menu_summaries_ordered_by_review_count(self):
        restaurant = Restaurant.objects.create(category=self.category, name="교촌치킨")
        self._review(restaurant, "2026-01-01", menu="양념")
        self._review(restaurant, "2026-01-02", menu="간장")
        self._review(restaurant, "2026-01-03", menu="간장")

        response = self.client.get(reverse("restaurant-info", kwargs={"restaurant_pk": restaurant.pk}))
        menus = [row["menu"] for row in response.json()["menu_summaries"]]
        self.assertEqual(menus, ["간장", "양념"])


class RestaurantWriteTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.chicken = Category.objects.create(zone=self.zone, keyword="치킨")
        self.pizza = Category.objects.create(zone=self.zone, keyword="피자")
        self.restaurant = Restaurant.objects.create(category=self.chicken, name="교촌치킨")
        self.client.login(username="owner", password="123")
        self.create_url = reverse("restaurants", kwargs={"zone_pk": self.zone.pk, "category_pk": self.chicken.pk})
        self.info_url = reverse("restaurant-info", kwargs={"restaurant_pk": self.restaurant.pk})
        self.review_url = reverse("review-create", kwargs={"restaurant_pk": self.restaurant.pk})

    def _patch(self, url, body):
        return self.client.patch(url, data=body, content_type="application/json")

    def test_requires_authentication(self):
        self.client.logout()
        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_create_requires_name(self):
        self.assertEqual(self.client.post(self.create_url, data={"description": "메모"}).status_code, 400)

    def test_create_rejects_too_long_name(self):
        response = self.client.post(self.create_url, data={"name": "가" * 101})
        self.assertEqual(response.status_code, 400)

    def test_move_to_another_category_in_my_zone(self):
        response = self._patch(self.info_url, {"category": self.pizza.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["category_name"], "피자")

    def test_cannot_move_into_other_users_category(self):
        other = User.objects.create_user(username="other", password="123")
        other_category = Category.objects.create(zone=Zone.objects.create(user=other, name="남의 집"),
                                                 keyword="치킨")

        response = self._patch(self.info_url, {"category": other_category.pk})
        self.assertEqual(response.status_code, 400)
        self.restaurant.refresh_from_db()
        self.assertEqual(self.restaurant.category_id, self.chicken.pk)

    def test_delete_removes_reviews(self):
        RestaurantReview.objects.create(restaurant=self.restaurant, user=self.user, ordered_at="2026-01-01")

        self.assertEqual(self.client.delete(self.info_url).status_code, 204)
        self.assertFalse(RestaurantReview.objects.exists())

    def test_review_rejects_unknown_point(self):
        response = self.client.post(self.review_url, data={"ordered_at": "2026-01-01", "menu": "후라이드",
                                                           "point": 2})
        self.assertEqual(response.status_code, 400)

    def test_review_requires_ordered_at(self):
        response = self.client.post(self.review_url, data={"menu": "후라이드", "point": 1})
        self.assertEqual(response.status_code, 400)

    def test_review_rejects_too_long_content(self):
        response = self.client.post(self.review_url, data={"ordered_at": "2026-01-01", "menu": "후라이드",
                                                           "content": "가" * 256, "point": 1})
        self.assertEqual(response.status_code, 400)

    def test_review_belongs_to_requesting_user(self):
        response = self.client.post(self.review_url, data={"ordered_at": "2026-01-01", "menu": "후라이드",
                                                           "point": 1})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(RestaurantReview.objects.get(pk=response.json()["id"]).user_id, self.user.id)

    def test_delete_review_of_another_restaurant_is_404(self):
        # 리뷰 id가 맞아도 URL의 음식점과 다르면 지우지 않는다
        other_restaurant = Restaurant.objects.create(category=self.chicken, name="BBQ")
        review = RestaurantReview.objects.create(restaurant=other_restaurant, user=self.user,
                                                 ordered_at="2026-01-01")
        url = reverse("review-delete", kwargs={"restaurant_pk": self.restaurant.pk, "review_pk": review.pk})

        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertTrue(RestaurantReview.objects.filter(pk=review.pk).exists())


class RestaurantQueryTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.chicken = Category.objects.create(zone=self.zone, keyword="치킨")
        self.pizza = Category.objects.create(zone=self.zone, keyword="피자")
        self.client.login(username="owner", password="123")
        self.list_url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})

    def test_pages_do_not_overlap(self):
        # 정렬 키가 같은(방문 기록 없는) 음식점이 많아도 페이지 사이에 겹침·누락이 없어야 한다
        Restaurant.objects.bulk_create([Restaurant(category=self.chicken, name=f"가게{i}") for i in range(25)])

        first = self.client.get(self.list_url, {"page": 1}).json()
        second = self.client.get(self.list_url, {"page": 2}).json()
        ids = [row["id"] for row in first["results"] + second["results"]]
        self.assertEqual((len(first["results"]), len(second["results"])), (20, 5))
        self.assertEqual(len(set(ids)), 25)

    def test_category_filter(self):
        Restaurant.objects.create(category=self.chicken, name="교촌치킨")
        Restaurant.objects.create(category=self.pizza, name="미뜨레피자")

        response = self.client.get(self.list_url, {"category": self.pizza.pk})
        self.assertEqual([row["name"] for row in response.json()["results"]], ["미뜨레피자"])

    def test_search_does_not_leak_other_users_restaurants(self):
        other = User.objects.create_user(username="other", password="123")
        other_category = Category.objects.create(zone=Zone.objects.create(user=other, name="남의 집"),
                                                 keyword="치킨")
        Restaurant.objects.create(category=other_category, name="교촌치킨")

        response = self.client.get(self.list_url, {"search": "교촌"})
        self.assertEqual(response.json()["count"], 0)

    def test_visit_count_counts_distinct_days(self):
        # 한 번 주문에서 메뉴 두 개를 기록해도 방문은 1회다
        restaurant = Restaurant.objects.create(category=self.chicken, name="교촌치킨")
        for menu, day in (("후라이드", "2026-01-01"), ("양념", "2026-01-01"), ("간장", "2026-01-05")):
            RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at=day, menu=menu,
                                            point=1)

        row = self.client.get(self.list_url).json()["results"][0]
        self.assertEqual(row["ordered_count"], 2)
        self.assertEqual(row["review_count"], 3)
        self.assertEqual(row["latest_ordered_at"], "2026-01-05")

    def test_review_menu_filter_includes_blank_menu(self):
        # 화면의 "메뉴 미기재" 필터는 menu= (빈 값)으로 요청한다
        restaurant = Restaurant.objects.create(category=self.chicken, name="교촌치킨")
        RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at="2026-01-01", menu="")
        RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at="2026-01-02", menu="양념")

        url = reverse("review-create", kwargs={"restaurant_pk": restaurant.pk})
        self.assertEqual(self.client.get(url, {"menu": ""}).json()["count"], 1)
        self.assertEqual(self.client.get(url, {"menu": "양념"}).json()["count"], 1)
        self.assertEqual(self.client.get(url).json()["count"], 2)

    def test_reviews_on_same_day_newest_first(self):
        restaurant = Restaurant.objects.create(category=self.chicken, name="교촌치킨")
        older = RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at="2026-01-01")
        newer = RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at="2026-01-01")

        url = reverse("review-create", kwargs={"restaurant_pk": restaurant.pk})
        self.assertEqual([row["id"] for row in self.client.get(url).json()["results"]], [newer.id, older.id])


class ReviewEditTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        zone = Zone.objects.create(user=self.user, name="우리집")
        self.restaurant = Restaurant.objects.create(category=Category.objects.create(zone=zone, keyword="치킨"),
                                                    name="교촌치킨")
        self.review = RestaurantReview.objects.create(restaurant=self.restaurant, user=self.user,
                                                      ordered_at="2026-01-01", menu="후라이드", point=0)
        self.url = reverse("review-delete", kwargs={"restaurant_pk": self.restaurant.pk,
                                                    "review_pk": self.review.pk})

    def _patch(self, body):
        return self.client.patch(self.url, data=body, content_type="application/json")

    def test_owner_can_edit(self):
        self.client.login(username="owner", password="123")
        response = self._patch({"menu": "간장", "content": "다시 보니 맛있음", "point": 1})
        self.assertEqual(response.status_code, 200)

        self.review.refresh_from_db()
        self.assertEqual((self.review.menu, self.review.point), ("간장", 1))

    def test_edit_validates_point(self):
        self.client.login(username="owner", password="123")
        self.assertEqual(self._patch({"point": 5}).status_code, 400)

    def test_other_user_cannot_edit(self):
        User.objects.create_user(username="attacker", password="123")
        self.client.login(username="attacker", password="123")

        self.assertEqual(self._patch({"content": "바뀜"}).status_code, 404)
        self.review.refresh_from_db()
        self.assertEqual(self.review.content, "")


class RestaurantSortTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        category = Category.objects.create(zone=self.zone, keyword="치킨")
        self.client.login(username="owner", password="123")

        def make(name, visits):
            restaurant = Restaurant.objects.create(category=category, name=name)
            for day, point in visits:
                RestaurantReview.objects.create(restaurant=restaurant, user=self.user, ordered_at=day, point=point)

        make("가 별로", [("2026-09-01", -1)])
        make("나 단골", [("2026-01-01", 1), ("2026-02-01", 0), ("2026-03-01", 1)])
        make("다 최고", [("2026-05-01", 1)])
        make("라 미방문", [])

    def _names(self, sort):
        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        return [row["name"] for row in self.client.get(url, {"sort": sort}).json()["results"]]

    def test_recent_is_default(self):
        self.assertEqual(self._names(""), ["가 별로", "다 최고", "나 단골", "라 미방문"])

    def test_rating(self):
        self.assertEqual(self._names("rating"), ["다 최고", "나 단골", "가 별로", "라 미방문"])

    def test_visits(self):
        self.assertEqual(self._names("visits"), ["나 단골", "가 별로", "다 최고", "라 미방문"])

    def test_name(self):
        self.assertEqual(self._names("name"), ["가 별로", "나 단골", "다 최고", "라 미방문"])

    def test_unknown_sort_falls_back_to_recent(self):
        self.assertEqual(self._names("drop table"), self._names("recent"))


class MenuLastPointTestCase(TestCase):
    def test_menu_summary_has_latest_point(self):
        user = User.objects.create_user(username="owner", password="123")
        zone = Zone.objects.create(user=user, name="우리집")
        restaurant = Restaurant.objects.create(category=Category.objects.create(zone=zone, keyword="치킨"),
                                               name="교촌치킨")
        RestaurantReview.objects.create(restaurant=restaurant, user=user, ordered_at="2026-01-01", menu="양념",
                                        point=1)
        RestaurantReview.objects.create(restaurant=restaurant, user=user, ordered_at="2026-03-01", menu="양념",
                                        point=-1)
        RestaurantReview.objects.create(restaurant=restaurant, user=user, ordered_at="2026-02-01", menu="양념",
                                        point=0)

        self.client.login(username="owner", password="123")
        response = self.client.get(reverse("restaurant-info", kwargs={"restaurant_pk": restaurant.pk}))
        summary = response.json()["menu_summaries"][0]
        self.assertEqual((summary["last_point"], summary["last_ordered_at"]), (-1, "2026-03-01"))


class PickWeightTestCase(TestCase):
    today = date(2026, 10, 1)

    def test_older_visit_weighs_more(self):
        self.assertGreater(pick_weight(1, date(2026, 6, 1), self.today), pick_weight(1, date(2026, 9, 30), self.today))

    def test_better_rating_weighs_more(self):
        visited = date(2026, 9, 1)
        self.assertGreater(pick_weight(1, visited, self.today), pick_weight(0, visited, self.today))

    def test_idle_days_are_capped(self):
        self.assertEqual(pick_weight(0, date(2024, 1, 1), self.today), pick_weight(0, date(2025, 1, 1), self.today))

    def test_yesterday_is_still_possible(self):
        self.assertGreater(pick_weight(-1, self.today, self.today), 0)

    def test_disappointing_excluded_by_default(self):
        bad = SimpleNamespace(review_avg=-1.0, latest_ordered_at=date(2026, 1, 1))
        self.assertIsNone(pick_restaurant([bad], self.today))
        self.assertIs(pick_restaurant([bad], self.today, exclude_disappointing=False), bad)

    def test_passes_weights_to_rng(self):
        old = SimpleNamespace(review_avg=1.0, latest_ordered_at=date(2026, 1, 1))
        new = SimpleNamespace(review_avg=1.0, latest_ordered_at=date(2026, 9, 30))
        rng = mock.Mock()
        rng.choices.return_value = [old]

        pick_restaurant([old, new], self.today, rng=rng)
        weights = rng.choices.call_args.kwargs["weights"]
        self.assertGreater(weights[0], weights[1])


class RestaurantPickAPITestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.chicken = Category.objects.create(zone=self.zone, keyword="치킨")
        self.pizza = Category.objects.create(zone=self.zone, keyword="피자")
        self.client.login(username="owner", password="123")
        self.url = reverse("restaurant-pick", kwargs={"zone_pk": self.zone.pk})

    def test_picks_within_category(self):
        Restaurant.objects.create(category=self.chicken, name="교촌치킨")
        Restaurant.objects.create(category=self.pizza, name="미뜨레피자")

        for _ in range(5):
            response = self.client.get(self.url, {"category": self.pizza.pk})
            self.assertEqual(response.json()["restaurant"]["name"], "미뜨레피자")

    def test_returns_null_when_nothing_to_pick(self):
        response = self.client.get(self.url, {"category": self.pizza.pk})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["restaurant"])

    def test_skips_disappointing_unless_asked(self):
        bad = Restaurant.objects.create(category=self.chicken, name="별로")
        RestaurantReview.objects.create(restaurant=bad, user=self.user, ordered_at="2026-01-01", point=-1)

        self.assertIsNone(self.client.get(self.url, {"category": self.chicken.pk}).json()["restaurant"])
        response = self.client.get(self.url, {"category": self.chicken.pk, "exclude_disappointing": "0"})
        self.assertEqual(response.json()["restaurant"]["name"], "별로")

    def test_never_picks_other_users_restaurant(self):
        other = User.objects.create_user(username="other", password="123")
        other_zone = Zone.objects.create(user=other, name="남의 집")
        Restaurant.objects.create(category=Category.objects.create(zone=other_zone, keyword="치킨"), name="남의 가게")

        url = reverse("restaurant-pick", kwargs={"zone_pk": other_zone.pk})
        self.assertIsNone(self.client.get(url).json()["restaurant"])


class MenuSpellingTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        zone = Zone.objects.create(user=self.user, name="우리집")
        self.restaurant = Restaurant.objects.create(
            category=Category.objects.create(zone=zone, keyword="치킨"), name="교촌치킨")
        self.client.login(username="owner", password="123")
        self.url = reverse("review-create", kwargs={"restaurant_pk": self.restaurant.pk})

    def _post(self, menu):
        response = self.client.post(self.url, data={"ordered_at": "2026-01-01", "menu": menu, "point": 1})
        return RestaurantReview.objects.get(pk=response.json()["id"]).menu

    def test_normalize_ignores_spaces_and_case(self):
        self.assertEqual(normalize_menu(" 간장  치킨 "), normalize_menu("간장치킨"))
        self.assertEqual(normalize_menu("Pizza"), normalize_menu("pizza"))

    def test_new_review_reuses_first_spelling(self):
        self._post("간장치킨")
        self.assertEqual(self._post("간장 치킨"), "간장치킨")

        summaries = self.client.get(reverse("restaurant-info", kwargs={"restaurant_pk": self.restaurant.pk})
                                    ).json()["menu_summaries"]
        self.assertEqual([(row["menu"], row["review_count"]) for row in summaries], [("간장치킨", 2)])

    def test_extra_spaces_are_tidied(self):
        self.assertEqual(self._post("  반반   치킨 "), "반반 치킨")

    def test_spelling_is_not_shared_across_restaurants(self):
        other = Restaurant.objects.create(category=self.restaurant.category, name="BBQ")
        RestaurantReview.objects.create(restaurant=other, user=self.user, ordered_at="2026-01-01", menu="간장치킨")
        self.assertEqual(canonical_menu(self.restaurant, "간장 치킨"), "간장 치킨")

    def test_editing_only_review_keeps_new_spelling(self):
        review = RestaurantReview.objects.create(restaurant=self.restaurant, user=self.user,
                                                 ordered_at="2026-01-01", menu="간장치킨")
        url = reverse("review-delete", kwargs={"restaurant_pk": self.restaurant.pk, "review_pk": review.pk})
        self.client.patch(url, data={"menu": "간장 치킨"}, content_type="application/json")

        review.refresh_from_db()
        self.assertEqual(review.menu, "간장 치킨")

    def test_editing_into_existing_menu_joins_it(self):
        RestaurantReview.objects.create(restaurant=self.restaurant, user=self.user, ordered_at="2026-01-01",
                                        menu="간장치킨")
        review = RestaurantReview.objects.create(restaurant=self.restaurant, user=self.user,
                                                 ordered_at="2026-01-02", menu="양념")
        url = reverse("review-delete", kwargs={"restaurant_pk": self.restaurant.pk, "review_pk": review.pk})
        self.client.patch(url, data={"menu": "간장 치킨"}, content_type="application/json")

        review.refresh_from_db()
        self.assertEqual(review.menu, "간장치킨")

    def test_data_migration_merges_existing_spellings(self):
        for menu in ("간장치킨", "간장 치킨", "간장  치킨 ", "양념", "  "):
            RestaurantReview.objects.create(restaurant=self.restaurant, user=self.user, ordered_at="2026-01-01",
                                            menu=menu)

        migration = import_module("apps.restaurant.migrations.0009_merge_menu_spellings")
        migration.merge_menu_spellings(django_apps, None)

        menus = list(RestaurantReview.objects.order_by("id").values_list("menu", flat=True))
        self.assertEqual(menus, ["간장치킨", "간장치킨", "간장치킨", "양념", ""])
