export interface DeliciousRestaurant {
    id: number;
    name: string;
    ordered_count: number;
    review_avg: number;
    category_name: string;
}

export interface RecentRegisteredRestaurant {
    id: number;
    name: string;
    description: string;
    category_name: string;
    ordered_count: number;
    latest_ordered_at: string;
}

export interface RestaurantReviewType {
    id: number;
    ordered_at: string;
    content: string;
    point: number;
    menu?: string;
}

export interface RestaurantType {
    id: number;
    name: string;
    description: string;
    address: string;
    category_name: string;
    latest_ordered_at: string | null;
    ordered_count: number;
    review_avg: number | null;
    review_set: RestaurantReviewType[];
    menu_summaries: MenuSummaryType[];   // 상세 응답에 포함
    review_count: number;
}

// GET /zones/{zone}/restaurants (목록) 응답 하나의 모양. 상세(RestaurantType)와 필드명이 다르다
// (category vs category_name, review_set 없음 등) 라서 따로 둔다.
export interface RestaurantListItemType {
    id: number;
    name: string;
    description: string;
    address: string;
    category_name: string;
    latest_ordered_at: string | null;
    ordered_count: number;
    review_avg: number | null;
}

export interface MenuSummaryType {
    menu: string;
    review_count: number;
    review_avg: number;      // -1 | 0 | 1 (서버에서 계산한 통합 만족도)
}
