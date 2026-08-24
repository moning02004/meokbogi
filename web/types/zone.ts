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
}
