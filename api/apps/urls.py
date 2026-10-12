from django.urls import path

from apps.auth import views as auth_views
from apps.guide import views as guide_views
from apps.push import views as push_views
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
    path("users/me/export", restaurant_views.ArchiveExportAPIView.as_view(), name="archive-export"),
    path("users/me/import", restaurant_views.ArchiveImportAPIView.as_view(), name="archive-import"),

    # push
    path("push/config", push_views.PushConfigAPIView.as_view(), name="push-config"),
    path("push/subscriptions", push_views.PushSubscriptionAPIView.as_view(), name="push-subscriptions"),
    path("push/test", push_views.PushTestAPIView.as_view(), name="push-test"),
    path("push/send", push_views.PushSendAPIView.as_view(), name="push-send"),

    # zone
    path("zones", zone_views.ZoneViewSet.as_view({
        "get": "list",
        "post": "create"
    }), name="zones"),
    path("zones/<int:zone_pk>", zone_views.ZoneDetailAPIView.as_view(), name="zone-delete"),
    path("zones/<int:zone_pk>/dashboard", zone_views.ZoneDashboardAPIView.as_view(), name="zone-dashboard"),
    path("zones/<int:zone_pk>/stats", zone_views.ZoneStatsAPIView.as_view(), name="zone-stats"),
    path("zones/<int:zone_pk>/stats/<str:month>", zone_views.ZoneMonthAPIView.as_view(), name="zone-stats-month"),
    # 카테고리는 장소가 아니라 사용자에게 속한다
    path("categories", zone_views.CategoryListAPIView.as_view(), name="category-list"),
    path("categories/<int:category_pk>", zone_views.CategoryDetailAPIView.as_view(), name="category-delete"),
    path("categories/<int:category_pk>/restaurants", zone_views.CategoryRestaurantsAPIView.as_view(),
         name="category-restaurants"),

    # restaurants
    path("zones/<int:zone_pk>/restaurants", restaurant_views.AllRestaurantsListAPIView.as_view(),
         name="all-restaurants"),
    path("zones/<int:zone_pk>/restaurants/pick", restaurant_views.RestaurantPickAPIView.as_view(),
         name="restaurant-pick"),
    path("restaurants/<int:restaurant_pk>",
         restaurant_views.RestaurantInfoViewSet.as_view({
             "get": "retrieve",
             "patch": "partial_update",
             "delete": "destroy",
         }), name="restaurant-info"),

    path("restaurants/<int:restaurant_pk>/branches", restaurant_views.BranchListAPIView.as_view(),
         name="branches"),
    path("restaurants/<int:restaurant_pk>/branches/<int:branch_pk>", restaurant_views.BranchDetailAPIView.as_view(),
         name="branch-detail"),
    path("restaurants/<int:restaurant_pk>/reviews",
         restaurant_views.RestaurantReviewViewSet.as_view({
             "get": "list",
             "post": "create"
         }), name="review-create"),
    path("restaurants/<int:restaurant_pk>/reviews/<int:review_pk>",
         restaurant_views.RestaurantReviewDeleteAPIView.as_view(), name="review-delete"),

    # 먹골목 (골목 = 골라서 남에게 건네는 목록)
    path("guides", guide_views.GuideListAPIView.as_view(), name="guides"),
    path("guides/<int:guide_pk>", guide_views.GuideDetailAPIView.as_view(), name="guide-detail"),
    path("guides/<int:guide_pk>/entries", guide_views.GuideEntriesAPIView.as_view(), name="guide-entries"),
    path("guides/<int:guide_pk>/share", guide_views.GuideShareAPIView.as_view(), name="guide-share"),
    # 로그인 없이 읽는 공개 주소
    path("public/guides/<str:token>", guide_views.PublicGuideAPIView.as_view(), name="public-guide"),
]
