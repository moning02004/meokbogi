import {apiRequest} from "@/lib/api";
import {ZONE_API} from "@/constants/routeUrl";

// "2026-10" 한 달의 방문 수. 같은 날 같은 음식점은 한 번으로 센다.
export interface MonthlyVisit {
    month: string;
    count: number;
}

export interface CategoryVisit {
    id: number;
    keyword: string;
    count: number;
}

export interface ZoneStatsResponse {
    months: MonthlyVisit[];        // 최근 12개월, 오래된 달부터
    categories: CategoryVisit[];   // 많이 간 순
    visit_count: number;
}

export const fetchZoneStats = (zoneId: number) => {
    const statsAPI = ZONE_API.stats
    return apiRequest[statsAPI.method]<ZoneStatsResponse>(statsAPI.endpoint({zone: zoneId}))
}

// "2026-10" → {year: 2026, month: 10}
export const parseMonth = (value: string) => {
    const [year, month] = value.split("-").map(Number)
    return {year, month}
}

// 한 번의 방문(같은 날 같은 음식점)과 그때 먹은 메뉴들
export interface DayVisit {
    restaurant: { id: number; name: string };
    menus: { menu: string; point: number; branch: string }[];
}

export interface MonthDay {
    date: string;        // "2026-10-12"
    visits: DayVisit[];
}

export interface ZoneMonthResponse {
    month: string;
    days: MonthDay[];    // 기록을 남긴 날만, 최근 날짜부터
}

export const fetchZoneMonth = (zoneId: number, month: string) => {
    const statsAPI = ZONE_API.stats
    return apiRequest[statsAPI.method]<ZoneMonthResponse>(`${statsAPI.endpoint({zone: zoneId})}/${month}`)
}
