import {ActionDrawer} from "@/components/ui/action_drawer";
import {FaAngleDown} from "react-icons/fa";
import {useRouter} from "next/navigation";
import {ZONE_PAGE} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {ZoneType} from "@/types/zone";
import {useCategoryStore} from "@/store/category";

export const Topbar = () => {
    const router = useRouter()
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
        <div className="flex justify-between items-center bg-white border-b border-[#E7E0CF] h-[7vh] px-4">
            <div>
                <div className="text-[11px] font-semibold tracking-[0.14em] text-[#B7AF9F] uppercase mb-0.5">
                    ZONE
                </div>
                <div className="text-[19px] font-extrabold tracking-tight text-[#211D17]">
                    {selectedZone ? selectedZone.name : "장소를 추가해서 시작해보세요."}
                </div>
            </div>

            <ActionDrawer
                trigger={
                    <button className="w-8 h-8 rounded-full bg-[#E4EEEA] text-[#24564A] flex items-center justify-center cursor-pointer sm:hover:bg-[#d7e6df] transition-colors">
                        <FaAngleDown size={15}/>
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
                            className="w-full p-3 text-center hover:bg-[#efefef] rounded cursor-pointer text-[#D2571E] font-bold text-md">
                        장소 추가
                    </button>
                }
            />
        </div>
    )
}