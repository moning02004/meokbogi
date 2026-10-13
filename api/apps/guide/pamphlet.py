"""골목을 A4 팜플렛 PDF로 만든다. 모양은 골목마다 고른다 (Guide.pamphlet_layout).

- menu(차림표, 기본): 가로. 왼쪽에 골목 정보, 오른쪽에 집을 한 줄씩. 한 장에 여섯 집
- booklet(세로 책자): 세로. 첫 장은 표지만, 둘째 장부터 2×2로 네 집씩
- list(한 장 목록): 세로 한 장에 모두. 한마디 없이 이름·주소·대표 메뉴·횟수만
- receipt(영수증): 가로. 왼쪽에 골목 정보, 오른쪽에 영수증 두 장, 한 장에 세 집씩

집이 넘치면 같은 모양으로 다음 장에 이어 적는다. 공개 중인 골목은 표지에 공개 주소의 QR을 넣는다.
내용은 공개 화면과 같은 public_guide를 써서 리뷰 글·만족도·장소 이름이 들어가지 않고, 주소·주문 횟수는 골목 설정을 따른다.
WeasyPrint는 pango 같은 시스템 라이브러리가 있어야 불러올 수 있어서 만들 때 불러온다
(라이브러리가 없는 개발 환경에서도 나머지 API는 그대로 돈다).
"""
from pathlib import Path

import segno
from django.template.loader import render_to_string

from apps.guide.models import MAX_ENTRIES
from apps.guide.serializers import public_guide

# scripts/fetch_fonts.py 가 채운다
FONT_DIR = Path(__file__).resolve().parent / "fonts"

# 모양마다 한 장에 싣는 집 수. list는 골목 한도(15곳)를 한 장에 다 싣는다.
PER_PAGE = {"menu": 6, "booklet": 4, "list": MAX_ENTRIES, "receipt": 6}
# 영수증 한 장(가로 종이에 두 장이 나란히 놓인다)에 싣는 집 수
PER_RECEIPT = 3


class PamphletUnavailable(Exception):
    """이 서버에 PDF를 만드는 라이브러리가 없다."""


# 낱말 붙임표(U+2060): 보이지 않고, 그 자리에서 줄이 바뀌지 않게 한다
WORD_JOINER = "\u2060"
# 이보다 긴 낱말은 그대로 둔다 (단 폭보다 길면 중간에서 끊겨야 한다)
KEEP_TOGETHER_UP_TO = 12


def keep_words(text):
    """한글이 "비웁니/다."처럼 낱말 중간에서 줄이 바뀌지 않게 낱말 안 글자를 붙여 둔다.

    WeasyPrint가 CSS word-break: keep-all을 지원하지 않아서 글자 사이에 붙임표를 넣는다. 띄어쓰기와 줄바꿈은 그대로다.
    """
    def join(word):
        return WORD_JOINER.join(word) if len(word) <= KEEP_TOGETHER_UP_TO else word
    return "\n".join(" ".join(join(word) for word in line.split(" ")) for line in text.split("\n"))


def share_qr(share_url):
    """공개 주소의 QR을 <img src>에 바로 넣을 수 있는 SVG로 만든다. 주소가 없으면 빈 값."""
    if not share_url:
        return ""
    return segno.make(share_url, error="m").svg_data_uri(border=0, dark="#1B1E17")


def pamphlet_context(guide, share_url=""):
    data = public_guide(guide)
    entries = [{
        **entry,
        "number": f"{index:02d}",
        "comment": keep_words(entry["comment"]),
        "category": " · ".join(entry["categories"]),
        "menu": " · ".join(entry["menus"]),
        # 한 장 목록에는 가장 많이 먹은 메뉴 하나만
        "top_menu": entry["menus"][0] if entry["menus"] else "",
        "first_ordered": (entry.get("first_ordered_month") or "").replace("-", "."),
    } for index, entry in enumerate(data["entries"], start=1)]

    per_page = PER_PAGE[guide.pamphlet_layout]
    # 집이 없어도 한 장은 나온다
    pages = [entries[start:start + per_page] for start in range(0, len(entries), per_page)] or [[]]
    if guide.pamphlet_layout == "receipt":
        # 한 장을 영수증 두 장으로 나눈다 (세 집이 안 넘으면 한 장만)
        pages = [[{"entries": page[start:start + PER_RECEIPT], "is_last": False}
                  for start in range(0, max(len(page), 1), PER_RECEIPT)] for page in pages]
        # 합계는 마지막 영수증 아래에 적는다
        pages[-1][-1]["is_last"] = True

    return {
        "guide": {**data, "title": keep_words(data["title"]), "intro": keep_words(data["intro"])},
        "show_visits": guide.show_visits,
        # 템플릿에서 숟가락을 등급만큼 그리려고 넘긴다
        "spoons": range(guide.grade),
        "font_dir": FONT_DIR.as_uri(),
        "qr": share_qr(share_url),
        "pages": pages,
        "entry_count": len(entries),
        # 영수증의 합계
        "visit_total": sum(entry.get("visit_count") or 0 for entry in entries),
    }


def render_pamphlet(guide, share_url=""):
    try:
        from weasyprint import HTML
        from weasyprint.text.fonts import FontConfiguration
    except (ImportError, OSError) as error:
        raise PamphletUnavailable(str(error)) from error

    html = render_to_string(f"guide/pamphlet_{guide.pamphlet_layout}.html", pamphlet_context(guide, share_url))
    return HTML(string=html).write_pdf(font_config=FontConfiguration())
