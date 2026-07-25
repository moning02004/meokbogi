"use client"

import {Suspense, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import FoodCardShuffle from "@/components/play/shuffle_card";
import {RESTAURANT_API, RESTAURANT_PAGE} from "@/constants/routeUrl";
import {useCategoryStore} from "@/store/category";
import {RecentRegisteredRestaurant} from "@/types/restaurant";
import {apiRequest} from "@/lib/api";
import {PaginatedResponse} from "@/lib/restaurant";
import {useZoneStore} from "@/store/zone";
import {FiArrowUpRight} from "react-icons/fi";


export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()

    const selectedZone = useZoneStore(state => state.selectedZone)
    const allCategories = useCategoryStore(state => state.categories)
        .map(x => x.keyword)
    const categoryInfo = Object.fromEntries(useCategoryStore(state => state.categories)
        .map(item => [item.keyword, item.id]));

    const [selectedCategory, setSelectedCategory] = useState<number | null>(null)

    const idToName = Object.fromEntries(
        Object.entries(categoryInfo).map(([name, id]) => [id, name])
    )
    const selectedCategoryName = selectedCategory ? idToName[selectedCategory] ?? "" : ""
    const [restaurants, setRestaurants] = useState<RecentRegisteredRestaurant[]>([])

    useEffect(() => {
        if (!selectedZone || !selectedCategory) return;

        const fetchCategoryRestaurants = async () => {
            const params = `category=${selectedCategory}`

            const restaurantList = RESTAURANT_API.list
            await apiRequest[restaurantList.method]<PaginatedResponse<RecentRegisteredRestaurant>>(
                `${restaurantList.endpoint({zone: selectedZone.id})}?${params.toString()}`).then(
                (response) => {
                    setRestaurants(response.results)
                }
            )
        }

        fetchCategoryRestaurants()
    }, [selectedCategory]);

    useEffect(() => {
        if (!token) window.location.href = "/login"
    }, [token])

    const gotoRestaurant = (_id: number) => {
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="min-h-[100%] bg-white pb-6">
                <FoodCardShuffle categoryInfo={categoryInfo}
                                 items={allCategories}
                                 setSelectedCategory={setSelectedCategory}/>

                {/* ---- 결과가 나온 뒤에만 목록 영역 표시 ---- */}
                {selectedCategory && (
                    <div className="px-5 mt-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase">
                                {selectedCategoryName || "음식점"} 음식점
                            </div>
                            {restaurants.length > 0 && (
                                <div className="text-[11px] font-bold text-[#D2571E]">{restaurants.length}</div>
                            )}
                        </div>

                        {restaurants.length === 0 ? (
                            <div className="bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-5 py-6 text-center">
                                <div className="text-[13px] text-[#8A8172] font-semibold leading-relaxed mb-4">
                                    앗, 아직 등록된 {selectedCategoryName} 음식점이 없어요.<br/>
                                    이번 기회에 한 곳 추가해볼까요?
                                </div>
                                <button
                                    onClick={() => router.push(RESTAURANT_PAGE.add)}
                                    className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-white bg-[#D2571E] rounded-xl px-4 py-2.5 cursor-pointer active:scale-[0.98] transition-transform"
                                >
                                    <FiArrowUpRight size={15}/>
                                    음식점 추가하기
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {restaurants.map((restaurant) => (
                                    <div key={restaurant.id}
                                         className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E7E0CF] bg-white cursor-pointer sm:hover:bg-[#FAF8F2] transition-colors"
                                         onClick={() => gotoRestaurant(restaurant.id)}
                                    >
                                        <div>
                                            <p className="font-bold text-[15.5px] text-[#211D17] tracking-tight">{restaurant.name}</p>
                                            <p className="text-[12.5px] text-[#8A8172] mt-0.5">{restaurant.description || `${restaurant.category_name} 음식점`}</p>
                                            <div className="flex flex-row mt-1">
                                                <div
                                                    className="text-[12px] text-[#B7AF9F] font-medium">방문 {restaurant.ordered_count} 회
                                                </div>
                                                {restaurant.latest_ordered_at && (
                                                    <>
                                                        <span className="inline-block mx-2 text-[#B7AF9F]">·</span>
                                                        <div className="text-[12px] text-[#B7AF9F] font-medium">최근
                                                            방문 {restaurant.latest_ordered_at}</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Suspense>
    )
}