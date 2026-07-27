from django.urls import path

from apps.auth import views as auth_views
from apps.restaurant import views as restaurant_views
from apps.zone import views as zone_views

urlpatterns = [
    path("check", auth_views.exists_user, name="exists-user"),

    # auth
    path("auth/obtain-token", auth_views.ObtainTokenAPIView.as_view(), name="obtain-token"),
    path("auth/refresh-token", auth_views.RefreshTokenAPIView.as_view(), name="refresh-token"),
    path("auth/token", auth_views.LogoutAPIView.as_view(), name="logout"),
    path("users/me", auth_views.UserInfoAPIView.as_view(), name="my-info"),
    path("users/me/password", auth_views.ChangePasswordAPIView.as_view(), name="change-password"),

    # zone
    path("zones", zone_views.ZoneViewSet.as_view({
        "get": "list",
        "post": "create"
    }), name="zones"),
    path("zones/<int:zone_pk>", zone_views.ZoneDeleteAPIView.as_view(), name="zone-delete"),
    path("zones/<int:zone_pk>/dashboard", zone_views.ZoneDashboardAPIView.as_view(), name="zone-dashboard"),
    path("zones/<int:zone_pk>/category", zone_views.CategoryListAPIView.as_view(), name="category-list"),

    # restaurants
    path("zones/<int:zone_pk>/restaurants", restaurant_views.AllRestaurantsListAPIView.as_view(),
         name="all-restaurants"),
    path("zones/<int:zone_pk>/category/<int:category_pk>/restaurants",
         restaurant_views.RestaurantListViewSet.as_view({"get": "list", "post": "create"}), name="restaurants"),
    path("restaurants/<int:restaurant_pk>",
         restaurant_views.RestaurantInfoViewSet.as_view({
             "get": "retrieve",
             "patch": "partial_update",
             "delete": "destroy",
         }), name="restaurant-info"),

    path("restaurants/<int:restaurant_pk>/reviews",
         restaurant_views.RestaurantReviewViewSet.as_view({
             "get": "list",
             "post": "create"
         }), name="review-create"),
    path("restaurants/<int:restaurant_pk>/reviews/<int:review_pk>",
         restaurant_views.RestaurantReviewDeleteAPIView.as_view(), name="review-delete"),
]
