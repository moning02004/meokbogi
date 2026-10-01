from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [("restaurant", "0009_merge_menu_spellings"), ("zone", "0003_remove_zone_hash_id")]
AFTER = [("restaurant", "0012_data_model_v2_cleanup")]


class DataModelV2MigrationTestCase(TransactionTestCase):
    """1.x 구조(음식점 → 카테고리 하나, 메뉴는 리뷰의 글자)를 2.0 구조로 옮기는 마이그레이션."""

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        self.migrate(executor_leaf())

    def test_forward_and_backward(self):
        old = self.migrate(BEFORE)
        User = old.get_model("auth", "User")
        Zone = old.get_model("zone", "Zone")
        Category = old.get_model("zone", "Category")
        Restaurant = old.get_model("restaurant", "Restaurant")
        Review = old.get_model("restaurant", "RestaurantReview")

        user = User.objects.create(username="owner")
        zone = Zone.objects.create(user=user, name="우리집")
        chicken = Category.objects.create(zone=zone, keyword="치킨")
        kyochon = Restaurant.objects.create(category=chicken, name="교촌")
        bbq = Restaurant.objects.create(category=chicken, name="BBQ")
        for restaurant, menu in ((kyochon, "간장치킨"), (kyochon, "간장 치킨"), (kyochon, ""), (bbq, "간장치킨")):
            Review.objects.create(restaurant=restaurant, user=user, ordered_at="2026-01-01", menu=menu, point=1)

        new = self.migrate(AFTER)
        Restaurant = new.get_model("restaurant", "Restaurant")
        Review = new.get_model("restaurant", "RestaurantReview")
        Menu = new.get_model("restaurant", "Menu")

        kyochon = Restaurant.objects.get(name="교촌")
        self.assertEqual(kyochon.zone_id, zone.id)
        self.assertEqual(list(kyochon.categories.values_list("keyword", flat=True)), ["치킨"])
        # 같은 가게의 "간장치킨"·"간장 치킨"은 메뉴 하나, 다른 가게의 같은 이름은 따로
        self.assertEqual(list(Menu.objects.filter(restaurant=kyochon).values_list("name", flat=True)), ["간장치킨"])
        self.assertEqual(Menu.objects.count(), 2)
        reviews = list(Review.objects.filter(restaurant=kyochon).order_by("id").values_list("menu__name", flat=True))
        self.assertEqual(reviews, ["간장치킨", "간장치킨", None])

        old = self.migrate(BEFORE)
        Review = old.get_model("restaurant", "RestaurantReview")
        Restaurant = old.get_model("restaurant", "Restaurant")
        self.assertEqual(Restaurant.objects.get(name="교촌").category_id, chicken.id)
        self.assertEqual(sorted(Review.objects.values_list("menu", flat=True)), ["", "간장치킨", "간장치킨", "간장치킨"])


def executor_leaf():
    executor = MigrationExecutor(connection)
    return executor.loader.graph.leaf_nodes()
