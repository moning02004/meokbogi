from datetime import datetime

from django.db.models import Prefetch, Count, Sum, Max, Q, Value, CharField, Avg
from django.db.models.functions import Coalesce, Concat
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.generics import DestroyAPIView, ListCreateAPIView, RetrieveAPIView

from apps.restaurant.models import Restaurant
from apps.zone.models import Zone, Category
from apps.zone.serializers import (CategoryManageSerializer, ZoneDashboardSerializer, ZoneListSerializer)


class ZoneViewSet(viewsets.ModelViewSet):
    serializer_class = ZoneListSerializer

    def get_queryset(self):
        return Zone.objects.filter(user_id=self.request.user.id).annotate(
            latest_ordered_at=Coalesce(Max("category__restaurant__review_set__ordered_at"),
                                       datetime.strptime("2000-01-01", "%Y-%m-%d").date())
        ).order_by("-latest_ordered_at", "id")


class ZoneDeleteAPIView(DestroyAPIView):
    lookup_url_kwarg = "zone_pk"

    def get_queryset(self):
        return Zone.objects.filter(user_id=self.request.user.id)


class ZoneDashboardAPIView(RetrieveAPIView):
    serializer_class = ZoneDashboardSerializer

    def get_object(self):
        current_date = datetime.now().date()

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
        )
        return queryset.get(pk=self.kwargs['zone_pk'])


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
        serializer.save(zone=zone)


class CategoryDeleteAPIView(DestroyAPIView):
    lookup_url_kwarg = "category_pk"

    def get_queryset(self):
        return Category.objects.filter(zone__user_id=self.request.user.id,
                                       zone_id=self.kwargs["zone_pk"])

    def perform_destroy(self, instance):
        # Restaurant.category는 CASCADE라서 그냥 지우면 음식점과 리뷰까지 함께 사라진다
        if instance.restaurant_set.exists():
            raise ValidationError({"detail": "음식점이 등록된 카테고리는 삭제할 수 없습니다."})
        instance.delete()
