from datetime import date, timedelta

from django.db.models import Avg, CharField, Count, Max, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce, Concat
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView, RetrieveUpdateDestroyAPIView

from apps.restaurant.menus import normalize_menu
from apps.restaurant.models import Restaurant
from apps.zone.models import Zone, Category
from apps.zone.serializers import (CategoryManageSerializer, ZoneDashboardSerializer, ZoneListSerializer)


# 카테고리는 만든 순서대로 보여준다 (prefetch 순서가 DB 마음대로면 필터 pill 순서가 바뀐다)
# 이 기간보다 오래 안 간 만족스러운 음식점을 "오랜만에 가볼 만한 곳"으로 보여준다
FORGOTTEN_AFTER_DAYS = 60


def ordered_categories():
    return Prefetch("category_set", queryset=Category.objects.order_by("id"))


class ZoneViewSet(viewsets.ModelViewSet):
    serializer_class = ZoneListSerializer

    def get_queryset(self):
        return Zone.objects.filter(user_id=self.request.user.id).annotate(
            latest_ordered_at=Coalesce(Max("restaurant__review_set__ordered_at"),
                                       date(2000, 1, 1))
        ).prefetch_related(ordered_categories()).order_by("-latest_ordered_at", "id")


class ZoneDetailAPIView(RetrieveUpdateDestroyAPIView):
    # 이름 바꾸기(PATCH)와 삭제
    serializer_class = ZoneListSerializer
    lookup_url_kwarg = "zone_pk"

    def get_queryset(self):
        return Zone.objects.filter(user_id=self.request.user.id)


class ZoneDashboardAPIView(RetrieveAPIView):
    serializer_class = ZoneDashboardSerializer

    def get_object(self):
        # 서버 로컬 시각이 아니라 settings.TIME_ZONE(Asia/Seoul) 기준 날짜로 "이번 달"을 잡는다
        current_date = timezone.localdate()

        queryset = Zone.objects.filter(user_id=self.request.user.id).prefetch_related(ordered_categories())
        queryset = queryset.annotate(
            restaurant_count=Count("restaurant", distinct=True),
            review_count=Count("restaurant__review_set", distinct=True),
            # 같은 날 같은 가게에서 메뉴 여러 개를 기록해도 방문은 1번
            monthly_visited_count=Count(
                Concat("restaurant__pk", Value("_"), "restaurant__review_set__ordered_at", output_field=CharField()),
                filter=Q(restaurant__review_set__ordered_at__year=current_date.year,
                         restaurant__review_set__ordered_at__month=current_date.month),
                distinct=True,
            ),
        )
        zone = get_object_or_404(queryset, pk=self.kwargs["zone_pk"])

        restaurants = Restaurant.objects.filter(zone=zone).prefetch_related(
            Prefetch("categories", queryset=Category.objects.order_by("id"))
        ).annotate(
            review_avg=Coalesce(Avg("review_set__point"), 0.0),
            review_count=Count("review_set"),
            latest_ordered_at=Max("review_set__ordered_at"),
            ordered_count=Count("review_set__ordered_at", distinct=True),
        ).filter(latest_ordered_at__isnull=False)

        # 믿고 먹는 곳: 2번 이상 가서 평균 만족도 0.6 이상
        zone.delicious_restaurants = list(
            restaurants.filter(ordered_count__gte=2, review_avg__gte=0.6).order_by("-review_avg", "-latest_ordered_at")[:5])
        zone.recently_ordered_restaurants = list(restaurants.order_by("-latest_ordered_at", "-id")[:3])
        # 만족했는데 한동안 안 간 곳. 개인 기록이라서 꺼내줄 수 있는 추천이다.
        zone.forgotten_restaurants = list(restaurants.filter(
            review_avg__gte=0.6, latest_ordered_at__lt=current_date - timedelta(days=FORGOTTEN_AFTER_DAYS),
        ).order_by("latest_ordered_at", "-review_avg")[:5])
        return zone


class CategoryListAPIView(ListCreateAPIView):
    serializer_class = CategoryManageSerializer
    # zone당 카테고리는 많아야 수십 개이고 화면에서 전체 목록으로 쓰므로 끊지 않는다
    pagination_class = None

    def get_queryset(self):
        return Category.objects.filter(
            zone__user_id=self.request.user.id,
            zone_id=self.kwargs["zone_pk"],
        ).annotate(
            restaurant_count=Count("restaurants", distinct=True),
            # 이 카테고리만 붙은 음식점 수. 0이 아니면 지울 수 없다 (그 음식점이 카테고리 없이 남는다)
            exclusive_restaurant_count=Count("restaurants", distinct=True,
                                             filter=Q(restaurants__in=Subquery(single_tag_restaurants()))),
        ).order_by("id")

    def perform_create(self, serializer):
        # get_queryset은 조회에만 적용되므로 생성 시에는 zone 소유 여부를 따로 확인해야 한다
        zone = get_object_or_404(Zone, pk=self.kwargs["zone_pk"], user_id=self.request.user.id)
        ensure_unique_keyword(zone.pk, serializer.validated_data["keyword"])
        serializer.save(zone=zone)


def ensure_unique_keyword(zone_id, keyword, exclude_pk=None):
    # "돈 까스"와 "돈까스"처럼 공백·대소문자만 다른 카테고리가 생기지 않게 한다 (화면의 중복 검사와 같은 기준)
    key = normalize_menu(keyword)
    others = Category.objects.filter(zone_id=zone_id).exclude(pk=exclude_pk)
    if any(normalize_menu(other) == key for other in others.values_list("keyword", flat=True)):
        raise ValidationError({"keyword": f"'{keyword}'은(는) 이미 있는 카테고리예요."})


class CategoryDetailAPIView(RetrieveUpdateDestroyAPIView):
    # 이름 바꾸기(PATCH)와 삭제
    serializer_class = CategoryManageSerializer
    lookup_url_kwarg = "category_pk"

    def perform_update(self, serializer):
        keyword = serializer.validated_data.get("keyword")
        if keyword is not None:
            ensure_unique_keyword(serializer.instance.zone_id, keyword, exclude_pk=serializer.instance.pk)
        serializer.save()

    def get_queryset(self):
        return Category.objects.filter(zone__user_id=self.request.user.id,
                                       zone_id=self.kwargs["zone_pk"])

    def perform_destroy(self, instance):
        # 카테고리는 태그라 지워도 음식점은 남는다. 다만 이 카테고리 하나만 붙은 음식점이 카테고리 없이 남지 않게 막는다.
        alone = instance.restaurants.filter(id__in=Subquery(single_tag_restaurants())).count()
        if alone:
            raise ValidationError({"detail": f"이 카테고리만 붙은 음식점이 {alone}곳 있어요. "
                                             f"그 음식점에 다른 카테고리를 붙인 뒤 지워주세요."})
        instance.delete()


def single_tag_restaurants():
    return Restaurant.objects.annotate(tag_count=Count("categories")).filter(tag_count=1).values("id")
