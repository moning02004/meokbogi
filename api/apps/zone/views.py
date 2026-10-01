from datetime import date, timedelta

from django.db.models import Prefetch, Count, Sum, Max, Q, Value, CharField, Avg
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
            latest_ordered_at=Coalesce(Max("category__restaurant__review_set__ordered_at"),
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

        queryset = Zone.objects.filter(user_id=self.request.user.id)
        queryset = queryset.annotate(
            restaurant_count=Count('category__restaurant', distinct=True),
            review_count=Count('category__restaurant__review_set', distinct=True),
            monthly_visited_count=Count(
                Concat(
                    'category__restaurant__pk',
                    Value('_'),
                    'category__restaurant__review_set__ordered_at',
                    output_field=CharField(),
                ),
                filter=Q(
                    category__restaurant__review_set__ordered_at__year=current_date.year,
                    category__restaurant__review_set__ordered_at__month=current_date.month,
                ),
                distinct=True, ),
        )
        queryset = queryset.prefetch_related(
            ordered_categories(),
            Prefetch("category_set__restaurant_set",
                     queryset=Restaurant.objects.annotate(
                         review_avg=Coalesce(Avg("review_set__point"), 0.0),
                         review_count=Count("review_set"),
                         review_point=Sum("review_set__point"),
                         latest_ordered_at=Max("review_set__ordered_at"),
                         ordered_count=Count("review_set__ordered_at", distinct=True),
                     ).filter(latest_ordered_at__isnull=False, ordered_count__gte=2, review_avg__gte=0.6).order_by(
                         "-review_avg").distinct(),
                     to_attr='delicious_restaurants'),

            Prefetch("category_set__restaurant_set",
                     queryset=Restaurant.objects.all().annotate(
                         review_avg=Coalesce(Avg("review_set__point"), 0.0),
                         review_count=Count("review_set"),
                         review_point=Sum("review_set__point"),
                         latest_ordered_at=Max("review_set__ordered_at"),
                         ordered_count=Count("review_set__ordered_at", distinct=True),

                     ).filter(latest_ordered_at__isnull=False).order_by("-latest_ordered_at").distinct(),
                     to_attr='recently_ordered_restaurants'),

            # 만족했는데 한동안 안 간 곳. 개인 기록이라서 꺼내줄 수 있는 추천이다.
            Prefetch("category_set__restaurant_set",
                     queryset=Restaurant.objects.annotate(
                         review_avg=Coalesce(Avg("review_set__point"), 0.0),
                         review_count=Count("review_set"),
                         latest_ordered_at=Max("review_set__ordered_at"),
                         ordered_count=Count("review_set__ordered_at", distinct=True),
                     ).filter(review_avg__gte=0.6,
                              latest_ordered_at__lt=current_date - timedelta(days=FORGOTTEN_AFTER_DAYS)).distinct(),
                     to_attr='forgotten_restaurants'),
        )
        return get_object_or_404(queryset, pk=self.kwargs['zone_pk'])


class CategoryListAPIView(ListCreateAPIView):
    serializer_class = CategoryManageSerializer
    # zone당 카테고리는 많아야 수십 개이고 화면에서 전체 목록으로 쓰므로 끊지 않는다
    pagination_class = None

    def get_queryset(self):
        return Category.objects.filter(
            zone__user_id=self.request.user.id,
            zone_id=self.kwargs["zone_pk"],
        ).annotate(restaurant_count=Count("restaurant")).order_by("id")

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
        # Restaurant.category는 CASCADE라서 그냥 지우면 음식점과 리뷰까지 함께 사라진다
        if instance.restaurant_set.exists():
            raise ValidationError({"detail": "음식점이 등록된 카테고리는 삭제할 수 없습니다."})
        instance.delete()
