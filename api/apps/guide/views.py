from django.db import transaction
from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.guide.models import Guide, GuideEntry
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

    guide.entries.all().delete()
    for position, data in enumerate(entries):
        restaurant = restaurants.get(data["restaurant"])
        if restaurant is None:
            raise ValidationError({"entries": "내 음식점만 실을 수 있어요."})
        if data["branch"] is not None and data["branch"] not in {branch.id for branch in restaurant.branches.all()}:
            raise ValidationError({"entries": f"'{restaurant.name}'의 지점이 아니에요."})

        by_key = {menu.name_key: menu for menu in restaurant.menus.all()}
        menus = []
        for name in data["menus"]:
            menu = by_key.get(normalize_menu(name))
            if menu is None:
                raise ValidationError({"entries": f"'{name}'은(는) '{restaurant.name}'에서 기록한 메뉴가 아니에요."})
            menus.append(menu)

        address = data.get("address")
        if address is not None and address.strip() != restaurant.address:
            restaurant.address = address.strip()
            restaurant.save(update_fields=["address"])

        entry = GuideEntry.objects.create(guide=guide, restaurant=restaurant, branch_id=data["branch"],
                                          position=position, comment=data["comment"].strip())
        entry.menus.set(menus)
    # 실린 집만 바꿔도 "고친 날"이 바뀌게 한다
    guide.save(update_fields=["updated_at"])


class GuideEntriesAPIView(APIView):
    """실린 집 저장(PUT {entries: [{restaurant, branch, comment, menus}]}). 순서는 보낸 순서."""

    def put(self, request, *args, **kwargs):
        guide = my_guide_or_404(request, self.kwargs["guide_pk"])
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


class PublicGuideAPIView(APIView):
    """공개 주소로 골목 읽기. 로그인이 필요 없는 유일한 조회라서 내보낼 내용은 public_guide가 따로 고른다.

    인증을 아예 보지 않는다 (만료된 토큰을 들고 와도 401이 아니라 그대로 읽힌다). 요청 수는 anon 한도로 묶인다.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        guide = get_object_or_404(with_entries(Guide.objects.all()), share_token=self.kwargs["token"])
        return Response(public_guide(guide))
