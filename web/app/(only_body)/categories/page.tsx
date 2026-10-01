"use client"

import {useRouter} from "next/navigation"
import {FaArrowLeft} from "react-icons/fa"

import {CategoryManager} from "@/components/settings/category_manager"
import {syncZones} from "@/lib/zone"

// 카테고리별로 어느 장소에 어떤 음식점이 있는지 보는 페이지 (내정보 → 카테고리별 음식점)
export default function Page() {
    const router = useRouter()

    return (
        <div className="min-h-[100%] bg-white pb-10">
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[#E7E0CF]">
                <button onClick={() => router.back()} aria-label="뒤로" className="text-[#211D17] cursor-pointer p-2.5 -m-2.5">
                    <FaArrowLeft size={16}/>
                </button>
                <h1 className="text-[15px] font-bold text-[#211D17]">카테고리별 음식점</h1>
            </div>
            <div className="px-5 pt-4">
                <CategoryManager onCategoriesChange={(_, mutated) => {
                    // 상단바·음식점 필터·뽑기가 쓰는 전역 카테고리 목록도 맞춘다
                    if (mutated) syncZones().catch(() => null)
                }}/>
            </div>
        </div>
    )
}
