"""골목을 A4 가로 팜플렛 PDF로 만든다.

왼쪽에 골목 정보(표지), 오른쪽에 집을 한 줄씩 적는 차림표 모양이다. 한 장에 여섯 집이고, 넘치면 같은 줄 모양으로
다음 장에 이어 적는다 (다음 장의 왼쪽은 배경만 둔다). 공개 중인 골목은 표지에 공개 주소의 QR을 넣는다.
내용은 공개 화면과 같은 public_guide를 써서 리뷰 글·만족도·장소 이름이 들어가지 않고, 주소·주문 횟수는 골목 설정을 따른다.
WeasyPrint는 pango 같은 시스템 라이브러리가 있어야 불러올 수 있어서 만들 때 불러온다
(라이브러리가 없는 개발 환경에서도 나머지 API는 그대로 돈다).
"""
from pathlib import Path

import segno
from django.template.loader import render_to_string

from apps.guide.serializers import public_guide

# scripts/fetch_fonts.py 가 채운다
FONT_DIR = Path(__file__).resolve().parent / "fonts"

# 한 장에 싣는 집 수
PER_PAGE = 6


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
        "first_ordered": (entry.get("first_ordered_month") or "").replace("-", "."),
    } for index, entry in enumerate(data["entries"], start=1)]

    return {
        "guide": {**data, "title": keep_words(data["title"]), "intro": keep_words(data["intro"])},
        "show_visits": guide.show_visits,
        # 템플릿에서 숟가락을 등급만큼 그리려고 넘긴다
        "spoons": range(guide.grade),
        "font_dir": FONT_DIR.as_uri(),
        "qr": share_qr(share_url),
        # 집이 없어도 표지 한 장은 나온다
        "pages": [entries[start:start + PER_PAGE] for start in range(0, len(entries), PER_PAGE)] or [[]],
    }


def render_pamphlet(guide, share_url=""):
    try:
        from weasyprint import HTML
        from weasyprint.text.fonts import FontConfiguration
    except (ImportError, OSError) as error:
        raise PamphletUnavailable(str(error)) from error

    html = render_to_string("guide/pamphlet.html", pamphlet_context(guide, share_url))
    return HTML(string=html).write_pdf(font_config=FontConfiguration())
