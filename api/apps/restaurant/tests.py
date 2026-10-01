from datetime import datetime

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from apps.restaurant.models import Restaurant, RestaurantReview
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
