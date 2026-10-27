"use client"

import {useEffect, useState} from "react"
import {useAppRouter} from "@/components/navigation_progress";
import {FaArrowLeft} from "react-icons/fa"

import {MonthCalendar} from "@/components/chart/month_calendar"
import {MonthlyBars} from "@/components/chart/monthly_bars"
import {RankBars} from "@/components/chart/rank_bars"
import {LoadingPage} from "@/components/loading"
import {toastError} from "@/lib/api"
import {RESTAURANT_PAGE} from "@/constants/routeUrl"
import {getReviewTextBox} from "@/components/ui/review_textbox"
import {parseLocalDate, today} from "@/lib/date"
import {fetchZoneMonth, fetchZoneStats, MonthDay, parseMonth, ZoneStatsResponse} from "@/lib/stats"
import {useAuthStore} from "@/store/auth"
import {useZoneStore} from "@/store/zone"

// 카테고리가 많으면 아래쪽은 한 줄로 묶는다
const TOP_CATEGORIES = 8

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

// "치킨을" / "피자를". 한글로 끝나지 않으면 둘 다 적는다.
const objectParticle = (word: string) => {
    const code = word.charCodeAt(word.length - 1) - 0xAC00
    if (code < 0 || code > 11171) return "을(를)"
    return code % 28 === 0 ? "를" : "을"
}

