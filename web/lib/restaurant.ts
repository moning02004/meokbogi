import {apiRequest} from "@/lib/api";
import {RESTAURANT_API, ZONE_API} from "@/constants/routeUrl";
import {CategoryType} from "@/types/zone";
import {DeliciousRestaurant, RecentRegisteredRestaurant, RestaurantListItemType} from "@/types/restaurant";


export interface DashboardResponseType {
    category: Array<CategoryType>;
    delicious_restaurants: Array<DeliciousRestaurant>;
    recent_restaurants: Array<RecentRegisteredRestaurant>;
    restaurant_count: number;
    review_count: number;

}

export const fetchZoneDashboard = async (zoneId: number) => {
    const dashboardAPI = ZONE_API.dashboard
    return await apiRequest[dashboardAPI.method]<DashboardResponseType>
    (dashboardAPI.endpoint({zone: zoneId}))
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export const fetchZoneRestaurants = async (
    zoneId: number,
    {categoryId, page = 1}: { categoryId?: number | null; page?: number } = {}
) => {
    const params = new URLSearchParams({page: String(page)})
    if (categoryId) params.set("category", String(categoryId))

    const restaurantList = RESTAURANT_API.list
    return await apiRequest[restaurantList.method]<PaginatedResponse<RestaurantListItemType>>
    (`${restaurantList.endpoint({zone: zoneId})}?${params.toString()}`)
}
