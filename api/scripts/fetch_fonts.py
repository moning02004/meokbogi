"""먹골목 팜플렛 PDF에 쓰는 글꼴을 받아 apps/guide/fonts/ 에 둔다.

글꼴 파일(합쳐서 13MB쯤)은 저장소에 넣지 않고 이미지 빌드 때 받는다. 한글 글꼴이 없으면 PDF의 글자가
네모로 나오므로, 받지 못하거나 내용이 다르면 실패로 끝나 빌드를 멈춘다.
Django 설정 없이 돌도록 표준 라이브러리만 쓴다:  python scripts/fetch_fonts.py
"""
import hashlib
import sys
import urllib.request
from pathlib import Path

FONT_DIR = Path(__file__).resolve().parent.parent / "apps" / "guide" / "fonts"

# 둘 다 SIL Open Font License. 버전·커밋을 고정하고 sha256으로 확인한다.
PRETENDARD = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static"
GOWUN_BATANG = "https://raw.githubusercontent.com/google/fonts/539f6c4bb51e9b328dd5826bcbf2fd9b1ce56e19/ofl/gowunbatang"
FONTS = [
    ("Pretendard-Regular.otf", PRETENDARD, "3ffbacde6ab8411f1d2db54bb9b1f0b3ee2a738932033722cf0388c06aed1c93"),
    ("Pretendard-SemiBold.otf", PRETENDARD, "c89bc43027dc7cde5726e96223376f8eec09302b2fc1f8147fd5b57cfc376118"),
    ("Pretendard-ExtraBold.otf", PRETENDARD, "c35fe941b7568d52a96010561540e47f9d3948dfde66ba25bc1908233e0a40cd"),
    ("GowunBatang-Bold.ttf", GOWUN_BATANG, "dbfcaa646e5831e7478524924f02906f550285a5050699b4e38c9950b3ec4b94"),
]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    for name, base, expected in FONTS:
        path = FONT_DIR / name
        if path.exists() and sha256(path) == expected:
            continue
        print(f"받는 중: {name}")
        with urllib.request.urlopen(f"{base}/{name}", timeout=60) as response:
            path.write_bytes(response.read())
        if sha256(path) != expected:
            path.unlink()
            sys.exit(f"{name}: 받은 파일이 기대한 내용과 달라요.")
    print(f"글꼴 {len(FONTS)}개 준비됨: {FONT_DIR}")


if __name__ == "__main__":
    main()
