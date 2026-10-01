from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from apps.restaurant.branch_merge import find_candidates
from apps.restaurant.models import Restaurant
from apps.restaurant.testing import make_category, make_restaurant, make_review
from apps.zone.models import Category, Zone


class MergeBranchesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.chicken = make_category(self.zone, "치킨")
        self.snack = make_category(self.zone, "분식")
        self.brand = make_restaurant(category=self.chicken, name="교촌치킨")
        self.source = make_restaurant(categories=[self.chicken, self.snack], zone=self.zone, name="교촌치킨 역삼점",
                                      description="양념 따로")
        make_review(restaurant=self.brand, user=self.user, ordered_at="2026-01-01", menu="허니콤보", point=1)
        make_review(restaurant=self.source, user=self.user, ordered_at="2026-02-01", menu="허니 콤보", point=-1)
        make_review(restaurant=self.source, user=self.user, ordered_at="2026-02-02", menu="", point=0)

    def run_command(self, *args):
        out = StringIO()
        call_command("merge_branches", *args, stdout=out)
        return out.getvalue()

    def test_finds_only_safe_candidates(self):
        # 앞부분 이름의 음식점이 없는 "…점"은 후보가 아니다
        make_restaurant(category=self.chicken, name="홍콩반점")
        # 다른 장소의 같은 브랜드에는 붙이지 않는다
        other_zone = Zone.objects.create(user=self.user, name="회사")
        make_restaurant(category=make_category(other_zone, "치킨"), name="교촌치킨 강남점")
        # "점"으로 끝나지 않으면 지점으로 보지 않는다
        make_restaurant(category=self.chicken, name="교촌치킨 순살")

        names = [(c.source.name, c.brand.name, c.branch_name) for c in find_candidates()]
        self.assertEqual(names, [("교촌치킨 역삼점", "교촌치킨", "역삼점")])

    def test_preview_changes_nothing(self):
        out = self.run_command()
        self.assertIn("교촌치킨 역삼점 → 교촌치킨 / 역삼점 지점 (리뷰 2개)", out)
        self.assertIn("--apply", out)
        self.assertTrue(Restaurant.objects.filter(name="교촌치킨 역삼점").exists())

    def test_apply_moves_reviews_to_branch(self):
        out = self.run_command("--apply")
        self.assertIn("1곳을 지점으로 옮겼어요", out)
        self.assertFalse(Restaurant.objects.filter(name="교촌치킨 역삼점").exists())

        self.brand.refresh_from_db()
        reviews = {(r.ordered_at.isoformat(), r.menu_name, r.branch_name) for r in self.brand.review_set.all()}
        self.assertEqual(reviews, {
            ("2026-01-01", "허니콤보", ""),
            # 띄어쓰기만 다른 메뉴는 브랜드 메뉴로 합쳐진다
            ("2026-02-01", "허니콤보", "역삼점"),
            ("2026-02-02", "", "역삼점"),
        })
        self.assertEqual(self.brand.menus.count(), 1)
        self.assertEqual(sorted(self.brand.categories.values_list("keyword", flat=True)), ["분식", "치킨"])
        self.assertEqual(self.brand.description, "양념 따로")

    def test_apply_only_selected(self):
        make_restaurant(category=self.chicken, name="교촌치킨 본점")
        self.run_command("--apply", "--only", "교촌치킨 본점")
        self.assertTrue(Restaurant.objects.filter(name="교촌치킨 역삼점").exists())
        self.assertFalse(Restaurant.objects.filter(name="교촌치킨 본점").exists())
        self.assertEqual(list(self.brand.branches.values_list("name", flat=True)), ["본점"])

    def test_nothing_to_do(self):
        self.run_command("--apply")
        self.assertIn("옮길 후보가 없어요", self.run_command())
