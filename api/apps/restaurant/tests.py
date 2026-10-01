from datetime import date, datetime
from types import SimpleNamespace
from unittest import mock

import json

from django.core.files.uploadedfile import SimpleUploadedFile

from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from apps.restaurant.menus import get_or_create_menu, normalize_menu
from apps.restaurant.models import Restaurant, RestaurantReview
from apps.restaurant.testing import make_restaurant, make_review
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
        url = reverse("all-restaurants", kwargs={"zone_pk": zone.pk})
        body = {
            "name": "test",
            "description": "test",
            "address": "test",
            "category_ids": [category1.pk],
        }
        response = self.client.post(url, data=body, content_type="application/json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual([c["keyword"] for c in response.json()["categories"]], ["test1"])

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

        response = self.client.get(url, {"category": category2.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 0)

    def test_restaurant_detail(self):
        user = User.objects.create_user(username='test', password='123')
        zone = Zone.objects.create(user=user, name="test")
        category1 = Category.objects.create(keyword="test1", zone=zone)

        self.client.login(username="test", password="123")
        url = reverse("all-restaurants", kwargs={"zone_pk": zone.pk})
        body = {
            "name": "test",
            "description": "test",
            "address": "test",
            "category_ids": [category1.pk],
        }
        response = self.client.post(url, data=body, content_type="application/json")
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
        restaurant = make_restaurant(category=category, name="restaurant")

        # 김치찌개: point 1, 0, 0 -> 평균 1/3 (정수 나눗셈이면 0으로 잘림)
        make_review(restaurant=restaurant, user=user, menu="김치찌개",
                                        ordered_at=datetime.now().date(), content="good", point=1)
        make_review(restaurant=restaurant, user=user, menu="김치찌개",
                                        ordered_at=datetime.now().date(), content="soso", point=0)
        make_review(restaurant=restaurant, user=user, menu="김치찌개",
                                        ordered_at=datetime.now().date(), content="bad", point=0)
        # 된장찌개: point 1 -> 평균 1
        make_review(restaurant=restaurant, user=user, menu="된장찌개",
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
        self.restaurant = make_restaurant(category=self.category, name="비밀맛집")
        self.review = make_review(restaurant=self.restaurant, user=self.victim,
                                                      ordered_at="2026-01-01", point=1)

        self.client.login(username="attacker", password="123")

    def test_cannot_list_other_users_restaurants(self):
        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        self.assertEqual(self.client.get(url).json()["count"], 0)

    def test_cannot_list_other_users_restaurants_by_category(self):
        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        self.assertEqual(self.client.get(url, {"category": self.category.pk}).json()["count"], 0)

    def test_cannot_create_restaurant_in_other_users_zone(self):
        # get_queryset은 조회에만 적용되므로 생성 경로에 대한 검증이 따로 필요하다
        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        response = self.client.post(url, data={"name": "침입맛집", "category_ids": [self.category.pk]},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(Restaurant.objects.count(), 1)

    def test_cannot_tag_my_restaurant_with_other_users_category(self):
        attacker = User.objects.get(username="attacker")
        my_zone = Zone.objects.create(user=attacker, name="내 장소")
        url = reverse("all-restaurants", kwargs={"zone_pk": my_zone.pk})
        response = self.client.post(url, data={"name": "침입맛집", "category_ids": [self.category.pk]},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(self.category.restaurants.exclude(pk=self.restaurant.pk).exists())

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
        return make_review(restaurant=restaurant, user=self.user, ordered_at=ordered_at,
                                               menu=menu, point=point)

    def test_restaurants_ordered_by_latest_visit_with_unvisited_last(self):
        old = make_restaurant(category=self.category, name="오래전")
        recent = make_restaurant(category=self.category, name="최근")
        unvisited = make_restaurant(category=self.category, name="미방문")
        self._review(old, "2026-01-01")
        self._review(recent, "2026-09-01")

        response = self.client.get(reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk}))
        names = [row["name"] for row in response.json()["results"]]
        self.assertEqual(names, [recent.name, old.name, unvisited.name])

    def test_search_by_name(self):
        make_restaurant(category=self.category, name="교촌치킨")
        make_restaurant(category=self.category, name="미뜨레피자")

        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        response = self.client.get(url, {"search": "교촌"})
        self.assertEqual([row["name"] for row in response.json()["results"]], ["교촌치킨"])

    def test_non_numeric_category_filter_is_ignored(self):
        make_restaurant(category=self.category, name="교촌치킨")

        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        response = self.client.get(url, {"category": "abc"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_missing_restaurant_is_404(self):
        response = self.client.get(reverse("restaurant-info", kwargs={"restaurant_pk": 999999}))
        self.assertEqual(response.status_code, 404)

    def test_reviews_ordered_by_ordered_at_desc(self):
        restaurant = make_restaurant(category=self.category, name="교촌치킨")
        first = self._review(restaurant, "2026-01-01")
        third = self._review(restaurant, "2026-03-01")
        second = self._review(restaurant, "2026-02-01")

        response = self.client.get(reverse("review-create", kwargs={"restaurant_pk": restaurant.pk}))
        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [third.id, second.id, first.id])

    def test_menu_summaries_ordered_by_review_count(self):
        restaurant = make_restaurant(category=self.category, name="교촌치킨")
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
        self.restaurant = make_restaurant(category=self.chicken, name="교촌치킨")
        self.client.login(username="owner", password="123")
        self.create_url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        self.info_url = reverse("restaurant-info", kwargs={"restaurant_pk": self.restaurant.pk})
        self.review_url = reverse("review-create", kwargs={"restaurant_pk": self.restaurant.pk})

    def _patch(self, url, body):
        return self.client.patch(url, data=body, content_type="application/json")

    def test_requires_authentication(self):
        self.client.logout()
        url = reverse("all-restaurants", kwargs={"zone_pk": self.zone.pk})
        self.assertEqual(self.client.get(url).status_code, 401)

    def _create(self, body):
        return self.client.post(self.create_url, data=body, content_type="application/json")

    def test_create_requires_name(self):
        self.assertEqual(self._create({"description": "메모", "category_ids": [self.chicken.pk]}).status_code, 400)

    def test_create_rejects_too_long_name(self):
        self.assertEqual(self._create({"name": "가" * 101, "category_ids": [self.chicken.pk]}).status_code, 400)

    def test_create_requires_at_least_one_category(self):
        self.assertEqual(self._create({"name": "김밥천국"}).status_code, 400)
        self.assertEqual(self._create({"name": "김밥천국", "category_ids": []}).status_code, 400)

    def test_create_with_several_categories(self):
        # 분식과 돈까스를 다 파는 김밥집
        response = self._create({"name": "김밥천국", "category_ids": [self.chicken.pk, self.pizza.pk]})
        self.assertEqual(response.status_code, 201)
        restaurant = Restaurant.objects.get(pk=response.json()["id"])
        self.assertEqual(restaurant.zone, self.zone)
        self.assertEqual(sorted(restaurant.categories.values_list("keyword", flat=True)), ["치킨", "피자"])

        # 두 카테고리 어느 쪽으로 걸러도 나온다
        for category in (self.chicken, self.pizza):
            names = [r["name"] for r in self.client.get(self.create_url, {"category": category.pk}).json()["results"]]
            self.assertIn("김밥천국", names)

    def test_move_to_another_category_in_my_zone(self):
        response = self._patch(self.info_url, {"category_ids": [self.pizza.pk]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([c["keyword"] for c in response.json()["categories"]], ["피자"])

    def test_patch_without_categories_keeps_them(self):
        response = self._patch(self.info_url, {"name": "교촌치킨 역점"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([c["keyword"] for c in response.json()["categories"]], ["치킨"])

    def test_cannot_remove_every_category(self):
        self.assertEqual(self._patch(self.info_url, {"category_ids": []}).status_code, 400)

    def test_cannot_move_into_other_users_category(self):
        other = User.objects.create_user(username="other", password="123")
        other_category = Category.objects.create(zone=Zone.objects.create(user=other, name="남의 집"),
                                                 keyword="치킨")

        response = self._patch(self.info_url, {"category_ids": [other_category.pk]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(list(self.restaurant.categories.all()), [self.chicken])

    def test_delete_removes_reviews(self):
        make_review(restaurant=self.restaurant, user=self.user, ordered_at="2026-01-01")

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
        other_restaurant = make_restaurant(category=self.chicken, name="BBQ")
        review = make_review(restaurant=other_restaurant, user=self.user,
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
        for i in range(25):
            make_restaurant(category=self.chicken, name=f"가게{i}")

        first = self.client.get(self.list_url, {"page": 1}).json()
        second = self.client.get(self.list_url, {"page": 2}).json()
        ids = [row["id"] for row in first["results"] + second["results"]]
        self.assertEqual((len(first["results"]), len(second["results"])), (20, 5))
        self.assertEqual(len(set(ids)), 25)

    def test_category_filter(self):
        make_restaurant(category=self.chicken, name="교촌치킨")
        make_restaurant(category=self.pizza, name="미뜨레피자")

        response = self.client.get(self.list_url, {"category": self.pizza.pk})
        self.assertEqual([row["name"] for row in response.json()["results"]], ["미뜨레피자"])

    def test_search_does_not_leak_other_users_restaurants(self):
        other = User.objects.create_user(username="other", password="123")
        other_category = Category.objects.create(zone=Zone.objects.create(user=other, name="남의 집"),
                                                 keyword="치킨")
        make_restaurant(category=other_category, name="교촌치킨")

        response = self.client.get(self.list_url, {"search": "교촌"})
        self.assertEqual(response.json()["count"], 0)

    def test_visit_count_counts_distinct_days(self):
        # 한 번 주문에서 메뉴 두 개를 기록해도 방문은 1회다
        restaurant = make_restaurant(category=self.chicken, name="교촌치킨")
        for menu, day in (("후라이드", "2026-01-01"), ("양념", "2026-01-01"), ("간장", "2026-01-05")):
            make_review(restaurant=restaurant, user=self.user, ordered_at=day, menu=menu,
                                            point=1)

        row = self.client.get(self.list_url).json()["results"][0]
        self.assertEqual(row["ordered_count"], 2)
        self.assertEqual(row["review_count"], 3)
        self.assertEqual(row["latest_ordered_at"], "2026-01-05")

    def test_review_menu_filter_includes_blank_menu(self):
        # 화면의 "메뉴 미기재" 필터는 menu= (빈 값)으로 요청한다
        restaurant = make_restaurant(category=self.chicken, name="교촌치킨")
        make_review(restaurant=restaurant, user=self.user, ordered_at="2026-01-01", menu="")
        make_review(restaurant=restaurant, user=self.user, ordered_at="2026-01-02", menu="양념")

        url = reverse("review-create", kwargs={"restaurant_pk": restaurant.pk})
        self.assertEqual(self.client.get(url, {"menu": ""}).json()["count"], 1)
        self.assertEqual(self.client.get(url, {"menu": "양념"}).json()["count"], 1)
        self.assertEqual(self.client.get(url).json()["count"], 2)

    def test_reviews_on_same_day_newest_first(self):
        restaurant = make_restaurant(category=self.chicken, name="교촌치킨")
        older = make_review(restaurant=restaurant, user=self.user, ordered_at="2026-01-01")
        newer = make_review(restaurant=restaurant, user=self.user, ordered_at="2026-01-01")

        url = reverse("review-create", kwargs={"restaurant_pk": restaurant.pk})
        self.assertEqual([row["id"] for row in self.client.get(url).json()["results"]], [newer.id, older.id])


class ReviewEditTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        zone = Zone.objects.create(user=self.user, name="우리집")
        self.restaurant = make_restaurant(category=Category.objects.create(zone=zone, keyword="치킨"),
                                                    name="교촌치킨")
        self.review = make_review(restaurant=self.restaurant, user=self.user,
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
        self.assertEqual((self.review.menu_name, self.review.point), ("간장", 1))

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
            restaurant = make_restaurant(category=category, name=name)
            for day, point in visits:
                make_review(restaurant=restaurant, user=self.user, ordered_at=day, point=point)

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
        restaurant = make_restaurant(category=Category.objects.create(zone=zone, keyword="치킨"),
                                               name="교촌치킨")
        make_review(restaurant=restaurant, user=user, ordered_at="2026-01-01", menu="양념",
                                        point=1)
        make_review(restaurant=restaurant, user=user, ordered_at="2026-03-01", menu="양념",
                                        point=-1)
        make_review(restaurant=restaurant, user=user, ordered_at="2026-02-01", menu="양념",
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
        make_restaurant(category=self.chicken, name="교촌치킨")
        make_restaurant(category=self.pizza, name="미뜨레피자")

        for _ in range(5):
            response = self.client.get(self.url, {"category": self.pizza.pk})
            self.assertEqual(response.json()["restaurant"]["name"], "미뜨레피자")

    def test_returns_null_when_nothing_to_pick(self):
        response = self.client.get(self.url, {"category": self.pizza.pk})
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["restaurant"])

    def test_skips_disappointing_unless_asked(self):
        bad = make_restaurant(category=self.chicken, name="별로")
        make_review(restaurant=bad, user=self.user, ordered_at="2026-01-01", point=-1)

        self.assertIsNone(self.client.get(self.url, {"category": self.chicken.pk}).json()["restaurant"])
        response = self.client.get(self.url, {"category": self.chicken.pk, "exclude_disappointing": "0"})
        self.assertEqual(response.json()["restaurant"]["name"], "별로")

    def test_never_picks_other_users_restaurant(self):
        other = User.objects.create_user(username="other", password="123")
        other_zone = Zone.objects.create(user=other, name="남의 집")
        make_restaurant(category=Category.objects.create(zone=other_zone, keyword="치킨"), name="남의 가게")

        url = reverse("restaurant-pick", kwargs={"zone_pk": other_zone.pk})
        self.assertIsNone(self.client.get(url).json()["restaurant"])


class MenuSpellingTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        zone = Zone.objects.create(user=self.user, name="우리집")
        self.restaurant = make_restaurant(category=Category.objects.create(zone=zone, keyword="치킨"), name="교촌치킨")
        self.client.login(username="owner", password="123")
        self.url = reverse("review-create", kwargs={"restaurant_pk": self.restaurant.pk})

    def _post(self, menu):
        response = self.client.post(self.url, data={"ordered_at": "2026-01-01", "menu": menu, "point": 1})
        return RestaurantReview.objects.get(pk=response.json()["id"]).menu_name

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
        other = make_restaurant(category=self.restaurant.categories.first(), name="BBQ")
        make_review(restaurant=other, user=self.user, ordered_at="2026-01-01", menu="간장치킨")
        self.assertEqual(get_or_create_menu(self.restaurant, "간장 치킨").name, "간장 치킨")

    def test_editing_only_review_keeps_new_spelling(self):
        review = make_review(restaurant=self.restaurant, user=self.user,
                                                 ordered_at="2026-01-01", menu="간장치킨")
        url = reverse("review-delete", kwargs={"restaurant_pk": self.restaurant.pk, "review_pk": review.pk})
        self.client.patch(url, data={"menu": "간장 치킨"}, content_type="application/json")

        review.refresh_from_db()
        self.assertEqual(review.menu_name, "간장 치킨")

    def test_editing_into_existing_menu_joins_it(self):
        make_review(restaurant=self.restaurant, user=self.user, ordered_at="2026-01-01",
                                        menu="간장치킨")
        review = make_review(restaurant=self.restaurant, user=self.user,
                                                 ordered_at="2026-01-02", menu="양념")
        url = reverse("review-delete", kwargs={"restaurant_pk": self.restaurant.pk, "review_pk": review.pk})
        self.client.patch(url, data={"menu": "간장 치킨"}, content_type="application/json")

        review.refresh_from_db()
        self.assertEqual(review.menu_name, "간장치킨")

    def test_menu_is_one_row_per_restaurant(self):
        self._post("간장치킨")
        self._post("간장 치킨")
        self._post("양념")
        self.assertEqual(sorted(self.restaurant.menus.values_list("name", flat=True)), ["간장치킨", "양념"])

    def test_blank_menu_has_no_menu_row(self):
        self.assertEqual(self._post("  "), "")
        self.assertFalse(self.restaurant.menus.exists())


def _strip_volatile(archive):
    """비교할 때 시각 값(내보낸 시각, 음식점 생성 시각)은 뺀다."""
    archive = json.loads(json.dumps(archive))
    archive.pop("exported_at", None)
    for zone in archive["zones"]:
        for restaurant in zone["restaurants"]:
            restaurant.pop("created_at", None)
    return archive


class ArchiveTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.chicken = Category.objects.create(zone=self.zone, keyword="치킨")
        self.pizza = Category.objects.create(zone=self.zone, keyword="피자")
        self.kyochon = make_restaurant(category=self.chicken, name="교촌치킨", address="역 앞")
        make_restaurant(category=self.pizza, name="미뜨레피자")
        make_review(restaurant=self.kyochon, user=self.user, ordered_at="2026-02-01",
                                        menu="허니콤보", point=1, content="바삭")
        make_review(restaurant=self.kyochon, user=self.user, ordered_at="2026-01-01",
                                        menu="레드콤보", point=-1)
        self.client.login(username="owner", password="123")

    def _export(self, client=None, **params):
        return (client or self.client).get(reverse("archive-export"), params)

    def _import(self, payload, client=None, dry_run=False):
        body = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
        url = reverse("archive-import") + ("?dry_run=1" if dry_run else "")
        return (client or self.client).post(url, {"file": SimpleUploadedFile("archive.json", body)})

    # ---- 내보내기

    def test_export_json_nests_everything_without_ids(self):
        response = self._export()
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment;", response["Content-Disposition"])
        archive = json.loads(response.content)

        self.assertEqual((archive["format"], archive["version"]), ("meokbogi-archive", 2))
        zone = archive["zones"][0]
        self.assertEqual(zone["categories"], ["치킨", "피자"])
        kyochon = zone["restaurants"][0]
        self.assertEqual(kyochon["categories"], ["치킨"])
        self.assertEqual((kyochon["name"], kyochon["address"]), ("교촌치킨", "역 앞"))
        # 리뷰는 먹은 날 순서
        self.assertEqual([r["menu"] for r in kyochon["reviews"]], ["레드콤보", "허니콤보"])
        self.assertNotIn("id", json.dumps(archive))

    def test_export_only_my_records(self):
        other = User.objects.create_user(username="other", password="123")
        Zone.objects.create(user=other, name="남의 집")
        names = [z["name"] for z in json.loads(self._export().content)["zones"]]
        self.assertEqual(names, ["우리집"])

    def test_export_csv_for_spreadsheets(self):
        response = self._export(type="csv")
        self.assertTrue(response["Content-Type"].startswith("text/csv"))
        text = response.content.decode("utf-8")
        self.assertTrue(text.startswith("\ufeff"))  # 엑셀이 UTF-8로 읽도록
        rows = text.lstrip("\ufeff").strip().splitlines()
        self.assertEqual(rows[0], "장소,카테고리,음식점,주소,설명,먹은 날,메뉴,만족도,한줄평")
        self.assertIn("우리집,치킨,교촌치킨,역 앞,,2026-01-01,레드콤보,실망,", rows)
        # 리뷰가 없는 음식점도 한 줄
        self.assertIn("우리집,피자,미뜨레피자,,,,,,", rows)

    @override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:3000"])
    def test_export_filename_is_readable_cross_origin(self):
        # 웹과 API가 다른 출처라 노출하지 않으면 브라우저가 파일 이름을 읽지 못한다
        response = self.client.get(reverse("archive-export"), HTTP_ORIGIN="http://localhost:3000")
        self.assertIn("content-disposition", response.get("Access-Control-Expose-Headers", "").lower())

    def test_export_requires_login(self):
        self.client.logout()
        self.assertEqual(self._export().status_code, 401)

    # ---- 가져오기

    def test_round_trip_into_new_account(self):
        archive = json.loads(self._export().content)

        User.objects.create_user(username="newbie", password="123")
        newbie = self.client_class()
        newbie.login(username="newbie", password="123")
        response = self._import(archive, client=newbie)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reviews_created"], 2)

        again = json.loads(self._export(client=newbie).content)
        self.assertEqual(_strip_volatile(again), _strip_volatile(archive))

    def test_importing_same_file_twice_adds_nothing(self):
        archive = json.loads(self._export().content)
        summary = self._import(archive).json()

        self.assertEqual(summary["zones_created"], 0)
        self.assertEqual(summary["restaurants_created"], 0)
        self.assertEqual(summary["reviews_created"], 0)
        self.assertEqual(summary["reviews_skipped"], 2)
        self.assertEqual(RestaurantReview.objects.count(), 2)

    def test_merges_by_name(self):
        payload = {"format": "meokbogi-archive", "version": 1, "zones": [{
            "name": "우리집",
            "categories": [{
                "keyword": "치 킨",  # 공백만 다른 기존 카테고리로 합쳐진다
                "restaurants": [
                    {"name": "교촌치킨", "reviews": [
                        {"ordered_at": "2026-03-01", "menu": "허니 콤보", "point": 0},
                    ]},
                    {"name": "BBQ", "reviews": []},
                ],
            }, {
                "keyword": "족발",
                "restaurants": [],
            }],
        }, {
            "name": "회사",
            "categories": [],
        }]}
        summary = self._import(payload).json()

        self.assertEqual((summary["zones_created"], summary["categories_created"]), (1, 1))
        self.assertEqual((summary["restaurants_created"], summary["restaurants_matched"]), (1, 1))
        self.assertEqual(Category.objects.filter(zone=self.zone, keyword__startswith="치").count(), 1)
        # 메뉴 표기도 기존 것으로 합친다
        self.assertTrue(RestaurantReview.objects.filter(restaurant=self.kyochon, ordered_at="2026-03-01",
                                                        menu__name="허니콤보").exists())
        # 새로 만든 장소에는 기본 카테고리를 만들지 않는다
        self.assertEqual(Zone.objects.get(user=self.user, name="회사").category_set.count(), 0)

    def test_dry_run_changes_nothing(self):
        payload = {"format": "meokbogi-archive", "version": 1, "zones": [{
            "name": "본가", "categories": [{"keyword": "한식", "restaurants": [
                {"name": "엄마밥", "reviews": [{"ordered_at": "2026-01-01", "menu": "김치찌개", "point": 1}]},
            ]}],
        }]}
        response = self._import(payload, dry_run=True)
        self.assertEqual(response.json()["reviews_created"], 1)
        self.assertTrue(response.json()["dry_run"])
        self.assertFalse(Zone.objects.filter(name="본가").exists())

    def test_rejects_non_json(self):
        response = self._import(b"\x89PNG not json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("JSON", response.json()["file"])

    def test_rejects_other_format(self):
        for payload in ({"format": "something-else", "version": 1, "zones": []}, {"hello": "world"}, [1, 2]):
            response = self._import(payload)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["file"], "먹보기에서 내보낸 백업 파일이 아니에요.")

    def test_rejects_newer_version(self):
        response = self._import({"format": "meokbogi-archive", "version": 99, "zones": []})
        self.assertEqual(response.status_code, 400)

    def test_invalid_review_writes_nothing(self):
        payload = {"format": "meokbogi-archive", "version": 1, "zones": [{
            "name": "본가", "categories": [{"keyword": "한식", "restaurants": [
                {"name": "엄마밥", "reviews": [{"ordered_at": "2026-01-01", "menu": "김치찌개", "point": 5}]},
            ]}],
        }]}
        self.assertEqual(self._import(payload).status_code, 400)
        self.assertFalse(Zone.objects.filter(name="본가").exists())

    def test_requires_file(self):
        self.assertEqual(self.client.post(reverse("archive-import"), {}).status_code, 400)
