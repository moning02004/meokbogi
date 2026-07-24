import {create} from "zustand"
import {CategoryType, ZoneType} from "@/types/zone";
import {createJSONStorage, persist} from "zustand/middleware";


interface ZoneState {
    zones: Array<ZoneType>
    setZones: (zones: Array<ZoneType>) => void

    selectedZone: ZoneType | null
    setSelectedZone: (selectedZone: ZoneType) => void
}

export const useZoneStore = create<ZoneState>()(
    persist(
        (set) => ({
            zones: [],
            setZones: (zones) => set({zones}),
            selectedZone: null,
            setSelectedZone: (selectedZone) => set({selectedZone}),
        }),
        {
            name: 'zones',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
