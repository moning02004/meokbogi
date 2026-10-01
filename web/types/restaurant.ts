import {CategoryType} from "@/types/zone";

export interface DeliciousRestaurant {
    id: number;
    name: string;
    ordered_count: number;
    review_avg: number;
    categories: CategoryType[];
}

export interface RecentRegisteredRestaurant {
    id: number;
    name: string;
    description: string;
    categories: CategoryType[];
    ordered_count: number;
    latest_ordered_at: string;
}

export interface BranchType {
    id: number;
    name: string;
    review_count: number;
}

export interface RestaurantReviewType {
    id: number;
    ordered_at: string;
    branch?: number | null;
    branch_name?: string;
    content: string;
    point: number;
    menu?: string;
}

export interface RestaurantType {
    id: number;
    name: string;
    description: string;
    address: string;
    categories: CategoryType[];
    latest_ordered_at: string | null;
    ordered_count: number;
    review_avg: number | null;
    review_set: RestaurantReviewType[];
    menu_summaries: MenuSummaryType[];   // 상세 응답에 포함 (?branch= 로 지점별)
    branches: BranchType[];
    menus: { menu: string; review_count: number }[];   // 브랜드 전체 메뉴 (지점 거르기와 무관)
    review_count: number;
}

// GET /zones/{zone}/restaurants (목록) 응답 하나의 모양. 상세(RestaurantType)와 필드명이 다르다
// (review_set 없음 등) 라서 따로 둔다.
export interface RestaurantListItemType {
    id: number;
    name: string;
    description: string;
    address: string;
    categories: CategoryType[];
    latest_ordered_at: string | null;
    ordered_count: number;
    review_avg: number | null;
}

export type RestaurantSort = "recent" | "rating" | "visits" | "name"

export interface MenuSummaryType {
    menu: string;
    review_count: number;
    review_avg: number;      // -1 | 0 | 1 (서버에서 계산한 통합 만족도)
    last_point: number;      // 이 메뉴의 가장 최근 만족도 ("또 먹었어요"에 그대로 쓴다)
    last_ordered_at: string;
    last_branch: number | null;   // 가장 최근 리뷰의 지점 ("또 먹었어요"에서 미리 고른다)
}
