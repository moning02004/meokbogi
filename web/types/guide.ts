// 먹골목의 골목 하나 (GET /guides 의 한 줄)
export interface GuideType {
    id: number;
    title: string;
    intro: string;
    edition: string;          // "2026 가을" 같은 판 이름. 비어 있을 수 있다
    grade: 0 | 1 | 2 | 3;     // 추천 등급: 숟가락 개수. 0은 등급 없음
    show_address: boolean;
    show_visits: boolean;
    share_token: string | null;   // 있으면 공개 중
    entry_count: number;
    updated_at: string;
}

// 골목에 실린 집의 음식점 정보. 꾸미기 화면에서 고를 수 있는 지점·메뉴까지 들어 있다.
export interface GuideRestaurantType {
    id: number;
    name: string;
    zone: string;
    description: string;
    address: string;
    categories: string[];
    branches: { id: number; name: string }[];
    menus: { menu: string; review_count: number }[];   // 많이 먹은 순
}

export interface GuideEntryType {
    id: number;
    restaurant: GuideRestaurantType;
    branch: number | null;
    comment: string;
    menus: string[];
    visit_count: number;
}

export interface GuideDetailType extends GuideType {
    entries: GuideEntryType[];
}

// 공개 화면(GET /public/guides/{token})이 받는 모양. 주소·주문 횟수는 골목 설정에 따라 아예 오지 않는다.
export interface PublicGuideEntryType {
    name: string;
    categories: string[];
    branch: string;
    comment: string;
    menus: string[];
    address?: string;
    visit_count?: number;
    first_ordered_month?: string | null;   // "2024-11"
}

export interface PublicGuideType {
    title: string;
    intro: string;
    edition: string;
    grade: number;
    grade_label: string;      // 숟가락 개수가 뜻하는 말. 등급이 없으면 빈 값
    entries: PublicGuideEntryType[];
}
