from django.db.models import Avg, Count, F, Max, Prefetch, Sum
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.generics import ListAPIView, DestroyAPIView

from apps.restaurant.models import Restaurant, RestaurantReview
from apps.restaurant.serializers import RestaurantListSerializer, RestaurantInfoSerializer, RestaurantReviewSerializer
from apps.zone.models import Category


def annotate_restaurants(queryset):
    return queryset.select_related("category").annotate(
        review_avg=Avg("review_set__point"),
        review_point=Sum("review_set__point"),
        latest_ordered_at=Max("review_set__ordered_at"),
        ordered_count=Count("review_set__ordered_at", distinct=True),
        review_count=Count("review_set"),
    )


class AllRestaurantsListAPIView(ListAPIView):
    serializer_class = RestaurantListSerializer
    # ?search= 로 이름 검색 (음식점 등록 화면의 중복 확인에 쓴다)
    search_fields = ["name"]

    def get_queryset(self):
        queryset = Restaurant.objects.filter(category__zone__user_id=self.request.user.id,
                                             category__zone_id=self.kwargs["zone_pk"])
        category_id = self.request.query_params.get("category")
        # 숫자가 아닌 값이 오면 filter()가 ValueError로 500을 내므로 무시한다
        if category_id and category_id.isdigit():
            queryset = queryset.filter(category_id=category_id)
        return annotate_restaurants(queryset).order_by(F("latest_ordered_at").desc(nulls_last=True), "-id")


class RestaurantListViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantListSerializer

    def get_queryset(self):
        queryset = Restaurant.objects.filter(category__zone__user_id=self.request.user.id,
                                             category__zone_id=self.kwargs["zone_pk"],
                                             category_id=self.kwargs["category_pk"])
        return annotate_restaurants(queryset).order_by(F("latest_ordered_at").desc(nulls_last=True), "-id")

    def perform_create(self, serializer):
        # get_queryset은 조회에만 적용되므로 생성 시에는 카테고리 소유 여부를 따로 확인해야 한다
        category = get_object_or_404(Category,
                                     pk=self.kwargs["category_pk"],
                                     zone_id=self.kwargs["zone_pk"],
                                     zone__user_id=self.request.user.id)
        serializer.save(category=category)


class RestaurantInfoViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantInfoSerializer

    def get_object(self):
        queryset = Restaurant.objects.filter(category__zone__user_id=self.request.user.id)
        queryset = queryset.prefetch_related(
            Prefetch("review_set",
                     queryset=RestaurantReview.objects.all().order_by("-ordered_at"))
        )
        queryset = annotate_restaurants(queryset)
        # 남의 음식점이거나 없는 id면 500이 아니라 404
        return get_object_or_404(queryset, pk=self.kwargs["restaurant_pk"])


class RestaurantReviewViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantReviewSerializer

    def get_queryset(self):
        queryset = RestaurantReview.objects.filter(restaurant__category__zone__user_id=self.request.user.id,
                                                   restaurant_id=self.kwargs["restaurant_pk"])
        menu = self.request.query_params.get("menu")
        if menu is not None:
            queryset = queryset.filter(menu=menu)
        return queryset.order_by("-ordered_at", "-id")

    def perform_create(self, serializer):
        # get_queryset은 조회에만 적용되므로 생성 시에는 음식점 소유 여부를 따로 확인해야 한다
        restaurant = get_object_or_404(Restaurant,
                                       pk=self.kwargs["restaurant_pk"],
                                       category__zone__user_id=self.request.user.id)
        serializer.save(user=self.request.user, restaurant=restaurant)


class RestaurantReviewDeleteAPIView(DestroyAPIView):
    def get_object(self):
        return get_object_or_404(RestaurantReview,
                                 restaurant__category__zone__user_id=self.request.user.id,
                                 restaurant_id=self.kwargs["restaurant_pk"],
                                 pk=self.kwargs["review_pk"])
