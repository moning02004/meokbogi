import {apiRequest} from "@/lib/api";
import {ZONE_API} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {useCategoryStore} from "@/store/category";
import {ZoneType} from "@/types/zone";

// 서버의 존 목록으로 전역 상태를 맞춘다.
// 선택된 존이 (다른 기기·탭에서) 지워졌으면 첫 번째 존으로 바꾸고, 카테고리도 그 존 기준으로 다시 채운다.
// zone 목록은 페이지네이션 응답이다.
export const syncZones = async (): Promise<ZoneType[]> => {
    const list = ZONE_API.list
    const response = await apiRequest[list.method]<{ results: ZoneType[] }>(list.endpoint)
    const rows = response.results

    const zoneStore = useZoneStore.getState()
    const categoryStore = useCategoryStore.getState()
    if (rows.length === 0) {
        zoneStore.clear()
        categoryStore.clear()
        return rows
    }

    zoneStore.setZones(rows)
    const current = rows.find((zone) => zone.id === zoneStore.selectedZone?.id) ?? rows[0]
    zoneStore.setSelectedZone(current)
    categoryStore.setCategories(current.category)
    return rows
}
