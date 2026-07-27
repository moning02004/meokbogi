from datetime import datetime

from django.db.models import Prefetch, Count, Sum, Max, Q, Value, CharField, OuterRef, Avg, FloatField
from django.db.models.functions import Coalesce, Concat
from rest_framework import viewsets
from rest_framework.generics import DestroyAPIView, ListCreateAPIView, RetrieveAPIView

from apps.restaurant.models import Restaurant, RestaurantReview
from apps.zone.models import Zone, Category
from apps.zone.serializers import ZoneListSerializer, CategoryListSerializer, ZoneDashboardSerializer


class ZoneViewSet(viewsets.ModelViewSet):
    serializer_class = ZoneListSerializer

    def get_queryset(self):
        return Zone.objects.filter(user_id=self.request.user.id)


class ZoneDeleteAPIView(DestroyAPIView):
    def get_queryset(self):
        return Zone.objects.filter(user=self.request.user)


ordered_count_subq = (
    RestaurantReview.objects
    .filter(restaurant=OuterRef("pk"))
    .values("restaurant")
    .annotate(c=Count("ordered_at", distinct=True))
    .values("c")
)


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

                     ).filter(latest_ordered_at__isnull=False).order_by(
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
    serializer_class = CategoryListSerializer

    def get_queryset(self):
        return Category.objects.filter(zone_id=self.kwargs["zone_pk"])

    def perform_create(self, serializer):
        serializer.save(zone_id=self.kwargs["zone_pk"])
