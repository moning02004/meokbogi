import secrets

from django.contrib.auth.models import User
from django.db import models

from apps.restaurant.models import Branch, Menu, Restaurant

# 한 골목에 실을 수 있는 집 수. "고른 목록"이라는 뜻이 살고 팜플렛이 두 장을 넘지 않는다.
MAX_ENTRIES = 15
# 한 집에 권하는 메뉴 수
MAX_MENUS = 3

# 골목의 추천 등급: 숟가락 0~3개. 0은 등급 없음. 숟가락이 뜻하는 말은 공개 화면과 팜플렛에 함께 적는다.
GRADE_LABELS = {
    1: "근처에 가면 들러 볼 만한 골목",
    2: "일부러 찾아갈 만한 골목",
    3: "이 골목 때문에 그 동네에 갈 만한 골목",
}

# 팜플렛 PDF의 모양. 골목마다 고른다.
PAMPHLET_LAYOUTS = [
    ("menu", "차림표"),      # A4 가로, 한 장에 여섯 줄 (기본)
    ("booklet", "세로 책자"),  # A4 세로, 첫 장은 표지, 둘째 장부터 2×2 네 칸씩
    ("list", "한 장 목록"),   # A4 세로 한 장에 모두, 한마디 없이
    ("receipt", "영수증"),    # A4 가로, 영수증 두 장에 세 집씩
]


class Guide(models.Model):
    """먹골목의 골목 하나: 먹어본 집을 골라 남에게 건네는 목록.

    share_token이 있으면 그 주소로 누구나 읽을 수 있고, 비어 있으면 나만 본다.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="guides")
    title = models.CharField(max_length=50)
    intro = models.CharField(max_length=200, default="", blank=True)
    # "2026 가을" 같은 판 이름. 비워도 된다.
    edition = models.CharField(max_length=20, default="", blank=True)
    grade = models.PositiveSmallIntegerField(default=0, choices=[(0, 0), (1, 1), (2, 2), (3, 3)])
    pamphlet_layout = models.CharField(max_length=20, default="menu", choices=PAMPHLET_LAYOUTS)
    share_token = models.CharField(max_length=43, null=True, blank=True, unique=True)
    # 공개 화면에 주소·주문 횟수를 보여줄지
    show_address = models.BooleanField(default=True)
    show_visits = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def grade_label(self):
        return GRADE_LABELS.get(self.grade, "")

    def open_share(self):
        """공개 주소를 만든다. 이미 공개 중이면 주소를 바꾸지 않는다."""
        if not self.share_token:
            self.share_token = secrets.token_urlsafe(16)
            self.save(update_fields=["share_token", "updated_at"])

    def close_share(self):
        """공개를 끈다. 다시 켜면 새 주소가 나와서 예전 링크는 되살아나지 않는다."""
        if self.share_token:
            self.share_token = None
            self.save(update_fields=["share_token", "updated_at"])


class GuideEntry(models.Model):
    """골목에 실린 집 하나. 리뷰 글은 나만 보는 메모라 싣지 않고, 소개용 한마디를 따로 쓴다."""
    guide = models.ForeignKey(Guide, on_delete=models.CASCADE, related_name="entries")
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="guide_entries")
    # 지점마다 맛이 달라서 어느 지점을 권하는지 고를 수 있다. 비어 있으면 지점 구분 없음.
    branch = models.ForeignKey(Branch, null=True, blank=True, on_delete=models.SET_NULL, related_name="guide_entries")
    position = models.PositiveIntegerField(default=0)
    comment = models.CharField(max_length=100, default="", blank=True)
    menus = models.ManyToManyField(Menu, related_name="guide_entries", blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["guide", "restaurant"], name="unique_restaurant_per_guide"),
        ]
