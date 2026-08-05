import {create} from "zustand"
import {CategoryType, ZoneType} from "@/types/zone";
import {createJSONStorage, persist} from "zustand/middleware";


interface ZoneState {
    zones: Array<ZoneType>
    setZones: (zones: Array<ZoneType>) => void

    selectedZone: ZoneType | null
    setSelectedZone: (selectedZone: ZoneType) => void

    clear: () => void
}

export const useZoneStore = create<ZoneState>()(
    persist(
        (set) => ({
            zones: [],
            setZones: (zones) => set({zones}),
            selectedZone: null,
            setSelectedZone: (selectedZone) => set({selectedZone}),

            clear: () => {
                set({zones: [], selectedZone: null});
                useZoneStore.persist.clearStorage();
            }
        }),
        {
            name: 'zones',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
