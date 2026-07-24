import {create} from "zustand"
import {CategoryType} from "@/types/zone";
import {createJSONStorage, persist} from "zustand/middleware";


interface CategoryState {
    categories: Array<CategoryType>
    setCategories: (categories: Array<CategoryType>) => void

}

export const useCategoryStore = create<CategoryState>()(
    persist(
        (set) => ({
            categories: [],
            setCategories: (categories) => set({categories}),
        }),
        {
            name: 'category',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
