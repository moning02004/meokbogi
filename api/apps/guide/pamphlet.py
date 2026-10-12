"""골목을 A4 가로 3단 팜플렛 PDF로 만든다.

첫 장은 표지 한 단과 여섯 집, 다음 장부터는 아홉 집씩. 내용은 공개 화면과 같은 public_guide를 써서
리뷰 글·만족도·장소 이름이 들어가지 않고, 주소·주문 횟수는 골목 설정을 따른다.
WeasyPrint는 pango 같은 시스템 라이브러리가 있어야 불러올 수 있어서 만들 때 불러온다
(라이브러리가 없는 개발 환경에서도 나머지 API는 그대로 돈다).
"""
from pathlib import Path

from django.template.loader import render_to_string

from apps.guide.serializers import public_guide

# scripts/fetch_fonts.py 가 채운다
FONT_DIR = Path(__file__).resolve().parent / "fonts"

PER_COLUMN = 3
FIRST_PAGE = PER_COLUMN * 2   # 표지가 한 단을 쓴다
OTHER_PAGE = PER_COLUMN * 3


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


def columns(entries, count):
    """집 목록을 한 단에 PER_COLUMN곳씩 count단으로 나눈다. 모자란 단은 비워서 단 폭을 지킨다."""
    return [entries[index * PER_COLUMN:(index + 1) * PER_COLUMN] for index in range(count)]


def pamphlet_context(guide, today):
    data = public_guide(guide)
    entries = [{
        **entry,
        "comment": keep_words(entry["comment"]),
        "category": " · ".join(entry["categories"]),
        "menu": " · ".join(entry["menus"]),
        "first_ordered": (entry.get("first_ordered_month") or "").replace("-", "."),
    } for entry in data["entries"]]

    rest = entries[FIRST_PAGE:]
    return {
        "guide": {**data, "intro": keep_words(data["intro"])},
        "show_visits": guide.show_visits,
        "today": today.strftime("%Y.%m.%d"),
        "font_dir": FONT_DIR.as_uri(),
        "first_columns": columns(entries[:FIRST_PAGE], 2),
        "other_pages": [columns(rest[start:start + OTHER_PAGE], 3) for start in range(0, len(rest), OTHER_PAGE)],
    }


def render_pamphlet(guide, today):
    try:
        from weasyprint import HTML
        from weasyprint.text.fonts import FontConfiguration
    except (ImportError, OSError) as error:
        raise PamphletUnavailable(str(error)) from error

    html = render_to_string("guide/pamphlet.html", pamphlet_context(guide, today))
    return HTML(string=html).write_pdf(font_config=FontConfiguration())
