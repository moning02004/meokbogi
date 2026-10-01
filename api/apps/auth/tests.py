import os
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from apps.restaurant.models import Restaurant, RestaurantReview
from apps.zone.models import Category, Zone


class ObtainTokenTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="pw-correct-123")

    def test_returns_access_token_and_sets_refresh_cookie(self):
        response = self.client.post(reverse("obtain-token"),
                                    data={"username": "owner", "password": "pw-correct-123"})
        self.assertEqual(response.status_code, 200)

        # refresh 토큰은 응답 본문이 아니라 httponly 쿠키로만 나가야 한다
        self.assertIn("access_token", response.json())
        self.assertNotIn("refresh", response.json())
        self.assertEqual(response.json()["user_id"], self.user.id)

        cookie = response.cookies[settings.REFRESH_COOKIE_NAME]
        self.assertTrue(cookie.value)
        self.assertTrue(cookie["httponly"])

    def test_rejects_wrong_password(self):
        response = self.client.post(reverse("obtain-token"),
                                    data={"username": "owner", "password": "wrong"})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(settings.REFRESH_COOKIE_NAME, response.cookies)


class RefreshTokenTestCase(TestCase):
    def setUp(self):
        User.objects.create_user(username="owner", password="pw-correct-123")
        self.client.post(reverse("obtain-token"),
                         data={"username": "owner", "password": "pw-correct-123"})

    def test_refresh_reads_cookie_and_rotates_it(self):
        before = self.client.cookies[settings.REFRESH_COOKIE_NAME].value

        response = self.client.post(reverse("refresh-token"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.json())

        # ROTATE_REFRESH_TOKENS=True 이므로 쿠키가 새 값으로 교체되어야 한다
        after = response.cookies[settings.REFRESH_COOKIE_NAME].value
        self.assertTrue(after)
        self.assertNotEqual(before, after)

    def test_refresh_without_cookie_fails(self):
        self.client.cookies.pop(settings.REFRESH_COOKIE_NAME)

        response = self.client.post(reverse("refresh-token"))
        self.assertEqual(response.status_code, 400)

    def test_logout_clears_cookie(self):
        response = self.client.delete(reverse("logout"))
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.cookies[settings.REFRESH_COOKIE_NAME].value, "")

    def test_logout_works_without_authentication(self):
        # 액세스 토큰이 만료된 뒤에도 로그아웃은 가능해야 한다
        self.client.logout()
        self.assertEqual(self.client.delete(reverse("logout")).status_code, 204)


class UserInfoTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="pw-correct-123")
        self.client.login(username="owner", password="pw-correct-123")

    def test_requires_authentication(self):
        self.client.logout()
        self.assertEqual(self.client.get(reverse("my-info")).status_code, 401)

    def test_returns_own_counts(self):
        response = self.client.get(reverse("my-info"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], "owner")
        self.assertEqual(response.json()["zone_count"], 0)


class ChangePasswordTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="pw-correct-123")
        self.client.login(username="owner", password="pw-correct-123")
        self.url = reverse("change-password")

    def _body(self, current="pw-correct-123", new="pw-brand-new-456", confirm=None):
        return {"current_password": current, "new_password": new,
                "new_password_confirm": new if confirm is None else confirm}

    def test_changes_password(self):
        response = self.client.patch(self.url, data=self._body(), content_type="application/json")
        self.assertEqual(response.status_code, 204)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("pw-brand-new-456"))

    def test_rejects_wrong_current_password(self):
        response = self.client.patch(self.url, data=self._body(current="wrong"),
                                     content_type="application/json")
        self.assertEqual(response.status_code, 400)

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("pw-correct-123"))

    def test_rejects_mismatched_confirmation(self):
        response = self.client.patch(self.url, data=self._body(confirm="다름"),
                                     content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_rejects_weak_password(self):
        response = self.client.patch(self.url, data=self._body(new="1234"),
                                     content_type="application/json")
        self.assertEqual(response.status_code, 400)


class ExistsUserTestCase(TestCase):
    def test_false_when_no_user(self):
        response = self.client.get(reverse("exists-user"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["exists"])

    def test_true_after_signup(self):
        User.objects.create_user(username="owner", password="123")
        self.assertTrue(self.client.get(reverse("exists-user")).json()["exists"])


class LoginThrottleTestCase(TestCase):
    # 요청 한도는 캐시에 쌓이므로 다른 테스트에 새지 않도록 앞뒤로 비운다
    def setUp(self):
        cache.clear()
        User.objects.create_user(username="owner", password="pw-correct-123")

    def tearDown(self):
        cache.clear()

    def test_blocks_after_ten_attempts_per_minute(self):
        for _ in range(10):
            response = self.client.post(reverse("obtain-token"), data={"username": "owner", "password": "wrong"})
            self.assertEqual(response.status_code, 401)

        response = self.client.post(reverse("obtain-token"),
                                    data={"username": "owner", "password": "pw-correct-123"})
        self.assertEqual(response.status_code, 429)

    def test_refresh_is_not_limited_by_login_scope(self):
        # 자동로그인(refresh)은 로그인 한도와 별개여야 앱을 자주 열어도 튕기지 않는다
        self.client.post(reverse("obtain-token"), data={"username": "owner", "password": "pw-correct-123"})
        for _ in range(10):
            self.client.post(reverse("obtain-token"), data={"username": "owner", "password": "wrong"})

        self.assertEqual(self.client.post(reverse("refresh-token")).status_code, 200)


class UserInfoDetailTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="pw-correct-123")
        self.client.login(username="owner", password="pw-correct-123")

    def test_counts_only_own_records(self):
        zone = Zone.objects.create(user=self.user, name="우리집")
        category = Category.objects.create(zone=zone, keyword="치킨")
        first = Restaurant.objects.create(category=category, name="교촌")
        Restaurant.objects.create(category=category, name="BBQ")
        for day in ("2026-01-01", "2026-01-02", "2026-01-03"):
            RestaurantReview.objects.create(restaurant=first, user=self.user, ordered_at=day, point=1)

        other = User.objects.create_user(username="other", password="123")
        other_zone = Zone.objects.create(user=other, name="남의 집")
        other_restaurant = Restaurant.objects.create(
            category=Category.objects.create(zone=other_zone, keyword="피자"), name="남의 가게")
        RestaurantReview.objects.create(restaurant=other_restaurant, user=other, ordered_at="2026-01-01", point=1)

        data = self.client.get(reverse("my-info")).json()
        self.assertEqual((data["zone_count"], data["restaurant_count"], data["review_count"]), (1, 2, 3))

    def test_updates_name_but_not_username(self):
        response = self.client.patch(reverse("my-info"), data={"first_name": "먹보", "username": "hacker"},
                                     content_type="application/json")
        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "먹보")
        self.assertEqual(self.user.username, "owner")

    def test_version_comes_from_environment(self):
        with mock.patch.dict(os.environ, {"APP_VERSION": "1.2.2"}):
            response = self.client.get(reverse("my-info"))
        self.assertEqual(response.json()["version"], "1.2.2")


class ChangePasswordMessageTestCase(TestCase):
    def setUp(self):
        User.objects.create_user(username="owner", password="pw-correct-123")
        self.url = reverse("change-password")

    def test_requires_authentication(self):
        response = self.client.patch(self.url, data={}, content_type="application/json")
        self.assertEqual(response.status_code, 401)

    def test_validation_messages_are_korean(self):
        # 화면이 서버 메시지를 그대로 보여주므로 LANGUAGE_CODE가 영어로 돌아가면 안 된다
        self.client.login(username="owner", password="pw-correct-123")
        response = self.client.patch(self.url, data={"current_password": "pw-correct-123", "new_password": "1234",
                                                     "new_password_confirm": "1234"},
                                     content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("짧습니다", " ".join(response.json()["non_field_errors"]))
