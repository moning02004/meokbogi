import {ActionDrawer} from "@/components/ui/action_drawer";
import {FaAngleDown} from "react-icons/fa";
import {useAppRouter} from "@/components/navigation_progress";
import {ZONE_PAGE} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {ZoneType} from "@/types/zone";
import {useCategoryStore} from "@/store/category";

export const Topbar = () => {
    const router = useAppRouter()
    const zones = useZoneStore((state) => state.zones)
    const selectedZone = useZoneStore((state) => state.selectedZone)
    const setSelectedZone = useZoneStore((state) => state.setSelectedZone)
    const setCategories = useCategoryStore(state => state.setCategories)

    const changeZone = (zone: ZoneType) => {
        setSelectedZone(zone)
        setCategories(zone.category)
    }

    const gotoAddZone = () => {
        router.push(ZONE_PAGE.add)
    }

    return (
        <div className="shrink-0 flex items-center h-[60px] px-4">
            <ActionDrawer
                trigger={
                    // 장소 이름 자체가 제목이자 바꾸기 버튼
                    <button aria-label="장소 바꾸기"
                            className="flex items-center gap-1 h-11 px-1 rounded-xl cursor-pointer sm:hover:bg-fill-hover transition-colors">
                        <span className="text-[22px] font-extrabold tracking-tight text-ink">
                            {selectedZone ? selectedZone.name : "장소를 추가해서 시작해보세요."}
                        </span>
                        <FaAngleDown size={15} className="text-ink3"/>
                    </button>
                }
                items={
                    (zones ?? []).map((x) => ({
                        label: x.name,
                        onClick: () => changeZone(x),
                    }))
                }
                closeLabel={null}
                extraButton={
                    <button onClick={gotoAddZone}
                            className="w-full h-12 mt-1 rounded-xl text-center bg-fill sm:hover:bg-fill-hover cursor-pointer text-ink font-bold text-[14.5px] transition-colors">
                        장소 추가
                    </button>
                }
            />
        </div>
    )
}
