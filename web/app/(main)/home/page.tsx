"use client"

import {Suspense, useEffect, useState} from "react"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {errorMessage} from "@/lib/api";
import {syncZones} from "@/lib/zone";
import {RESTAURANT_PAGE, ZONE_PAGE} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {daysSince} from "@/lib/date";
import toast from "react-hot-toast";
import {DeliciousRestaurant, RecentRegisteredRestaurant} from "@/types/restaurant";
import {DashboardResponseType, fetchZoneDashboard} from "@/lib/restaurant";
import {BsForkKnife} from "react-icons/bs";
import {useCategoryStore} from "@/store/category";
import {useRouter} from "next/navigation";
import {getReviewTextBox} from "@/components/ui/review_textbox";

export default function Page() {
    const router = useRouter()

    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    // 존 목록을 다시 맞출 때 같은 존이어도 객체가 새로 들어오므로, 대시보드는 id가 바뀔 때만 다시 읽는다
    const selectedZoneId = selectedZone?.id
    const setCategories = useCategoryStore(state => state.setCategories)

    const [restaurantCount, setRestaurantCount] = useState(0)
    const [reviewCount, setReviewCount] = useState(0)
    const [monthlyVisitedCount, setMonthlyVisitedCount] = useState(0)
    const [deliciousRestaurants, setDeliciousRestaurants] = useState<DeliciousRestaurant[]>([])
    const [recentRegisteredRestaurants, setRecentRegisteredRestaurants] = useState<RecentRegisteredRestaurant[]>([])
    const [forgottenRestaurants, setForgottenRestaurants] = useState<RecentRegisteredRestaurant[]>([])
    const [activeTab, setActiveTab] = useState<"delicious" | "recent" | "forgotten">("delicious")

    // 홈에 올 때마다 존 목록을 새로 맞춘다. 다른 기기에서 지운 존이 선택돼 있으면 첫 번째 존으로 바뀐다.
    useEffect(() => {
        syncZones().then((rows) => {
            if (rows.length === 0) window.location.replace(ZONE_PAGE.add)
        }).catch((error) => toast.error(errorMessage(error)))
    }, []);

    useEffect(() => {
        if (!selectedZoneId) return
        // 존을 빠르게 바꾸면 이전 존의 응답이 늦게 도착해 덮어쓸 수 있으므로 무시한다
        let ignore = false

        fetchZoneDashboard(selectedZoneId).then((res: DashboardResponseType) => {
                if (ignore) return
                setCategories(res.category)
                setDeliciousRestaurants(res.delicious_restaurants)
                setRecentRegisteredRestaurants(res.recent_restaurants)
                setForgottenRestaurants(res.forgotten_restaurants ?? [])
                setRestaurantCount(res.restaurant_count)
                setReviewCount(res.review_count)
                setMonthlyVisitedCount(res.monthly_visited_count)
            }
        ).catch((error) => toast.error(errorMessage(error)))
        return () => {
            ignore = true
        }
    }, [selectedZoneId, setCategories]);

    useEffect(() => {
        if (!token) window.location.href = "/login"
    }, [token])

    const gotoRestaurant = (_id: number) => {
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    const RESTAURANT_TABS = [
        {key: "delicious" as const, label: "믿고 먹는 음식점"},
        {key: "recent" as const, label: "최근 먹었던 음식점"},
        {key: "forgotten" as const, label: "오랜만에 가볼 곳"},
    ]

    if (!selectedZone) return <LoadingPage/>
    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="p-4 flex flex-col gap-3 h-[100%]">

                {/* ---- 계기판 스타일 통계 카드 ---- */}
                <div
                    className="rounded-[22px] bg-[#17372F] px-5 pt-5 pb-4 mb-3 text-[#EFF4F1] relative">
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
                            <p className="text-[11.5px] font-medium text-[#9FB6AE] mt-2">등록한 음식점</p>
                        </div>
                        <div
                            className="flex-1 text-center relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-2.5 before:w-px before:bg-white/[0.14]">
                            <div
                                className="mx-3.5 font-mono text-[34px] font-semibold rounded-[10px] py-1.5 bg-white/[0.06] border border-white/[0.12]">
                                {String(reviewCount).padStart(2, "0")}
                            </div>
                            <p className="text-[11.5px] font-medium text-[#9FB6AE] mt-2">작성한 리뷰</p>
                        </div>
                        <div
                            className="flex-1 text-center relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-2.5 before:w-px before:bg-white/[0.14]">
                            <div
                                className="mx-3.5 font-mono text-[34px] font-semibold rounded-[10px] py-1.5 bg-white/[0.06] border border-white/[0.12]">
                                {String(monthlyVisitedCount).padStart(2, "0")}
                            </div>
                            <p className="text-[11.5px] font-medium text-[#9FB6AE] mt-2">이번 달 주문</p>
                        </div>
                    </div>
                </div>

                {/* ---- 필터 pill ---- */}
                <div className="flex gap-2 overflow-x-auto shrink-0 -mx-4 px-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {RESTAURANT_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-[13.5px] font-semibold border cursor-pointer transition-colors ${
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
                <div className="flex flex-col gap-2.5 overflow-y-auto h-[100%] pb-4">
                    {activeTab === "delicious" ? (

                        !deliciousRestaurants.length ? (
                                <p className="text-sm text-[#8A8172] py-4">
                                    아직 믿고 먹는 음식점이 없습니다. <br/>
                                    2번 이상 방문하고 평균 만족도가 &lsquo;좋음&rsquo; 이상인 음식점이 믿고 먹는 음식점으로 선정됩니다.
                                </p>
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
                    ) : (() => {
                        const rows = activeTab === "recent" ? recentRegisteredRestaurants : forgottenRestaurants
                        if (!rows.length) return (
                            <p className="text-sm text-[#8A8172] py-4 text-center leading-relaxed">
                                {activeTab === "recent"
                                    ? "아직 등록된 음식점이 없습니다."
                                    : <>만족했지만 두 달 넘게 안 간 곳이 여기에 나와요.<br/>지금은 해당하는 곳이 없어요.</>}
                            </p>
                        )
                        return rows.map((restaurant) => (
                            <div key={restaurant.id}
                                 className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E7E0CF] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors"
                                 onClick={() => gotoRestaurant(restaurant.id)}
                            >
                                <div>
                                    <p className="font-bold text-[15.5px] text-[#211D17] tracking-tight">{restaurant.name}</p>
                                    <p className="text-[12.5px] text-[#8A8172] mt-0.5">{restaurant.description || `${restaurant.category_name} 음식점`}</p>
                                    <div className="flex flex-row mt-1 text-[12.5px] text-[#8A8172]">
                                        <span>방문 {restaurant.ordered_count} 회</span>
                                        <span className="inline-block mx-2">·</span>
                                        <span>
                                            {activeTab === "forgotten"
                                                ? `마지막 방문 ${daysSince(restaurant.latest_ordered_at)}일 전`
                                                : `최근 방문 ${restaurant.latest_ordered_at}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    })()}
                </div>
            </div>
        </Suspense>
    )
}