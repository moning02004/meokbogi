from django.db.models import Prefetch, Count, Sum, Max
from django.db.models.functions import Coalesce
from rest_framework import viewsets
from rest_framework.generics import DestroyAPIView, ListCreateAPIView, RetrieveAPIView

from apps.restaurant.models import Restaurant
from apps.zone.models import Zone, Category
from apps.zone.serializers import ZoneListSerializer, CategoryListSerializer, ZoneDashboardSerializer


class ZoneViewSet(viewsets.ModelViewSet):
    serializer_class = ZoneListSerializer

    def get_queryset(self):
        return Zone.objects.filter(user_id=self.request.user.id)


class ZoneDeleteAPIView(DestroyAPIView):
    def get_queryset(self):
        return Zone.objects.filter(user=self.request.user)


class ZoneDashboardAPIView(RetrieveAPIView):
    serializer_class = ZoneDashboardSerializer

    def get_object(self):
        queryset = Zone.objects.filter(user_id=self.request.user.id)
        queryset = queryset.annotate(
            restaurant_count=Count('category__restaurant', distinct=True),
            review_count=Count('category__restaurant__review_set', distinct=True)
        )
        queryset = queryset.prefetch_related(
            Prefetch("category_set__restaurant_set",
                     queryset=Restaurant.objects.annotate(
                         review_avg=Coalesce(Sum("review_set__point") / Count("review_set"), 0),
                         review_point=Sum("review_set__point"),
                         latest_ordered_at=Max("review_set__ordered_at"),
                         ordered_count=Count("review_set"),
                     ).filter(latest_ordered_at__isnull=False, ordered_count__gte=3, review_avg__gte=0.25).distinct(),
                     to_attr='delicious_restaurants'),

            Prefetch("category_set__restaurant_set",
                     queryset=Restaurant.objects.all().annotate(
                         review_avg=Coalesce(Sum("review_set__point") / Count("review_set"), 0),
                         review_point=Sum("review_set__point"),
                         latest_ordered_at=Max("review_set__ordered_at"),
                         ordered_count=Count("review_set"),
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
