import os

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Prefetch
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.http import content_disposition_header
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.guide.models import Guide, GuideEntry
from apps.guide.pamphlet import PamphletUnavailable, render_pamphlet
from apps.guide.serializers import EntriesWriteSerializer, GuideDetailSerializer, GuideSerializer, public_guide
from apps.restaurant.menus import normalize_menu
from apps.restaurant.models import Restaurant, RestaurantReview
from apps.zone.models import Category


def with_entries(queryset):
    """실린 집과 그 집의 카테고리·지점·리뷰까지 한 번에 읽는다 (주문 횟수·메뉴 순서를 리뷰로 센다)."""
    entries = GuideEntry.objects.order_by("position", "id").select_related("restaurant__zone", "branch").prefetch_related(
        "menus",
        "restaurant__branches",
        Prefetch("restaurant__categories", queryset=Category.objects.order_by("id")),
        Prefetch("restaurant__review_set", queryset=RestaurantReview.objects.select_related("menu")),
    )
    return queryset.prefetch_related(Prefetch("entries", queryset=entries))


def my_guide_or_404(request, guide_id):
    # 남의 골목이거나 없는 id면 404
    return get_object_or_404(with_entries(Guide.objects.filter(user_id=request.user.id)), pk=guide_id)


class GuideListAPIView(ListCreateAPIView):
    """내 골목 목록(GET)과 만들기(POST {title, intro, edition})."""
    serializer_class = GuideSerializer
    pagination_class = None

    def get_queryset(self):
        return Guide.objects.filter(user_id=self.request.user.id).annotate(entry_count=Count("entries")) \
            .order_by("-updated_at", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class GuideDetailAPIView(RetrieveUpdateDestroyAPIView):
    """골목 하나: 실린 집까지 보기(GET), 제목·소개·표시 설정 고치기(PATCH), 지우기(DELETE)."""
    serializer_class = GuideDetailSerializer

    def get_object(self):
        return my_guide_or_404(self.request, self.kwargs["guide_pk"])

    def perform_update(self, serializer):
        serializer.save()
        # 저장하면 미리 읽어 둔 실린 집 목록이 버려진다. 순서와 집계를 지키려고 다시 읽는다.
        serializer.instance = self.get_object()


@transaction.atomic
def replace_entries(guide, entries, user):
    """실린 집을 보낸 순서 그대로 통째로 바꾼다. 내 음식점, 그 음식점의 지점·메뉴만 받는다.

    address를 함께 보낸 집은 음식점의 주소도 고친다."""
    restaurants = {restaurant.id: restaurant for restaurant in Restaurant.objects.filter(
        zone__user_id=user.id, id__in=[entry["restaurant"] for entry in entries]).prefetch_related("branches", "menus")}

    created, entry_menus = [], []
    for position, data in enumerate(entries):
        restaurant = restaurants.get(data["restaurant"])
        if restaurant is None:
            raise ValidationError({"entries": "내 음식점만 실을 수 있어요."})
        if data["branch"] is not None and data["branch"] not in {branch.id for branch in restaurant.branches.all()}:
            raise ValidationError({"entries": f"'{restaurant.name}'의 지점이 아니에요."})

        by_key = {menu.name_key: menu for menu in restaurant.menus.all()}
        menus = {}
        for name in data["menus"]:
            menu = by_key.get(normalize_menu(name))
            if menu is None:
                raise ValidationError({"entries": f"'{name}'은(는) '{restaurant.name}'에서 기록한 메뉴가 아니에요."})
            menus[menu.id] = menu

        address = data.get("address")
        if address is not None and address.strip() != restaurant.address:
            restaurant.address = address.strip()
            restaurant.save(update_fields=["address"])

        entry = GuideEntry(guide=guide, restaurant=restaurant, branch_id=data["branch"],
                           position=position, comment=data["comment"].strip())
        created.append(entry)
        entry_menus.extend((entry, menu_id) for menu_id in menus)

    # 실린 집은 몇 곳 안 되므로 지우고 한꺼번에 다시 만든다
    GuideEntry.objects.filter(guide=guide).delete()
    GuideEntry.objects.bulk_create(created)
    EntryMenu = GuideEntry.menus.through
    EntryMenu.objects.bulk_create([EntryMenu(guideentry_id=entry.id, menu_id=menu_id) for entry, menu_id in entry_menus])
    # 실린 집만 바꿔도 "고친 날"이 바뀌게 한다
    guide.save(update_fields=["updated_at"])


class GuideEntriesAPIView(APIView):
    """실린 집 저장(PUT {entries: [{restaurant, branch, comment, menus}]}). 순서는 보낸 순서."""

    def put(self, request, *args, **kwargs):
        # 저장 전에는 주인인지만 본다. 실린 집은 저장한 뒤 한 번만 읽는다.
        guide = get_object_or_404(Guide, pk=self.kwargs["guide_pk"], user_id=request.user.id)
        serializer = EntriesWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        replace_entries(guide, serializer.validated_data["entries"], request.user)
        return Response(GuideDetailSerializer(my_guide_or_404(request, guide.pk)).data)


class GuideShareAPIView(APIView):
    """공개 주소 만들기(POST)와 공개 끄기(DELETE)."""

    def post(self, request, *args, **kwargs):
        guide = my_guide_or_404(request, self.kwargs["guide_pk"])
        guide.open_share()
        return Response(GuideDetailSerializer(guide).data)

    def delete(self, request, *args, **kwargs):
        guide = my_guide_or_404(request, self.kwargs["guide_pk"])
        guide.close_share()
        return Response(GuideDetailSerializer(guide).data)


def public_web_origin(request):
    """공개 화면이 열리는 웹 주소. QR에 넣으려고 쓴다.

    설정(PUBLIC_WEB_ORIGIN)이 있으면 그 값, 없으면 요청을 보낸 웹 앱의 주소(허용된 오리진일 때만). 둘 다 없으면 빈 값.
    """
    origin = os.environ.get("PUBLIC_WEB_ORIGIN", "").rstrip("/")
    if origin:
        return origin
    origin = request.headers.get("Origin", "")
    return origin if origin in settings.CORS_ALLOWED_ORIGINS else ""


class GuidePamphletAPIView(APIView):
    """골목을 A4 가로 팜플렛 PDF로 내려준다. 공개하지 않은 골목도 주인은 받을 수 있다.

    내용은 공개 화면과 같다 (리뷰 글·장소 이름 없음). 공개 중인 골목이면 표지에 공개 주소의 QR이 들어간다.
    """

    def get(self, request, *args, **kwargs):
        guide = my_guide_or_404(request, self.kwargs["guide_pk"])
        origin = public_web_origin(request)
        # 웹의 공개 화면 경로와 같다 (web/constants/routeUrl.ts의 GUIDE_PAGE.public)
        share_url = f"{origin}/g/{guide.share_token}" if origin and guide.share_token else ""
        try:
            pdf = render_pamphlet(guide, share_url)
        except PamphletUnavailable:
            return Response({"detail": "이 서버에는 PDF를 만드는 도구가 설치되어 있지 않아요."}, status=503)
        response = HttpResponse(pdf, content_type="application/pdf")
        # 한글 제목이 파일 이름에 그대로 들어가게 한다 (filename*=UTF-8''…)
        response["Content-Disposition"] = content_disposition_header(True, f"{guide.title}.pdf")
        return response


class PublicGuideAPIView(APIView):
    """공개 주소로 골목 읽기. 로그인이 필요 없는 유일한 조회라서 내보낼 내용은 public_guide가 따로 고른다.

    인증을 아예 보지 않는다 (만료된 토큰을 들고 와도 401이 아니라 그대로 읽힌다). 요청 수는 anon 한도로 묶인다.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        guide = get_object_or_404(with_entries(Guide.objects.all()), share_token=self.kwargs["token"])
        return Response(public_guide(guide))
