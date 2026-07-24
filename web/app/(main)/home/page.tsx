"use client"

import {Suspense, useEffect, useState} from "react"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {apiRequest} from "@/lib/api";
import {RESTAURANT_PAGE, ZONE_API} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {ZoneType} from "@/types/zone";
import {DeliciousRestaurant, RecentRegisteredRestaurant} from "@/types/restaurant";
import {DashboardResponseType, fetchZoneDashboard} from "@/lib/restaurant";
import {BsForkKnife} from "react-icons/bs";
import {useCategoryStore} from "@/store/category";
import {useRouter} from "next/navigation";
import {getReviewTextBox} from "@/components/ui/review_textbox";


export default function Page() {
    const router = useRouter()

    const {token} = useAuthStore.getState()
    const {setZones, setSelectedZone} = useZoneStore.getState();
    const selectedZone = useZoneStore(state => state.selectedZone)
    const setCategories = useCategoryStore(state => state.setCategories)

    const [restaurantCount, setRestaurantCount] = useState(0)
    const [reviewCount, setReviewCount] = useState(0)
    const [deliciousRestaurants, setDeliciousRestaurants] = useState<DeliciousRestaurant[]>([])
    const [recentRegisteredRestaurants, setRecentRegisteredRestaurants] = useState<RecentRegisteredRestaurant[]>([])
    const [activeTab, setActiveTab] = useState<"delicious" | "recent">("delicious")

    useEffect(() => {
        apiRequest[ZONE_API.list.method]<{ results: ZoneType[] }>(ZONE_API.list.endpoint)
            .then((response: { results: ZoneType[] }) => {
                if (response.results) {
                    setZones(response.results)
                    if (!selectedZone) {
                        setSelectedZone(response.results[0])
                    }
                }
            })
    }, []);

    useEffect(() => {
        if (!selectedZone) return

        fetchZoneDashboard(selectedZone.id).then((res: DashboardResponseType) => {
                setCategories(res.category)
                setDeliciousRestaurants(res.delicious_restaurants)
                setRecentRegisteredRestaurants(res.recent_restaurants)
                setRestaurantCount(res.restaurant_count)
                setReviewCount(res.review_count)
            }
        )
    }, [selectedZone]);

    useEffect(() => {
        if (!token) window.location.href = "/login"
    }, [token])

    const gotoRestaurant = (_id: number) => {
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    const RESTAURANT_TABS = [
        {key: "delicious" as const, label: "믿고 먹는 식당"},
        {key: "recent" as const, label: "최근 먹었던 식당"},
    ]

    if (!selectedZone) return <LoadingPage/>
    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="p-4 flex flex-col gap-3 min-h-screen">

                {/* ---- 계기판 스타일 통계 카드 ---- */}
                <div
                    className="rounded-[22px] bg-[#17372F] px-5 pt-5 pb-4 mb-3 text-[#EFF4F1] relative overflow-hidden">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#B9CFC8] mb-4">
                        <BsForkKnife size={13}/>
                        {selectedZone.name} 기록
                    </div>
                    <div className="flex">
                        <div className="flex-1 text-center relative">
                            <div
                                className="mx-3.5 font-mono text-[34px] font-semibold rounded-[10px] py-1.5 bg-white/[0.06] border border-white/[0.12]">
                                {String(restaurantCount).padStart(2, "0")}
                            </div>
                            <p className="text-[11.5px] font-medium text-[#9FB6AE] mt-2">등록한 식당</p>
                        </div>
                        <div
                            className="flex-1 text-center relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-2.5 before:w-px before:bg-white/[0.14]">
                            <div
                                className="mx-3.5 font-mono text-[34px] font-semibold rounded-[10px] py-1.5 bg-white/[0.06] border border-white/[0.12]">
                                {String(reviewCount).padStart(2, "0")}
                            </div>
                            <p className="text-[11.5px] font-medium text-[#9FB6AE] mt-2">작성한 리뷰</p>
                        </div>
                    </div>
                </div>

                {/* ---- 필터 pill ---- */}
                <div className="flex gap-2">
                    {RESTAURANT_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-full text-[13.5px] font-semibold border cursor-pointer transition-colors ${
                                activeTab === tab.key
                                    ? "bg-[#24564A] text-white border-[#24564A]"
                                    : "bg-white text-[#8A8172] border-[#E7E0CF] sm:hover:bg-[#F6F3EC]"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ---- 리스트 ---- */}
                <div className="flex flex-col gap-2.5">
                    {activeTab === "delicious" ? (

                        !deliciousRestaurants.length ? (
                                <p className="text-sm text-[#8A8172] py-4 text-center">아직 등록된 식당이 없습니다.</p>
                            ) :
                            deliciousRestaurants.map((restaurant) => {
                                const reviewTextBox = getReviewTextBox(restaurant.review_avg)

                                return (
                                    <div key={restaurant.id}
                                         onClick={() => gotoRestaurant(restaurant.id)}
                                         className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E7E0CF] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors">
                                        <div>
                                            <p className="font-bold text-[15.5px] text-[#211D17] tracking-tight">{restaurant.name}</p>
                                            <p className="text-[12.5px] text-[#8A8172] mt-0.5">{`${restaurant.category_name} 음식점`}</p>
                                        </div>
                                        {reviewTextBox}
                                    </div>
                                )
                            })
                    ) : (
                        !recentRegisteredRestaurants.length ? (
                                <p className="text-sm text-[#8A8172] py-4 text-center">아직 등록된 식당이 없습니다.</p>
                            ) :
                            recentRegisteredRestaurants.map((restaurant) => (
                                <div key={restaurant.id}
                                     className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E7E0CF] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors"
                                     onClick={() => gotoRestaurant(restaurant.id)}
                                >
                                    <div>
                                        <p className="font-bold text-[15.5px] text-[#211D17] tracking-tight">{restaurant.name}</p>
                                        <p className="text-[12.5px] text-[#8A8172] mt-0.5">{restaurant.description || `${restaurant.category_name} 음식점`}</p>
                                        <div className="flex flex-row mt-1">
                                            <div
                                                className="text-[12.5px] text-[#8A8172]">방문 {restaurant.ordered_count} 회
                                            </div>
                                            <span className="inline-block mx-2 text-[#8A8172]">·</span>
                                            <div className="text-[12.5px] text-[#8A8172]">최근
                                                방문 {restaurant.latest_ordered_at}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </Suspense>
    )
}