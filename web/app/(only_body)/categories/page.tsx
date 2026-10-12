"use client"

import {useRouter} from "next/navigation"
import {FaArrowLeft} from "react-icons/fa"

import {CategoryManager} from "@/components/settings/category_manager"
import {syncZones} from "@/lib/zone"

// 카테고리별로 어느 장소에 어떤 음식점이 있는지 보는 페이지 (내정보 → 카테고리별 음식점)
export default function Page() {
    const router = useRouter()

    return (
        <div className="min-h-[100%] bg-surface pb-10">
            <div className="flex items-center gap-1 h-14 px-2">
                <button onClick={() => router.back()} aria-label="뒤로" className="w-11 h-11 flex items-center justify-center rounded-full text-ink cursor-pointer sm:hover:bg-fill transition-colors">
                    <FaArrowLeft size={16}/>
                </button>
                <h1 className="text-[17px] font-bold text-ink">카테고리별 음식점</h1>
            </div>
            <div className="px-5 pt-2">
                <CategoryManager onCategoriesChange={(_, mutated) => {
                    // 상단바·음식점 필터·뽑기가 쓰는 전역 카테고리 목록도 맞춘다
                    if (mutated) syncZones().catch(() => null)
                }}/>
            </div>
        </div>
    )
}
