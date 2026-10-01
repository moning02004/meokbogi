from django.core.management.base import BaseCommand

from apps.restaurant.branch_merge import find_candidates, merge


class Command(BaseCommand):
    help = ('"교촌치킨 역삼점"처럼 지점을 이름에 넣어 따로 등록한 음식점을 "교촌치킨"의 "역삼점" 지점으로 옮긴다. '
            '기본은 미리보기만 한다.')

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="실제로 옮긴다 (없으면 후보만 보여준다)")
        parser.add_argument("--only", action="append", default=[], metavar="음식점 이름",
                            help="이 이름의 후보만 옮긴다. 여러 번 줄 수 있다")

    def handle(self, *args, apply=False, only=(), **options):
        candidates = find_candidates()
        if only:
            candidates = [c for c in candidates if c.source.name in set(only)]

        if not candidates:
            self.stdout.write("옮길 후보가 없어요.")
            return

        for candidate in candidates:
            self.stdout.write(("옮김  " if apply else "후보  ") + candidate.describe())
            if apply:
                merge(candidate)

        if apply:
            self.stdout.write(self.style.SUCCESS(f"{len(candidates)}곳을 지점으로 옮겼어요."))
        else:
            self.stdout.write(f"\n{len(candidates)}곳. 옮기려면 --apply 를 붙이세요 (일부만: --only \"음식점 이름\").")
