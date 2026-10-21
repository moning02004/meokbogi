"""장소의 기록을 차트용으로 센다 (2.3).

방문은 "같은 날 같은 음식점"을 한 번으로 본다. 메뉴 여러 개를 기록해도 한 번 간 것이다.
홈의 "이번 달 주문"과 같은 기준.
"""
from datetime import date

from apps.restaurant.models import Restaurant, RestaurantReview

STATS_MONTHS = 12
# 홈 카드의 작은 차트에 보여줄 달 수
DASHBOARD_MONTHS = 6


def month_starts(today, months):
    """today가 속한 달까지 거슬러 months개 달의 1일. 오래된 달부터."""
    starts = []
    year, month = today.year, today.month
    for _ in range(months):
        starts.append(date(year, month, 1))
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    return starts[::-1]


def zone_visits(zone, since):
    """since 이후의 방문 [(음식점 id, 날짜), ...]. 같은 날 같은 음식점은 한 번."""
    return list(RestaurantReview.objects.filter(restaurant__zone=zone, ordered_at__gte=since)
                .values_list("restaurant_id", "ordered_at").distinct())


def monthly_visits(visits, starts):
    """달마다 몇 번 갔는지. 기록이 없는 달도 0으로 채운다."""
    counts = {start.strftime("%Y-%m"): 0 for start in starts}
    for _, ordered_at in visits:
        key = ordered_at.strftime("%Y-%m")
        if key in counts:
            counts[key] += 1
    return [{"month": month, "count": count} for month, count in counts.items()]


def category_visits(visits):
    """카테고리마다 몇 번 갔는지, 많은 순. 카테고리가 여러 개 붙은 음식점은 각각에 센다."""
    per_restaurant = {}
    for restaurant_id, _ in visits:
        per_restaurant[restaurant_id] = per_restaurant.get(restaurant_id, 0) + 1

    tags = Restaurant.categories.through.objects.filter(restaurant_id__in=per_restaurant).values_list(
        "restaurant_id", "category_id", "category__keyword")
    rows = {}
    for restaurant_id, category_id, keyword in tags:
        row = rows.setdefault(category_id, {"id": category_id, "keyword": keyword, "count": 0})
        row["count"] += per_restaurant[restaurant_id]
    return sorted(rows.values(), key=lambda row: (-row["count"], row["id"]))


def month_days(zone, year, month):
    """그 달에 기록을 남긴 날과 그날 간 음식점. 최근 날짜부터.

    [{"date": "2026-10-12", "visits": [{"restaurant": {"id", "name"}, "menus": [{"menu", "point", "branch"}]}]}]
    """
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    reviews = RestaurantReview.objects.filter(
        restaurant__zone=zone, ordered_at__gte=start, ordered_at__lt=end,
    ).select_related("restaurant", "menu", "branch").order_by("-ordered_at", "restaurant__name", "restaurant_id", "id")

    days = {}
    for review in reviews:
        day = days.setdefault(review.ordered_at, {})
        visit = day.setdefault(review.restaurant_id, {
            "restaurant": {"id": review.restaurant_id, "name": review.restaurant.name},
            "menus": [],
        })
        visit["menus"].append({
            "menu": review.menu.name if review.menu else "",
            "point": review.point,
            "branch": review.branch.name if review.branch else "",
        })
    return [{"date": day.isoformat(), "visits": list(visits.values())} for day, visits in days.items()]
