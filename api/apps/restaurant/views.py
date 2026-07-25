from django.db.models import Count, Max, OuterRef, Prefetch, Subquery, Sum
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.generics import ListAPIView, CreateAPIView, DestroyAPIView

from apps.restaurant.models import Restaurant, RestaurantReview
from apps.restaurant.serializers import RestaurantListSerializer, RestaurantInfoSerializer, RestaurantReviewSerializer


def annotate_restaurants(queryset):
    return queryset.select_related("category").annotate(
        review_point=Sum("review_set__point"),
        latest_ordered_at=Max("review_set__ordered_at"),
        ordered_count=Count("review_set__ordered_at", distinct=True),
        review_count=Count("review_set"),
    )


class AllRestaurantsListAPIView(ListAPIView):
    serializer_class = RestaurantListSerializer

    def get_queryset(self):
        queryset = Restaurant.objects.filter(category__zone_id=self.kwargs["zone_pk"])
        category_id = self.request.query_params.get("category")
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return annotate_restaurants(queryset)


class RestaurantListViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantListSerializer

    def get_queryset(self):
        queryset = Restaurant.objects.filter(category__zone_id=self.kwargs["zone_pk"],
                                             category_id=self.kwargs["category_pk"])
        return annotate_restaurants(queryset)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["category_id"] = self.kwargs["category_pk"]
        return context


class RestaurantInfoViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantInfoSerializer

    def get_object(self):
        queryset = Restaurant.objects.filter(category__zone__user_id=self.request.user.id)
        queryset = queryset.prefetch_related(
            Prefetch("review_set",
                     queryset=RestaurantReview.objects.all().order_by("-ordered_at"))
        )
        queryset = annotate_restaurants(queryset)
        return queryset.get(pk=self.kwargs["restaurant_pk"])


class RestaurantReviewViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantReviewSerializer

    def get_queryset(self):
        queryset = RestaurantReview.objects.filter(restaurant_id=self.kwargs["restaurant_pk"])
        menu = self.request.query_params.get("menu")
        print(menu)
        if menu is not None:
            queryset = queryset.filter(menu=menu)
        return queryset


class RestaurantReviewDeleteAPIView(DestroyAPIView):
    def get_object(self):
        return get_object_or_404(RestaurantReview, restaurant_id=self.kwargs["restaurant_pk"],
                                  pk=self.kwargs["review_pk"])