export default function Page() {
    const router = useAppRouter()
    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    const selectedZoneId = selectedZone?.id

    // 어느 장소의 통계인지 함께 들고 있어, 장소를 바꾼 직후 이전 장소의 차트가 보이지 않게 한다
    const [loaded, setLoaded] = useState<{ zoneId: number; stats: ZoneStatsResponse } | null>(null)
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
    // 고른 달의 기록. key로 어느 장소·어느 달 것인지 구분해 늦게 온 응답이 섞이지 않게 한다
    const [monthDetail, setMonthDetail] = useState<{ key: string; days: MonthDay[] } | null>(null)
    const [selectedDay, setSelectedDay] = useState<string | null>(null)

    useEffect(() => {
        if (!token) router.replace("/login")
    }, [token, router])

    useEffect(() => {
        if (!selectedZoneId) return
        let ignore = false

        fetchZoneStats(selectedZoneId).then((stats) => {
            if (ignore) return
            setLoaded({zoneId: selectedZoneId, stats})
            setSelectedMonth(null)
        }).catch((error) => toastError(error))
        return () => {
            ignore = true
        }
    }, [selectedZoneId])

    const stats = loaded && loaded.zoneId === selectedZoneId ? loaded.stats : null
    const activeMonth = stats?.months.find((row) => row.month === selectedMonth) ?? stats?.months[stats.months.length - 1]
    const activeMonthKey = activeMonth?.month
    const detailKey = `${selectedZoneId}:${activeMonthKey}`
    // 처음 열 때는 통계를 기다리지 않고 이번 달 기록을 함께 받는다 (요청 두 개를 차례로 보내지 않게).
    // 자정 무렵 기기 시간대가 달라 서버의 마지막 달과 어긋나면 통계가 온 뒤 그 달로 다시 받는다.
    const fetchMonthKey = activeMonthKey ?? today().slice(0, 7)

    useEffect(() => {
        if (!selectedZoneId) return
        let ignore = false

        fetchZoneMonth(selectedZoneId, fetchMonthKey).then((res) => {
            if (!ignore) setMonthDetail({key: `${selectedZoneId}:${fetchMonthKey}`, days: res.days})
        }).catch((error) => toastError(error))
        return () => {
            ignore = true
        }
    }, [selectedZoneId, fetchMonthKey])

    if (!token || !selectedZone) return <LoadingPage/>

    const days = monthDetail?.key === detailKey ? monthDetail.days : null
    const dayCounts = Object.fromEntries((days ?? []).map((day) => [day.date, day.visits.length]))
    // 달을 바꾸면 이전 달에서 고른 날짜는 버린다
    const activeDay = selectedDay && dayCounts[selectedDay] ? selectedDay : null
    const listedDays = (days ?? []).filter((day) => !activeDay || day.date === activeDay)
    const activeMonthNumber = activeMonth ? parseMonth(activeMonth.month).month : 0
    const monthVisitCount = (days ?? []).reduce((sum, day) => sum + day.visits.length, 0)

    const categories = stats?.categories ?? []
    const top = categories.slice(0, TOP_CATEGORIES)
    const rest = categories.slice(TOP_CATEGORIES)
    const categoryRows = [
        ...top.map((row) => ({key: row.id, label: row.keyword, count: row.count})),
        ...(rest.length ? [{
            key: "rest",
            label: `그 외 ${rest.length}개`,
            count: rest.reduce((sum, row) => sum + row.count, 0),
        }] : []),
    ]

    return (
        <div className="px-4 pb-4 flex flex-col gap-3">
            <div className="flex items-center gap-1 h-11 -ml-2">
                <button aria-label="홈으로" onClick={() => router.push("/home")}
                        className="w-11 h-11 flex items-center justify-center rounded-full text-ink cursor-pointer sm:hover:bg-fill-hover transition-colors">
                    <FaArrowLeft size={16}/>
                </button>
                <h1 className="text-[17px] font-bold text-ink">통계</h1>
                <span className="ml-auto text-[13px] font-semibold text-ink3">최근 12개월</span>
            </div>

            {!stats || !activeMonth ? (
                <>
                    <div className="h-[280px] rounded-3xl bg-surface animate-pulse"/>
                    <div className="h-[220px] rounded-3xl bg-surface animate-pulse"/>
                </>
            ) : stats.visit_count === 0 ? (
                <div className="rounded-3xl bg-surface px-5 py-10 text-center text-[13.5px] text-ink3 leading-relaxed">
                    최근 12개월 동안 남긴 기록이 없어요.<br/>먹은 메뉴를 기록하면 여기에 차트가 그려져요.
                </div>
            ) : (
                <>
                    <section aria-labelledby="stats-monthly" className="rounded-3xl bg-surface px-5 pt-5 pb-4">
                        <h2 id="stats-monthly" className="text-[14px] font-semibold text-ink3">월별 주문</h2>
                        <p className="mt-1.5 flex items-baseline gap-1.5" aria-live="polite">
                            <span className="text-[30px] leading-none font-extrabold tracking-tight tabular-nums text-ink">
                                {activeMonth.count}번
                            </span>
                            <span className="text-[14px] font-semibold text-ink3">
                                {parseMonth(activeMonth.month).year}년 {parseMonth(activeMonth.month).month}월
                            </span>
                        </p>
                        <div className="mt-4">
                            <MonthlyBars months={stats.months} selected={activeMonth.month} onSelect={setSelectedMonth}/>
                        </div>
                        <p className="mt-3 text-[12px] text-ink3">막대를 누르면 아래에 그 달의 기록이 나와요.</p>
                    </section>

                    <section aria-labelledby="stats-days" className="rounded-3xl bg-surface px-5 pt-5 pb-3">
                        <h2 id="stats-days" className="text-[14px] font-semibold text-ink3">
                            {activeMonthNumber}월 기록
                        </h2>
                        {/* 문장은 보통 굵기로 두고 숫자만 굵게 */}
                        <p className="mt-1.5 text-[17px] font-medium text-ink">
                            {days === null ? "\u00A0"
                                : monthVisitCount === 0 ? `${activeMonthNumber}월에는 기록이 없어요`
                                    : <>{activeMonthNumber}월에 <b className="font-bold tabular-nums">{monthVisitCount}번</b> 기록했어요</>}
                        </p>
                        {/* 하루에 여러 곳을 간 날이 있으면 횟수와 날 수가 달라서 따로 알려준다 */}
                        {days !== null && days.length > 0 && days.length !== monthVisitCount && (
                            <p className="mt-1 text-[13px] text-ink3">기록을 남긴 날은 모두 {days.length}일이에요.</p>
                        )}
                        <div className="mt-4">
                            <MonthCalendar month={activeMonth.month} counts={dayCounts} selected={activeDay}
                                           onSelect={setSelectedDay}/>
                        </div>

                        {activeDay && (
                            <button type="button" onClick={() => setSelectedDay(null)}
                                    className="mt-1 h-9 px-3.5 rounded-full bg-fill text-[13px] font-bold text-ink cursor-pointer sm:hover:bg-fill-hover transition-colors">
                                이 달 전체 보기
                            </button>
                        )}
                        <ul className="mt-2">
                            {listedDays.map((day) => {
                                const date = parseLocalDate(day.date)
                                return (
                                    <li key={day.date} className="border-t border-line py-3">
                                        <h3 className="text-[13px] font-semibold text-ink3">
                                            {date.getMonth() + 1}월 {date.getDate()}일 ({WEEKDAYS[date.getDay()]})
                                        </h3>
                                        <ul>
                                            {day.visits.map((visit) => {
                                                const average = visit.menus.reduce((sum, row) => sum + row.point, 0) / visit.menus.length
                                                return (
                                                    <li key={visit.restaurant.id}>
                                                        <button type="button"
                                                                onClick={() => router.push(RESTAURANT_PAGE.detail(visit.restaurant.id))}
                                                                className="w-full flex items-center gap-2.5 pt-2 text-left cursor-pointer">
                                                            <span className="flex-1 min-w-0">
                                                                <span className="block text-[15.5px] font-bold text-ink tracking-tight truncate">
                                                                    {visit.restaurant.name}
                                                                </span>
                                                                <span className="block text-[13px] text-ink3 mt-0.5 truncate">
                                                                    {visit.menus.map((row) => row.menu || "메뉴 미기재").join(" · ")}
                                                                </span>
                                                            </span>
                                                            {getReviewTextBox(average, "sm")}
                                                        </button>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>

                    <section aria-labelledby="stats-category" className="rounded-3xl bg-surface px-5 pt-5 pb-5">
                        <h2 id="stats-category" className="text-[14px] font-semibold text-ink3">많이 먹은 카테고리</h2>
                        <p className="mt-1.5 text-[17px] font-medium text-ink">
                            {top.length
                                ? <><b className="font-bold">{top[0].keyword}</b>{objectParticle(top[0].keyword)} 가장 많이 먹었어요</>
                                : "카테고리가 붙은 기록이 없어요"}
                        </p>
                        {categoryRows.length > 0 && (
                            <>
                                <div className="mt-4">
                                    <RankBars rows={categoryRows}/>
                                </div>
                                <p className="mt-4 text-[12px] text-ink3 leading-relaxed">
                                    카테고리가 여러 개 붙은 음식점은 각 카테고리에 한 번씩 세요.
                                </p>
                            </>
                        )}
                    </section>
                </>
            )}
        </div>
    )
}
