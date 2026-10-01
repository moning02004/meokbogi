export interface ZoneType {
    id: number;
    name: string;
    category: CategoryType[]
    latest_ordered_at: string | null
    // latest_ordered_at: string | null
}

export interface CategoryType {
    id: number;
    keyword: string;
}

// 카테고리 관리 화면에서만 쓰는, 음식점 개수가 붙은 형태
export interface ManagedCategoryType extends CategoryType {
    restaurant_count: number;
    // 이 카테고리만 붙은 음식점 수. 0이 아니면 지울 수 없다
    exclusive_restaurant_count: number;
}
