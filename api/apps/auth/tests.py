from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse


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
