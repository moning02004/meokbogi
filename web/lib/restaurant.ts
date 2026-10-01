import {apiRequest} from "@/lib/api";
import {RESTAURANT_API, ZONE_API} from "@/constants/routeUrl";
import {CategoryType} from "@/types/zone";

// "치킨 · 분식" 처럼 음식점의 카테고리를 한 줄로
export const categoryLabel = (categories: CategoryType[]) => categories.map((category) => category.keyword).join(" · ")
import {DeliciousRestaurant, RecentRegisteredRestaurant, RestaurantListItemType, RestaurantSort} from "@/types/restaurant";


export interface DashboardResponseType {
    category: Array<CategoryType>;
    delicious_restaurants: Array<DeliciousRestaurant>;
    recent_restaurants: Array<RecentRegisteredRestaurant>;
    forgotten_restaurants: Array<RecentRegisteredRestaurant>;
    restaurant_count: number;
    review_count: number;
    monthly_visited_count: number;
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
    {categoryId, page = 1, search, sort}: {
        categoryId?: number | null;
        page?: number;
        search?: string;
        sort?: RestaurantSort
    } = {}
) => {
    const params = new URLSearchParams({page: String(page)})
    if (categoryId) params.set("category", String(categoryId))
    if (search) params.set("search", search)
    if (sort) params.set("sort", sort)

    const restaurantList = RESTAURANT_API.list
    return await apiRequest[restaurantList.method]<PaginatedResponse<RestaurantListItemType>>
    (`${restaurantList.endpoint({zone: zoneId})}?${params.toString()}`)
}

// 한 카테고리에서 음식점 하나를 뽑는다. 오래 안 간 곳·만족도 높은 곳일수록 잘 뽑힌다 (서버가 가중치 계산)
export const pickRestaurant = async (
    zoneId: number,
    {categoryId, includeDisappointing = false}: { categoryId?: number | null; includeDisappointing?: boolean } = {}
) => {
    const params = new URLSearchParams()
    if (categoryId) params.set("category", String(categoryId))
    if (includeDisappointing) params.set("exclude_disappointing", "0")

    const pick = RESTAURANT_API.pick
    return await apiRequest[pick.method]<{ restaurant: RestaurantListItemType | null }>(
        `${pick.endpoint({zone: zoneId})}?${params.toString()}`
    )
}
