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


class CategoryPerUserMigrationTestCase(TransactionTestCase):
    """장소마다 따로 있던 카테고리를 사용자 하나로 합치는 마이그레이션 (zone 0004~0006)."""

    BEFORE = [("zone", "0003_remove_zone_hash_id"), ("restaurant", "0013_branch")]
    AFTER = [("zone", "0006_category_user_cleanup")]

    def migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    def tearDown(self):
        self.migrate(executor_leaf())

    def test_merge_and_split_back(self):
        old = self.migrate(self.BEFORE)
        User = old.get_model("auth", "User")
        Zone = old.get_model("zone", "Zone")
        Category = old.get_model("zone", "Category")
        Restaurant = old.get_model("restaurant", "Restaurant")

        owner = User.objects.create(username="owner")
        other = User.objects.create(username="other")
        home = Zone.objects.create(user=owner, name="우리집")
        office = Zone.objects.create(user=owner, name="회사")
        others_zone = Zone.objects.create(user=other, name="남의 집")
        home_chicken = Category.objects.create(zone=home, keyword="치킨")
        office_chicken = Category.objects.create(zone=office, keyword="치 킨")  # 띄어쓰기만 다름
        office_korean = Category.objects.create(zone=office, keyword="한식")
        Category.objects.create(zone=others_zone, keyword="치킨")  # 다른 사용자 것은 따로

        kyochon = Restaurant.objects.create(zone=home, name="교촌")
        kyochon.categories.add(home_chicken)
        bbq = Restaurant.objects.create(zone=office, name="BBQ")
        bbq.categories.add(office_chicken, office_korean)

        new = self.migrate(self.AFTER)
        Category = new.get_model("zone", "Category")
        Restaurant = new.get_model("restaurant", "Restaurant")

        mine = list(Category.objects.filter(user__username="owner").order_by("id").values_list("keyword", flat=True))
        self.assertEqual(mine, ["치킨", "한식"])  # 먼저 만든 표기가 남는다
        self.assertEqual(Category.objects.filter(user__username="other").count(), 1)
        chicken = Category.objects.get(user__username="owner", keyword="치킨")
        self.assertEqual(sorted(chicken.restaurants.values_list("name", flat=True)), ["BBQ", "교촌"])
        self.assertEqual(sorted(Restaurant.objects.get(name="BBQ").categories.values_list("keyword", flat=True)),
                         ["치킨", "한식"])

        # 되돌리면 음식점이 있는 장소마다 카테고리가 다시 생긴다
        old = self.migrate(self.BEFORE)
        Category = old.get_model("zone", "Category")
        Restaurant = old.get_model("restaurant", "Restaurant")
        home_tags = list(Restaurant.objects.get(name="교촌").categories.values_list("zone__name", "keyword"))
        office_tags = sorted(Restaurant.objects.get(name="BBQ").categories.values_list("zone__name", "keyword"))
        self.assertEqual(home_tags, [("우리집", "치킨")])
        self.assertEqual(office_tags, [("회사", "치킨"), ("회사", "한식")])
