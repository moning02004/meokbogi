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


export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()

    const selectedZone = useZoneStore(state => state.selectedZone)
    const allCategories = useCategoryStore(state => state.categories)
        .map(x => x.keyword)
    const categoryInfo = Object.fromEntries(useCategoryStore(state => state.categories)
        .map(item => [item.keyword, item.id]));

    const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
    const [restaurants, setRestaurants] = useState<RecentRegisteredRestaurant[]>([])

    useEffect(() => {
        if (!selectedZone || !selectedCategory) return;

        const fetchCategoryRestaurants = async () => {
            const params = `category=${selectedCategory}`

            const restaurantList = RESTAURANT_API.list
            await apiRequest[restaurantList.method]<PaginatedResponse<RecentRegisteredRestaurant>>(
                `${restaurantList.endpoint({zone: selectedZone.id})}?${params.toString()}`).then(
                (response) => {
                    console.log(response.results)
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
            <div className="min-h-screen pb-6">

                <div className="text-center text-[19px] font-bold text-[#211D17] tracking-tight pt-9 mb-5">
                    메뉴 <span className="text-[#D2571E]">골라드릴까요</span>?
                </div>

                <FoodCardShuffle categoryInfo={categoryInfo}
                                 items={allCategories}
                                 setSelectedCategory={setSelectedCategory}/>

                {restaurants.length > 0 && (
                    <div className="mx-1">
                        <div className="text-stone-500 mb-1 mt-3 text-sm">음식점 목록</div>

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
                    </div>
                )}
            </div>
        </Suspense>
    )
}