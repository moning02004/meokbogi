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
