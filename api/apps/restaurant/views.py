import json

from django.db.models import Avg, Count, F, Max, Prefetch, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.restaurant.archive import ARCHIVE_FORMAT, ArchiveSerializer, build_archive, build_csv, import_archive
from apps.restaurant.menus import normalize_menu, tidy_menu
from apps.restaurant.models import Branch, Restaurant, RestaurantReview
from apps.restaurant.picking import pick_restaurant
from apps.restaurant.serializers import (
    BranchSerializer,
    RestaurantInfoSerializer,
    RestaurantListSerializer,
    RestaurantReviewSerializer,
)
from apps.zone.models import Category, Zone

# 목록 정렬 (?sort=). 방문·리뷰가 없는 음식점은 어느 정렬에서든 뒤로 보낸다.
RESTAURANT_SORTS = {
    "recent": (F("latest_ordered_at").desc(nulls_last=True), "-id"),
    "rating": (F("review_avg").desc(nulls_last=True), F("latest_ordered_at").desc(nulls_last=True), "-id"),
    "visits": ("-ordered_count", F("latest_ordered_at").desc(nulls_last=True), "-id"),
    "name": ("name", "id"),
}


def sort_restaurants(queryset, sort):
    return queryset.order_by(*RESTAURANT_SORTS.get(sort, RESTAURANT_SORTS["recent"]))


def annotate_restaurants(queryset):
    return queryset.prefetch_related(ordered_tags()).annotate(
        review_avg=Avg("review_set__point"),
        review_point=Sum("review_set__point"),
        latest_ordered_at=Max("review_set__ordered_at"),
        ordered_count=Count("review_set__ordered_at", distinct=True),
        review_count=Count("review_set"),
    )


def ordered_tags():
    # 카테고리 태그는 만든 순서로 보여준다
    return Prefetch("categories", queryset=Category.objects.order_by("id"))


def my_restaurants(request, zone_id=None):
    queryset = Restaurant.objects.filter(zone__user_id=request.user.id)
    return queryset.filter(zone_id=zone_id) if zone_id is not None else queryset


def filter_by_category(queryset, category_ids):
    """?category=1&category=2 → 그중 하나라도 붙은 음식점.

    태그 테이블과 바로 조인하면 카테고리가 여러 개 맞는 음식점이 여러 줄이 되어 리뷰 집계가 부풀므로
    음식점 id 하위 쿼리로 거른다. 숫자가 아닌 값은 무시한다 (filter()가 ValueError로 500을 낸다).
    """
    ids = [value for value in category_ids if value.isdigit()]
    if not ids:
        return queryset
    tagged = Restaurant.categories.through.objects.filter(category_id__in=ids).values("restaurant_id")
    return queryset.filter(id__in=tagged)


class AllRestaurantsListAPIView(ListCreateAPIView):
    """장소의 음식점 목록(GET, ?category= ?search= ?sort=)과 등록(POST, category_ids 하나 이상)."""
    serializer_class = RestaurantListSerializer
    # ?search= 로 이름 검색 (음식점 등록 화면의 중복 확인에 쓴다)
    search_fields = ["name"]

    def get_queryset(self):
        queryset = filter_by_category(my_restaurants(self.request, self.kwargs["zone_pk"]),
                                      self.request.query_params.getlist("category"))
        return sort_restaurants(annotate_restaurants(queryset), self.request.query_params.get("sort"))

    def get_zone(self):
        return get_object_or_404(Zone, pk=self.kwargs["zone_pk"], user_id=self.request.user.id)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == "POST":
            # 카테고리가 이 장소 것인지 확인하려고 넘긴다. 남의 장소면 여기서 404.
            context["zone"] = self.get_zone()
        return context

    def perform_create(self, serializer):
        serializer.save(zone=serializer.context["zone"])


class RestaurantPickAPIView(APIView):
    """한 카테고리(없으면 장소 전체)에서 음식점 하나를 가중치를 줘서 뽑는다."""

    def get(self, request, *args, **kwargs):
        queryset = filter_by_category(my_restaurants(request, self.kwargs["zone_pk"]),
                                      request.query_params.getlist("category"))
        # 기본은 실망한 곳을 뺀다. exclude_disappointing=0 이면 포함
        exclude = request.query_params.get("exclude_disappointing", "1") != "0"

        picked = pick_restaurant(list(annotate_restaurants(queryset)), timezone.localdate(), exclude)
        return Response({"restaurant": RestaurantListSerializer(picked).data if picked else None})


class RestaurantInfoViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantInfoSerializer

    def get_object(self):
        queryset = my_restaurants(self.request).prefetch_related(
            Prefetch("review_set",
                     queryset=RestaurantReview.objects.select_related("menu", "branch").order_by("-ordered_at", "-id")),
            "branches",
        )
        queryset = annotate_restaurants(queryset)
        # 남의 음식점이거나 없는 id면 500이 아니라 404
        return get_object_or_404(queryset, pk=self.kwargs["restaurant_pk"])

    def perform_update(self, serializer):
        serializer.save()
        # 바뀐 카테고리·집계를 응답에 담으려고 다시 읽는다
        serializer.instance = self.get_object()


def my_reviews(request, restaurant_id):
    return RestaurantReview.objects.select_related("menu", "branch").filter(
        restaurant__zone__user_id=request.user.id, restaurant_id=restaurant_id)


class RestaurantReviewViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantReviewSerializer

    def get_queryset(self):
        queryset = my_reviews(self.request, self.kwargs["restaurant_pk"])
        menu = self.request.query_params.get("menu")
        if menu is not None:
            # 빈 값은 "메뉴 미기재", 아니면 공백·대소문자를 무시하고 같은 메뉴
            queryset = queryset.filter(menu__isnull=True) if not menu.strip() \
                else queryset.filter(menu__name_key=normalize_menu(menu))
        branch = self.request.query_params.get("branch")
        if branch == "none":
            queryset = queryset.filter(branch__isnull=True)
        elif branch and branch.isdigit():
            queryset = queryset.filter(branch_id=branch)
        return queryset.order_by("-ordered_at", "-id")

    def perform_create(self, serializer):
        # get_queryset은 조회에만 적용되므로 생성 시에는 음식점 소유 여부를 따로 확인해야 한다
        restaurant = get_object_or_404(Restaurant, pk=self.kwargs["restaurant_pk"],
                                       zone__user_id=self.request.user.id)
        serializer.save(user=self.request.user, restaurant=restaurant)


class RestaurantReviewDeleteAPIView(RetrieveUpdateDestroyAPIView):
    # 이름은 예전 그대로 두지만 수정(PATCH)도 받는다
    serializer_class = RestaurantReviewSerializer

    def get_object(self):
        return get_object_or_404(my_reviews(self.request, self.kwargs["restaurant_pk"]), pk=self.kwargs["review_pk"])


def my_restaurant_or_404(request, restaurant_id):
    return get_object_or_404(Restaurant, pk=restaurant_id, zone__user_id=request.user.id)


def ensure_unique_branch(restaurant, name, exclude_pk=None):
    # "역삼점"과 "역삼 점"처럼 공백·대소문자만 다른 지점이 생기지 않게 한다
    if Branch.objects.filter(restaurant=restaurant, name_key=normalize_menu(name)).exclude(pk=exclude_pk).exists():
        raise ValidationError({"name": f"'{name}' 지점은 이미 있어요."})


class BranchListAPIView(ListCreateAPIView):
    """음식점의 지점 목록(GET)과 추가(POST {name})."""
    serializer_class = BranchSerializer
    pagination_class = None

    def get_queryset(self):
        return Branch.objects.filter(restaurant=my_restaurant_or_404(self.request, self.kwargs["restaurant_pk"])) \
            .annotate(review_count=Count("reviews")).order_by("id")

    def perform_create(self, serializer):
        restaurant = my_restaurant_or_404(self.request, self.kwargs["restaurant_pk"])
        name = tidy_menu(serializer.validated_data["name"])
        ensure_unique_branch(restaurant, name)
        serializer.save(restaurant=restaurant, name=name, name_key=normalize_menu(name))


class BranchDetailAPIView(RetrieveUpdateDestroyAPIView):
    """지점 이름 바꾸기(PATCH)와 지우기(DELETE). 지우면 그 지점 리뷰는 남고 지점만 비워진다."""
    serializer_class = BranchSerializer
    lookup_url_kwarg = "branch_pk"

    def get_queryset(self):
        return Branch.objects.filter(restaurant__zone__user_id=self.request.user.id,
                                     restaurant_id=self.kwargs["restaurant_pk"])

    def perform_update(self, serializer):
        name = serializer.validated_data.get("name")
        if name is None:
            serializer.save()
            return
        name = tidy_menu(name)
        ensure_unique_branch(serializer.instance.restaurant, name, exclude_pk=serializer.instance.pk)
        serializer.save(name=name, name_key=normalize_menu(name))


class ArchiveExportAPIView(APIView):
    """내 기록 전체를 파일로 내려준다. ?type=csv 면 엑셀용 CSV, 아니면 다시 가져올 수 있는 JSON.

    (DRF가 ?format= 을 응답 형식 지정에 쓰므로 type으로 받는다)
    """

    def get(self, request, *args, **kwargs):
        stamp = timezone.localdate().strftime("%Y%m%d")
        if request.query_params.get("type") == "csv":
            response = HttpResponse(build_csv(request.user), content_type="text/csv; charset=utf-8")
            filename = f"meokbogi-{stamp}.csv"
        else:
            response = HttpResponse(json.dumps(build_archive(request.user), ensure_ascii=False, indent=2),
                                    content_type="application/json; charset=utf-8")
            filename = f"meokbogi-{stamp}.json"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ArchiveImportAPIView(APIView):
    """내보낸 JSON 파일을 합쳐서 가져온다. ?dry_run=1 이면 바꾸지 않고 결과만 미리 본다.

    요청 본문 크기 제한(2.5MB)을 피하려고 multipart 파일(file)로 받는다.
    """
    parser_classes = [MultiPartParser]
    MAX_BYTES = 20 * 1024 * 1024

    def post(self, request, *args, **kwargs):
        upload = request.FILES.get("file")
        if upload is None:
            raise ValidationError({"file": "가져올 파일을 골라주세요."})
        if upload.size > self.MAX_BYTES:
            raise ValidationError({"file": "파일이 너무 커요. 20MB까지 가져올 수 있어요."})
        try:
            data = json.loads(upload.read().decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValidationError({"file": "JSON 파일을 읽지 못했어요. 먹보기에서 내보낸 .json 파일인지 확인해주세요."}) from None
        # 필드별 "필수 항목" 오류보다 "어떤 파일인지"를 먼저 알려준다
        if not isinstance(data, dict) or data.get("format") != ARCHIVE_FORMAT:
            raise ValidationError({"file": "먹보기에서 내보낸 백업 파일이 아니에요."})

        serializer = ArchiveSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        dry_run = request.query_params.get("dry_run") == "1"
        summary = import_archive(request.user, serializer.validated_data, dry_run=dry_run)
        return Response({**summary, "dry_run": dry_run})
