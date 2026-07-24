from datetime import datetime

from django.contrib.auth.models import User
from django.test import TestCase
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
