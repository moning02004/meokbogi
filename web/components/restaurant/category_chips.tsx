import {CategoryType} from "@/types/zone"

interface CategoryChipsProps {
    categories: CategoryType[]
    selected: number[]
    onChange: (selected: number[]) => void
    labelledBy?: string
}

// 음식점에 붙일 카테고리 고르기. 여러 개를 고를 수 있다 (분식 + 돈까스 파는 김밥집).
export function CategoryChips({categories, selected, onChange, labelledBy}: CategoryChipsProps) {
    const toggle = (id: number) => {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
    }

    return (
        <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
            {categories.map((category) => {
                const active = selected.includes(category.id)
                return (
                    <button
                        key={category.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggle(category.id)}
                        className={`px-3 py-1.5 rounded-full text-[13px] font-bold border cursor-pointer transition-colors ${
                            active
                                ? "bg-[#24564A] text-white border-[#24564A]"
                                : "bg-white text-[#8A8172] border-[#E7E0CF] sm:hover:bg-[#F6F3EC]"
                        }`}
                    >
                        {category.keyword}
                    </button>
                )
            })}
        </div>
    )
}
