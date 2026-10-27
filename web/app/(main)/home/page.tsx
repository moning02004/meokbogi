"use client"

import {Suspense, useEffect, useState} from "react"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {toastError} from "@/lib/api";
import {syncZones} from "@/lib/zone";
import {RESTAURANT_PAGE, STATS_PAGE, ZONE_PAGE} from "@/constants/routeUrl";
import {MonthlyBars} from "@/components/chart/monthly_bars";
import {MonthlyVisit} from "@/lib/stats";
import {useZoneStore} from "@/store/zone";
import {daysSince} from "@/lib/date";
import {DeliciousRestaurant, RecentRegisteredRestaurant} from "@/types/restaurant";
import {categoryLabel, DashboardResponseType, fetchZoneDashboard} from "@/lib/restaurant";
import {BsForkKnife} from "react-icons/bs";
import {LuChevronRight} from "react-icons/lu";
import {useCategoryStore} from "@/store/category";
import {useAppRouter} from "@/components/navigation_progress";
import {getReviewTextBox} from "@/components/ui/review_textbox";

export default function Page() {
    const router = useAppRouter()

    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    // 존 목록을 다시 맞출 때 같은 존이어도 객체가 새로 들어오므로, 대시보드는 id가 바뀔 때만 다시 읽는다
    const selectedZoneId = selectedZone?.id
    const setCategories = useCategoryStore(state => state.setCategories)

    const [restaurantCount, setRestaurantCount] = useState(0)
    const [reviewCount, setReviewCount] = useState(0)
    const [monthlyVisitedCount, setMonthlyVisitedCount] = useState(0)
    const [monthlyVisits, setMonthlyVisits] = useState<MonthlyVisit[]>([])
    const [deliciousRestaurants, setDeliciousRestaurants] = useState<DeliciousRestaurant[]>([])
    const [recentRegisteredRestaurants, setRecentRegisteredRestaurants] = useState<RecentRegisteredRestaurant[]>([])
    const [forgottenRestaurants, setForgottenRestaurants] = useState<RecentRegisteredRestaurant[]>([])
    const [activeTab, setActiveTab] = useState<"delicious" | "recent" | "forgotten">("recent")

    // 홈에 올 때마다 존 목록을 새로 맞춘다. 다른 기기에서 지운 존이 선택돼 있으면 첫 번째 존으로 바뀐다.
    useEffect(() => {
        syncZones().then((rows) => {
            if (rows.length === 0) window.location.replace(ZONE_PAGE.add)
        }).catch((error) => toastError(error))
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
                setMonthlyVisits(res.monthly_visits ?? [])
            }
        ).catch((error) => toastError(error))
        return () => {
            ignore = true
        }
    }, [selectedZoneId, setCategories]);

    useEffect(() => {
        if (!token) window.location.href = "/login"
    }, [token])

    // 상세 화면 코드를 미리 받아 두어 누르면 바로 넘어가게 한다 (어느 음식점이든 같은 코드)
    const firstRestaurantId = (recentRegisteredRestaurants[0] ?? deliciousRestaurants[0] ?? forgottenRestaurants[0])?.id
    useEffect(() => {
        if (firstRestaurantId) router.prefetch(RESTAURANT_PAGE.detail(firstRestaurantId))
    }, [firstRestaurantId, router])

    const gotoRestaurant = (_id: number) => {
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    const RESTAURANT_TABS = [
        // 가장 자주 보는 탭이 앞. 이름은 짧게 해서 한 줄에 다 들어오게 한다
        {key: "recent" as const, label: "최근 먹은"},
        {key: "delicious" as const, label: "믿고 먹는"},
        {key: "forgotten" as const, label: "오랜만에 가볼 곳"},
    ]

    if (!selectedZone) return <LoadingPage/>
    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="px-4 pt-1 pb-4 flex flex-col gap-3 h-[100%]">

                {/* ---- 이번 달 기록 카드 ---- */}
                <section className="shrink-0 rounded-3xl bg-surface px-[22px] pt-[22px] pb-[18px] flex flex-col gap-[18px]">
                    {/* 누르면 통계 화면으로. 오른쪽은 최근 여섯 달의 흐름 */}
                    <button type="button" aria-label="통계 보기" onClick={() => router.push(STATS_PAGE)}
                            className="flex items-end justify-between gap-4 text-left cursor-pointer">
                        <span className="block min-w-0">
                            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink3">
                                <BsForkKnife size={13}/>
                                {selectedZone.name} 기록
                                <LuChevronRight size={15} className="text-ink4 -ml-0.5"/>
                            </span>
                            <span className="flex items-baseline gap-1 mt-2">
                                <span className="text-[44px] leading-none font-extrabold tracking-tight tabular-nums text-ink">
                                    {monthlyVisitedCount}
                                </span>
                                <span className="text-[20px] font-bold text-ink">번</span>
                                <span className="ml-1.5 text-[14px] font-semibold text-ink3 whitespace-nowrap">이번 달 주문</span>
                            </span>
                        </span>
                        {monthlyVisits.length > 0 && (
                            <span className="block w-[108px] shrink-0">
                                <MonthlyBars months={monthlyVisits} height={48} compact/>
                            </span>
                        )}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-fill px-3.5 py-3">
                            <p className="text-[12.5px] font-semibold text-ink3">등록한 음식점</p>
                            <p className="text-[18px] font-bold text-ink tabular-nums mt-0.5">{restaurantCount}곳</p>
                        </div>
                        <div className="rounded-2xl bg-fill px-3.5 py-3">
                            <p className="text-[12.5px] font-semibold text-ink3">작성한 리뷰</p>
                            <p className="text-[18px] font-bold text-ink tabular-nums mt-0.5">{reviewCount}개</p>
                        </div>
                    </div>
                </section>

                {/* ---- 보기 고르기 ---- */}
                <div className="shrink-0 grid grid-cols-3 gap-0.5 p-1 rounded-[14px] bg-fill-hover">
                    {RESTAURANT_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`h-10 rounded-[10px] whitespace-nowrap text-[13.5px] cursor-pointer transition-colors ${
                                activeTab === tab.key
                                    ? "bg-raise text-ink font-bold shadow-sm"
                                    : "text-ink3 font-semibold sm:hover:text-ink"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ---- 리스트 ---- */}
                <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-surface px-5 py-1.5">
                    {activeTab === "delicious" ? (

                        !deliciousRestaurants.length ? (
                                <p className="text-[13.5px] text-ink3 py-6 leading-relaxed">
                                    아직 믿고 먹는 음식점이 없습니다. <br/>
                                    2번 이상 방문하고 평균 만족도가 &lsquo;좋음&rsquo; 이상인 음식점이 믿고 먹는 음식점으로 선정됩니다.
                                </p>
                            ) :
                            deliciousRestaurants.map((restaurant) => {
                                const reviewTextBox = getReviewTextBox(restaurant.review_avg)

                                return (
                                    <div key={restaurant.id}
                                         onClick={() => gotoRestaurant(restaurant.id)}
                                         className="flex items-center justify-between gap-3 py-3.5 border-b border-line last:border-0 cursor-pointer">
                                        <div className="min-w-0">
                                            <p className="font-bold text-[16px] text-ink tracking-tight truncate">{restaurant.name}</p>
                                            <p className="text-[13px] text-ink3 mt-0.5">{`${categoryLabel(restaurant.categories)} 음식점`}</p>
                                        </div>
                                        {reviewTextBox}
                                    </div>
                                )
                            })
                    ) : (() => {
                        const rows = activeTab === "recent" ? recentRegisteredRestaurants : forgottenRestaurants
                        if (!rows.length) return (
                            <p className="text-[13.5px] text-ink3 py-6 text-center leading-relaxed">
                                {activeTab === "recent"
                                    ? "아직 등록된 음식점이 없습니다."
                                    : <>만족했지만 두 달 넘게 안 간 곳이 여기에 나와요.<br/>지금은 해당하는 곳이 없어요.</>}
                            </p>
                        )
                        return rows.map((restaurant) => (
                            <div key={restaurant.id}
                                 className="flex items-center justify-between gap-3 py-3.5 border-b border-line last:border-0 cursor-pointer"
                                 onClick={() => gotoRestaurant(restaurant.id)}
                            >
                                <div className="min-w-0">
                                    <p className="font-bold text-[16px] text-ink tracking-tight truncate">{restaurant.name}</p>
                                    <p className="text-[13px] text-ink3 mt-0.5 line-clamp-2">{restaurant.description || `${categoryLabel(restaurant.categories)} 음식점`}</p>
                                    <div className="flex flex-row mt-1 text-[13px] text-ink3">
                                        <span>방문 {restaurant.ordered_count} 회</span>
                                        <span className="inline-block mx-2">·</span>
                                        <span>
                                            {activeTab === "forgotten"
                                                ? `마지막 방문 ${daysSince(restaurant.latest_ordered_at)}일 전`
                                                : `최근 방문 ${restaurant.latest_ordered_at}`}
                                        </span>
                                    </div>
                                </div>
                                <LuChevronRight size={18} className="shrink-0 text-ink4"/>
                            </div>
                        ))
                    })()}
                </div>
            </div>
        </Suspense>
    )
}
