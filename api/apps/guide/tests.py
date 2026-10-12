import json
from datetime import date
from unittest import mock, skipUnless

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.urls import reverse

from apps.guide.models import MAX_ENTRIES, Guide
from apps.guide.pamphlet import PamphletUnavailable, pamphlet_context
from apps.restaurant.branch_merge import find_candidates, merge
from apps.restaurant.models import Branch
from apps.restaurant.testing import make_category, make_restaurant, make_review
from apps.zone.models import Zone


def can_render_pdf():
    # WeasyPrint는 pango가 없으면 불러오는 데서 실패한다. 그런 환경에서는 실제 PDF 검사만 건너뛴다.
    try:
        import weasyprint  # noqa: F401
    except (ImportError, OSError):
        return False
    return True


class GuideTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="me", password="123")
        self.zone = Zone.objects.create(user=self.user, name="우리집")
        self.category = make_category(self.zone, "칼국수")
        self.noodle = make_restaurant(self.category, name="진미손칼국수", description="바지락 많음",
                                      address="을지로 12")
        make_review(restaurant=self.noodle, user=self.user, menu="바지락칼국수", ordered_at=date(2025, 3, 2),
                    point=1, content="나만 보는 메모")
        make_review(restaurant=self.noodle, user=self.user, menu="손만두", ordered_at=date(2025, 3, 2), point=1)
        make_review(restaurant=self.noodle, user=self.user, menu="바지락칼국수", ordered_at=date(2024, 11, 20), point=0)
        self.gimbap = make_restaurant(self.category, name="산들김밥")
        self.client.login(username="me", password="123")

    def create_guide(self, **fields):
        response = self.client.post(reverse("guides"), data={"title": "을지로 점심 골목", **fields},
                                    content_type="application/json")
        self.assertEqual(response.status_code, 201)
        return response.json()["id"]

    def put_entries(self, guide_id, entries, client=None):
        return (client or self.client).put(reverse("guide-entries", kwargs={"guide_pk": guide_id}),
                                           data={"entries": entries}, content_type="application/json")

    def test_create_and_list(self):
        guide_id = self.create_guide(intro="먹어본 집만", edition="2026 가을")
        guides = self.client.get(reverse("guides")).json()
        self.assertEqual([(g["id"], g["title"], g["entry_count"], g["share_token"]) for g in guides],
                         [(guide_id, "을지로 점심 골목", 0, None)])

    def test_entries_keep_order_and_count_visits(self):
        guide_id = self.create_guide()
        response = self.put_entries(guide_id, [
            {"restaurant": self.gimbap.id},
            {"restaurant": self.noodle.id, "comment": " 바지락이 넉넉해요 ", "menus": ["손만두", "바지락 칼국수"]},
        ])
        self.assertEqual(response.status_code, 200)
        entries = response.json()["entries"]
        self.assertEqual([entry["restaurant"]["name"] for entry in entries], ["산들김밥", "진미손칼국수"])
        noodle = entries[1]
        # 같은 날 메뉴 두 개는 한 번, 메뉴는 많이 먹은 순, 띄어쓰기만 다른 이름은 같은 메뉴
        self.assertEqual((noodle["visit_count"], noodle["comment"]), (2, "바지락이 넉넉해요"))
        self.assertEqual(noodle["menus"], ["바지락칼국수", "손만두"])
        self.assertEqual(noodle["restaurant"]["menus"][0], {"menu": "바지락칼국수", "review_count": 2})

        # 다시 저장하면 통째로 바뀐다
        response = self.put_entries(guide_id, [{"restaurant": self.noodle.id}])
        self.assertEqual(len(response.json()["entries"]), 1)
        self.assertEqual(self.client.get(reverse("guides")).json()[0]["entry_count"], 1)

    def test_entries_reject_bad_input(self):
        guide_id = self.create_guide()
        other = User.objects.create_user(username="other", password="123")
        theirs = make_restaurant(make_category(Zone.objects.create(user=other, name="남의집"), "치킨"), name="남의치킨")
        foreign_branch = Branch.objects.create(restaurant=self.gimbap, name="역삼점", name_key="역삼점")

        for entries in (
            [{"restaurant": theirs.id}],
            [{"restaurant": self.noodle.id}, {"restaurant": self.noodle.id}],
            [{"restaurant": self.noodle.id, "menus": ["없는메뉴"]}],
            [{"restaurant": self.noodle.id, "menus": ["a", "b", "c", "d"]}],
            [{"restaurant": self.noodle.id, "branch": foreign_branch.id}],
            [{"restaurant": self.noodle.id}] * (MAX_ENTRIES + 1),
        ):
            self.assertEqual(self.put_entries(guide_id, entries).status_code, 400, entries)
        # 실패한 저장은 아무것도 남기지 않는다
        self.put_entries(guide_id, [{"restaurant": self.gimbap.id}])
        self.put_entries(guide_id, [{"restaurant": self.noodle.id}, {"restaurant": theirs.id}])
        detail = self.client.get(reverse("guide-detail", kwargs={"guide_pk": guide_id})).json()
        self.assertEqual([entry["restaurant"]["name"] for entry in detail["entries"]], ["산들김밥"])

    def test_entry_address_is_saved_on_the_restaurant(self):
        guide_id = self.create_guide()
        response = self.put_entries(guide_id, [{"restaurant": self.gimbap.id, "address": " 을지로 3 "},
                                               {"restaurant": self.noodle.id}])
        self.assertEqual([e["restaurant"]["address"] for e in response.json()["entries"]], ["을지로 3", "을지로 12"])
        # 음식점 자체에 저장되어 상세에서도 보인다. 주소를 안 보낸 집은 그대로다.
        detail = self.client.get(reverse("restaurant-info", kwargs={"restaurant_pk": self.gimbap.id})).json()
        self.assertEqual(detail["address"], "을지로 3")

        # 빈 값을 보내면 지운다
        self.put_entries(guide_id, [{"restaurant": self.gimbap.id, "address": ""}])
        self.gimbap.refresh_from_db()
        self.assertEqual(self.gimbap.address, "")

        # 검증에서 걸린 저장은 주소도 바꾸지 않는다
        self.put_entries(guide_id, [{"restaurant": self.gimbap.id, "address": "바뀌면 안 됨", "menus": ["없는메뉴"]}])
        self.gimbap.refresh_from_db()
        self.assertEqual(self.gimbap.address, "")

    def test_my_restaurants_across_zones(self):
        office = Zone.objects.create(user=self.user, name="회사")
        make_restaurant(self.category, zone=office, name="회사앞국수")
        other = User.objects.create_user(username="other", password="123")
        make_restaurant(make_category(Zone.objects.create(user=other, name="남의집"), "치킨"), name="남의치킨")

        # 고르기 시트는 장소를 가리지 않고 많이 간 순으로 보여준다
        response = self.client.get(reverse("my-restaurants"), {"sort": "visits"})
        self.assertEqual([(r["name"], r["zone"], r["ordered_count"]) for r in response.json()["results"]],
                         [("진미손칼국수", "우리집", 2), ("회사앞국수", "회사", 0), ("산들김밥", "우리집", 0)])
        # 좋음 이상만: 평균이 0.2보다 높은 곳. 리뷰가 없는 곳은 빠진다 (칼국수는 만족 2 + 보통 1)
        response = self.client.get(reverse("my-restaurants"), {"rating": "good"})
        self.assertEqual([r["name"] for r in response.json()["results"]], ["진미손칼국수"])
        make_review(restaurant=self.noodle, user=self.user, menu="손만두", ordered_at=date(2026, 1, 1), point=-1)
        make_review(restaurant=self.noodle, user=self.user, menu="손만두", ordered_at=date(2026, 1, 2), point=-1)
        self.assertEqual(self.client.get(reverse("my-restaurants"), {"rating": "good"}).json()["count"], 0)

        response = self.client.get(reverse("my-restaurants"), {"search": "국수"})
        self.assertEqual({r["name"] for r in response.json()["results"]}, {"진미손칼국수", "회사앞국수"})

    def test_others_cannot_touch_my_guide(self):
        guide_id = self.create_guide()
        User.objects.create_user(username="other", password="123")
        other = Client()
        other.login(username="other", password="123")

        self.assertEqual(other.get(reverse("guides")).json(), [])
        detail = reverse("guide-detail", kwargs={"guide_pk": guide_id})
        share = reverse("guide-share", kwargs={"guide_pk": guide_id})
        self.assertEqual(other.get(detail).status_code, 404)
        self.assertEqual(other.patch(detail, data={"title": "x"}, content_type="application/json").status_code, 404)
        self.assertEqual(other.delete(detail).status_code, 404)
        self.assertEqual(self.put_entries(guide_id, [], client=other).status_code, 404)
        self.assertEqual(other.post(share).status_code, 404)
        self.assertIsNone(Guide.objects.get(pk=guide_id).share_token)

    def test_grade_is_spoons_from_zero_to_three(self):
        guide_id = self.create_guide(grade=2)
        detail = reverse("guide-detail", kwargs={"guide_pk": guide_id})
        self.assertEqual(self.client.get(detail).json()["grade"], 2)
        self.assertEqual(self.client.patch(detail, data={"grade": 4}, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.patch(detail, data={"grade": 3}, content_type="application/json").json()["grade"], 3)

        # 공개 화면과 팜플렛에는 숟가락 수와 그 뜻이 함께 나간다
        token = self.client.post(reverse("guide-share", kwargs={"guide_pk": guide_id})).json()["share_token"]
        public = Client().get(reverse("public-guide", kwargs={"token": token})).json()
        self.assertEqual((public["grade"], public["grade_label"]), (3, "이 골목 때문에 그 동네에 갈 만한 골목"))
        context = pamphlet_context(Guide.objects.get(pk=guide_id))
        self.assertEqual((len(context["spoons"]), context["guide"]["grade_label"]), (3, public["grade_label"]))

        # 등급을 안 주면 0 (등급 없음)
        self.assertEqual(self.client.get(reverse("guide-detail", kwargs={"guide_pk": self.create_guide()})).json()["grade"], 0)

    def test_patch_keeps_entry_order(self):
        guide_id = self.create_guide()
        self.put_entries(guide_id, [{"restaurant": self.noodle.id}, {"restaurant": self.gimbap.id}])
        response = self.client.patch(reverse("guide-detail", kwargs={"guide_pk": guide_id}),
                                     data={"title": "새 제목", "show_address": False}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual((body["title"], body["show_address"]), ("새 제목", False))
        self.assertEqual([entry["restaurant"]["name"] for entry in body["entries"]], ["진미손칼국수", "산들김밥"])

    def test_public_page_shows_only_what_the_guide_says(self):
        guide_id = self.create_guide(intro="먹어본 집만")
        self.put_entries(guide_id, [{"restaurant": self.noodle.id, "comment": "바지락이 넉넉해요", "menus": ["손만두"]}])
        share = reverse("guide-share", kwargs={"guide_pk": guide_id})
        anonymous = Client()

        # 공개 전에는 어떤 주소로도 열리지 않는다
        self.assertEqual(anonymous.get(reverse("public-guide", kwargs={"token": "nope"})).status_code, 404)

        token = self.client.post(share).json()["share_token"]
        self.assertTrue(token)
        # 다시 눌러도 주소는 그대로
        self.assertEqual(self.client.post(share).json()["share_token"], token)

        response = anonymous.get(reverse("public-guide", kwargs={"token": token}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "title": "을지로 점심 골목", "intro": "먹어본 집만", "edition": "", "grade": 0, "grade_label": "",
            "entries": [{
                "name": "진미손칼국수", "categories": ["칼국수"], "branch": "", "comment": "바지락이 넉넉해요",
                "menus": ["손만두"], "address": "을지로 12", "visit_count": 2, "first_ordered_month": "2024-11",
            }],
        })
        # 리뷰 글과 장소 이름은 어디에도 없다
        self.assertNotIn("나만 보는 메모", response.content.decode())
        self.assertNotIn("우리집", response.content.decode())

        # 주소·주문 횟수를 끄면 값 자체가 나가지 않는다
        self.client.patch(reverse("guide-detail", kwargs={"guide_pk": guide_id}),
                          data={"show_address": False, "show_visits": False}, content_type="application/json")
        entry = anonymous.get(reverse("public-guide", kwargs={"token": token})).json()["entries"][0]
        self.assertEqual(sorted(entry), ["branch", "categories", "comment", "menus", "name"])

        # 공개를 끄면 바로 닫히고, 다시 켜면 새 주소
        self.assertIsNone(self.client.delete(share).json()["share_token"])
        self.assertEqual(anonymous.get(reverse("public-guide", kwargs={"token": token})).status_code, 404)
        self.assertNotEqual(self.client.post(share).json()["share_token"], token)

    def test_public_page_ignores_stale_login(self):
        guide_id = self.create_guide()
        token = self.client.post(reverse("guide-share", kwargs={"guide_pk": guide_id})).json()["share_token"]
        response = Client().get(reverse("public-guide", kwargs={"token": token}),
                                headers={"Authorization": "Bearer expired-or-garbage"})
        self.assertEqual(response.status_code, 200)

    def test_branch_narrows_visit_count(self):
        yeoksam = Branch.objects.create(restaurant=self.noodle, name="역삼점", name_key="역삼점")
        make_review(restaurant=self.noodle, user=self.user, menu="손만두", ordered_at=date(2026, 1, 5), point=1,
                    branch=yeoksam)
        guide_id = self.create_guide()
        entries = self.put_entries(guide_id, [{"restaurant": self.noodle.id, "branch": yeoksam.id}]).json()["entries"]
        self.assertEqual((entries[0]["branch"], entries[0]["visit_count"]), (yeoksam.id, 1))

        token = self.client.post(reverse("guide-share", kwargs={"guide_pk": guide_id})).json()["share_token"]
        entry = Client().get(reverse("public-guide", kwargs={"token": token})).json()["entries"][0]
        self.assertEqual((entry["branch"], entry["visit_count"], entry["first_ordered_month"]), ("역삼점", 1, "2026-01"))

    def test_deleting_restaurant_removes_it_from_guides(self):
        guide_id = self.create_guide()
        self.put_entries(guide_id, [{"restaurant": self.noodle.id}, {"restaurant": self.gimbap.id}])
        self.client.delete(reverse("restaurant-info", kwargs={"restaurant_pk": self.noodle.id}))
        detail = self.client.get(reverse("guide-detail", kwargs={"guide_pk": guide_id})).json()
        self.assertEqual([entry["restaurant"]["name"] for entry in detail["entries"]], ["산들김밥"])

    def test_archive_round_trip(self):
        guide_id = self.create_guide(intro="먹어본 집만", edition="2026 가을", show_address=False, grade=2)
        self.put_entries(guide_id, [{"restaurant": self.gimbap.id},
                                    {"restaurant": self.noodle.id, "comment": "넉넉해요", "menus": ["손만두"]}])
        self.client.post(reverse("guide-share", kwargs={"guide_pk": guide_id}))
        exported = self.client.get(reverse("archive-export")).content

        # 공개 주소는 파일에 없다
        self.assertNotIn("share_token", json.loads(exported)["guides"][0])

        User.objects.create_user(username="newbie", password="123")
        newbie = Client()
        newbie.login(username="newbie", password="123")

        def load():
            return newbie.post(reverse("archive-import"), {"file": SimpleUploadedFile("a.json", exported)}).json()

        self.assertEqual((load()["guides_created"], load()["guides_skipped"]), (1, 1))
        guide = newbie.get(reverse("guides")).json()[0]
        self.assertEqual((guide["title"], guide["edition"], guide["show_address"], guide["share_token"], guide["grade"]),
                         ("을지로 점심 골목", "2026 가을", False, None, 2))
        entries = newbie.get(reverse("guide-detail", kwargs={"guide_pk": guide["id"]})).json()["entries"]
        self.assertEqual([(e["restaurant"]["name"], e["comment"], e["menus"]) for e in entries],
                         [("산들김밥", "", []), ("진미손칼국수", "넉넉해요", ["손만두"])])

    def test_branch_merge_moves_entry_to_brand(self):
        brand = make_restaurant(self.category, name="교촌치킨")
        source = make_restaurant(self.category, name="교촌치킨 역삼점")
        make_review(restaurant=source, user=self.user, menu="허니콤보", ordered_at=date(2026, 2, 1), point=1)
        guide_id = self.create_guide()
        self.put_entries(guide_id, [{"restaurant": source.id, "comment": "바삭해요", "menus": ["허니콤보"]}])

        merge(find_candidates()[0])

        entry = self.client.get(reverse("guide-detail", kwargs={"guide_pk": guide_id})).json()["entries"][0]
        self.assertEqual((entry["restaurant"]["id"], entry["comment"], entry["menus"], entry["visit_count"]),
                         (brand.id, "바삭해요", ["허니콤보"], 1))
        self.assertEqual(entry["branch"], Branch.objects.get(restaurant=brand, name="역삼점").id)

    # ---- 팜플렛 PDF

    def test_pamphlet_layout_and_contents(self):
        guide_id = self.create_guide(intro="먹어본 집만")
        extras = [make_restaurant(self.category, name=f"집{index}") for index in range(MAX_ENTRIES - 1)]
        self.put_entries(guide_id, [{"restaurant": self.noodle.id, "comment": "넉넉해요", "menus": ["손만두"]}]
                         + [{"restaurant": restaurant.id} for restaurant in extras])
        guide = Guide.objects.prefetch_related("entries").get(pk=guide_id)

        context = pamphlet_context(guide)
        # 한 장에 여섯 집, 넘치면 같은 줄 모양으로 다음 장에 이어진다. 번호는 장을 넘어 이어진다.
        self.assertEqual([len(page) for page in context["pages"]], [6, 6, 3])
        self.assertEqual((context["pages"][0][0]["number"], context["pages"][2][2]["number"]), ("01", "15"))
        # 공개 주소를 주지 않으면 QR이 없다
        self.assertEqual(context["qr"], "")
        first = context["pages"][0][0]
        self.assertEqual((first["name"], first["visit_count"], first["first_ordered"], first["menu"], first["address"]),
                         ("진미손칼국수", 2, "2024.11", "손만두", "을지로 12"))
        # 한마디는 낱말 중간에서 줄이 바뀌지 않게 글자 사이에 붙임표가 들어간다 (띄어쓰기는 그대로)
        self.assertEqual(first["comment"].replace("\u2060", ""), "넉넉해요")
        self.assertEqual(context["guide"]["intro"].replace("\u2060", ""), "먹어본 집만")
        self.assertEqual(context["guide"]["intro"].count(" "), 1)
        self.assertNotIn("나만 보는 메모", str(context))
        self.assertNotIn("우리집", str(context))

        # 집이 없어도 표지 한 장은 나온다
        self.put_entries(guide_id, [])
        self.assertEqual(pamphlet_context(Guide.objects.get(pk=guide_id))["pages"], [[]])

        # 공개 주소를 주면 표지에 넣을 QR 그림이 생긴다
        qr = pamphlet_context(Guide.objects.get(pk=guide_id), "https://example.com/g/token")["qr"]
        self.assertTrue(qr.startswith("data:image/svg+xml"))

    def test_pamphlet_follows_display_settings(self):
        guide_id = self.create_guide(show_address=False, show_visits=False)
        self.put_entries(guide_id, [{"restaurant": self.noodle.id}])
        context = pamphlet_context(Guide.objects.get(pk=guide_id))
        entry = context["pages"][0][0]
        self.assertEqual((entry.get("address"), entry.get("visit_count"), entry["first_ordered"]), (None, None, ""))
        self.assertFalse(context["show_visits"])

    @skipUnless(can_render_pdf(), "WeasyPrint를 불러올 수 없는 환경 (pango 없음)")
    def test_pamphlet_pdf_download(self):
        guide_id = self.create_guide(intro="먹어본 집만")
        self.put_entries(guide_id, [{"restaurant": self.noodle.id, "comment": "넉넉해요"}])
        # 공개하지 않은 골목도 주인은 받는다
        response = self.client.get(reverse("guide-pdf", kwargs={"guide_pk": guide_id}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn("filename*=utf-8''", response["Content-Disposition"])

    def test_pamphlet_qr_points_to_public_page(self):
        guide_id = self.create_guide()
        url = reverse("guide-pdf", kwargs={"guide_pk": guide_id})

        def share_url_for(**headers):
            with mock.patch("apps.guide.views.render_pamphlet", return_value=b"%PDF") as render:
                self.client.get(url, headers=headers)
            return render.call_args.args[1]

        # 공개하지 않은 골목에는 QR에 넣을 주소가 없다
        self.assertEqual(share_url_for(Origin="http://localhost:3000"), "")
        token = self.client.post(reverse("guide-share", kwargs={"guide_pk": guide_id})).json()["share_token"]
        with self.settings(CORS_ALLOWED_ORIGINS=["http://localhost:3000"]):
            # 요청을 보낸 웹 앱의 주소로 공개 화면 주소를 만든다. 허용되지 않은 주소는 쓰지 않는다.
            self.assertEqual(share_url_for(Origin="http://localhost:3000"), f"http://localhost:3000/g/{token}")
            self.assertEqual(share_url_for(Origin="http://evil.example"), "")
            # 서버에 웹 주소가 설정돼 있으면 그쪽이 우선
            with mock.patch.dict("os.environ", {"PUBLIC_WEB_ORIGIN": "https://meokbogi.example.com/"}):
                self.assertEqual(share_url_for(Origin="http://localhost:3000"), f"https://meokbogi.example.com/g/{token}")

    def test_pamphlet_pdf_is_owner_only(self):
        guide_id = self.create_guide()
        url = reverse("guide-pdf", kwargs={"guide_pk": guide_id})
        self.assertIn(Client().get(url).status_code, (401, 403))
        User.objects.create_user(username="other", password="123")
        other = Client()
        other.login(username="other", password="123")
        self.assertEqual(other.get(url).status_code, 404)

    def test_pamphlet_pdf_without_renderer(self):
        guide_id = self.create_guide()
        with mock.patch("apps.guide.views.render_pamphlet", side_effect=PamphletUnavailable("no pango")):
            response = self.client.get(reverse("guide-pdf", kwargs={"guide_pk": guide_id}))
        self.assertEqual(response.status_code, 503)
        self.assertIn("PDF", response.json()["detail"])
