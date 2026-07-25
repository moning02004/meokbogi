"use client"

import {forwardRef, Suspense, useCallback, useEffect, useState} from "react"
import {useParams, useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {RESTAURANT_API, RESTAURANT_REVIEW_API} from "@/constants/routeUrl";
import {apiRequest} from "@/lib/api";
import NotFound from "next/dist/client/components/builtin/not-found";
import {MdSentimentNeutral, MdSentimentSatisfiedAlt, MdSentimentVeryDissatisfied} from "react-icons/md";
import {MenuSummaryType, RestaurantReviewType, RestaurantType} from "@/types/restaurant";
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import {FaArrowLeft, FaChevronRight} from "react-icons/fa";
import {FiArrowUpLeft} from "react-icons/fi";
import {LuCalendar} from "react-icons/lu";
import toast from "react-hot-toast";
import {getReviewTextBox} from "@/components/ui/review_textbox";

const SENTIMENTS = {
    1: {icon: MdSentimentSatisfiedAlt, color: "#24564A", bg: "bg-[#E4EEEA]", text: "text-[#24564A]", label: "만족"},
    0: {icon: MdSentimentNeutral, color: "#8A8172", bg: "bg-[#F1EFE8]", text: "text-[#8A8172]", label: "보통"},
    [-1]: {
        icon: MdSentimentVeryDissatisfied,
        color: "#C23B1E",
        bg: "bg-[#FDEBE1]",
        text: "text-[#C23B1E]",
        label: "별로"
    },
} as const

type SentimentKey = 1 | 0 | -1

const DateChipButton = forwardRef<HTMLButtonElement, { value?: string; onClick?: () => void }>(
    ({value, onClick}, ref) => (
        <button
            type="button"
            onClick={onClick}
            ref={ref}
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#5B5548] bg-[#F6F3EC] border border-[#E7E0CF] rounded-lg px-3 py-2 cursor-pointer sm:hover:bg-[#F1EDE2] transition-colors w-full"
        >
            <LuCalendar size={13}/>
            {value || "오늘"}
        </button>
    )
)
DateChipButton.displayName = "DateChipButton"

export default function Page() {
    const {id: restaurantId} = useParams<{ id: string }>()
    const {token} = useAuthStore.getState()
    const router = useRouter()
    const maxDate = new Date();

    const [restaurant, setRestaurant] = useState<RestaurantType | null>(null)
    const [menuSummaries, setMenuSummaries] = useState<MenuSummaryType[]>([])

    // 리뷰 폼
    const [reviewPoint, setReviewPoint] = useState<SentimentKey>(1)
    const [orderedAt, setOrderedAt] = useState("")
    const [reviewMenu, setReviewMenu] = useState("")
    const [reviewContent, setReviewContent] = useState("")
    const [showMenuSuggestions, setShowMenuSuggestions] = useState(false)

    // 리뷰 목록 (별도 페이지네이션)
    const [activeTab, setActiveTab] = useState<"menu" | "all">("menu")
    const [menuFilter, setMenuFilter] = useState<string | null>(null)
    const [reviews, setReviews] = useState<RestaurantReviewType[]>([])
    const [reviewCount, setReviewCount] = useState(0)
    const [reviewPage, setReviewPage] = useState(1)
    const [hasMoreReviews, setHasMoreReviews] = useState(false)
    const [isReviewLoading, setIsReviewLoading] = useState(false)

    const orderedAtDate = orderedAt ? new Date(orderedAt) : null

    const formatDate = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    }

    useEffect(() => {
        if (!token) router.replace("/login")
    }, [token])

    // 상세 조회 (메뉴별 요약 포함)
    const fetchRestaurant = useCallback(() => {
        const retrieve = RESTAURANT_API.retrieve
        apiRequest[retrieve.method]<RestaurantType>(retrieve.endpoint({
            restaurant: Number(restaurantId)
        })).then((response: RestaurantType) => {
            setRestaurant(response)
            setMenuSummaries(response.menu_summaries ?? [])
            setReviewCount(response.review_count ?? 0)
        })
    }, [restaurantId])

    useEffect(() => {
        fetchRestaurant()
    }, [fetchRestaurant])

    // 리뷰 목록 조회 (menu 필터 / 페이지)
    const fetchReviews = useCallback((menu: string | null, page: number, append: boolean) => {
        const reviewList = RESTAURANT_REVIEW_API.list
        setIsReviewLoading(true)

        const params = new URLSearchParams()
        if (menu != null) params.set("menu", menu)
        if (page && page > 1) params.set("page", String(page))
        const qs = params.toString()

        apiRequest[reviewList.method]<{ count: number; next: string | null; results: RestaurantReviewType[] }>(
            `${reviewList.endpoint({restaurant: Number(restaurantId)})}${qs ? `?${qs}` : ""}`
        ).then((res) => {
            setReviews((prev) => append ? [...prev, ...res.results] : res.results.sort((a, b) =>
                b.ordered_at.localeCompare(a.ordered_at))
            )
            setReviewCount(res.count)
            setHasMoreReviews(Boolean(res.next))
            setReviewPage(page)
        }).finally(() => setIsReviewLoading(false))
    }, [restaurantId])

    // 전체 리뷰 탭으로 들어가거나 필터가 바뀌면 1페이지부터 다시 요청
    useEffect(() => {
        if (activeTab !== "all") return
        fetchReviews(menuFilter, 1, false)
    }, [activeTab, menuFilter, fetchReviews])

    const openMenuReviews = (menu: string) => {
        setMenuFilter(menu)
        setActiveTab("all")
    }

    // 입력한 텍스트로 시작하는 기존 메뉴 (없으면 새 메뉴로 기록됨)
    const keyword = reviewMenu.trim()
    const menuSuggestions = keyword
        ? menuSummaries.filter((summary) => summary.menu && summary.menu.includes(keyword))
        : menuSummaries.filter((summary) => summary.menu)

    const selectMenuSuggestion = (menu: string) => {
        setReviewMenu(menu)
        setShowMenuSuggestions(false)
    }

    const registerReview = () => {
        if (!reviewMenu.trim()) {
            toast.error("드신 메뉴를 입력해주세요.")
            return;
        }

        const reviewAdd = RESTAURANT_REVIEW_API.add
        apiRequest[reviewAdd.method]<RestaurantReviewType>(reviewAdd.endpoint({
            restaurant: Number(restaurantId)
        }), {
            body: JSON.stringify({
                menu: reviewMenu.trim(),
                content: reviewContent,
                ordered_at: orderedAt || formatDate(new Date()),
                point: reviewPoint
            })
        }).then(() => {
            setReviewMenu("")
            setReviewContent("")
            setOrderedAt("")
            setReviewPoint(1)

            // 요약/카운트가 서버에서 재계산되므로 상세를 다시 불러온다
            fetchRestaurant()
            if (activeTab === "all") fetchReviews(menuFilter, 1, false)
        }).catch(() => {
            toast.error("기록에 실패했어요. 잠시 후 다시 시도해주세요.")
        })
    }

    if (!restaurantId) return <NotFound/>
    if (!restaurant) return <LoadingPage/>

    const overallBadge = typeof restaurant.review_avg === "number"
        ? SENTIMENTS[(restaurant.review_avg > 0.3 ? 1 : restaurant.review_avg < -0.3 ? -1 : 0) as SentimentKey]
        : null

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="h-[100%] bg-white pb-10">

                <div className="flex items-center gap-3 px-4 py-4 border-b border-[#E7E0CF]">
                    <button className="text-[#211D17] cursor-pointer" onClick={() => router.back()}>
                        <FaArrowLeft size={16}/>
                    </button>
                    <div className="text-[15px] font-bold text-[#211D17]">음식점</div>
                </div>

                <div
                    className="flex items-center gap-1 text-[12.5px] text-[#8A8172] font-semibold px-5 pt-3 pb-1 cursor-pointer w-fit sm:hover:text-[#24564A] transition-colors"
                    onClick={() => router.replace("/restaurant")}
                >
                    <FiArrowUpLeft size={13}/>
                    목록으로
                </div>

                {/* ---- 식당 정보 ---- */}
                <div className="mx-5 mt-2 mb-4 bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-1">
                        <div
                            className="text-[18px] font-extrabold text-[#211D17] tracking-tight">{restaurant.name}</div>
                        {overallBadge && (
                            <span
                                className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${overallBadge.bg} ${overallBadge.text}`}>
                                {overallBadge.label}
                            </span>
                        )}
                    </div>
                    <div className="text-[12.5px] text-[#8A8172] font-medium">
                        {restaurant.category_name} · {restaurant.address || "주소 미등록"}
                    </div>
                    {restaurant.description &&
                        <div
                            className="text-[12.5px] text-[#5B5548] mt-2 leading-relaxed">{restaurant.description}</div>}
                    <div className="text-[11.5px] text-[#B7AF9F] font-medium mt-1.5">
                        방문 {restaurant.ordered_count}회 · 최근 방문 {restaurant.latest_ordered_at || "-"} · 전체
                        리뷰 {restaurant.review_count} 개
                    </div>
                </div>

                {/* ---- 기록 폼: 날짜 / 메뉴+만족도 / 한줄평+등록 ---- */}
                <div className="mx-5 mb-5 border border-[#E7E0CF] rounded-2xl px-4 py-3.5">
                    <div className="mb-3 border-[#F0EBDD] w-full">
                        <DatePicker
                            wrapperClassName="w-full"
                            selected={orderedAtDate}
                            onChange={(date: Date | null) => setOrderedAt(date ? formatDate(date) : "")}
                            maxDate={maxDate}
                            dateFormat="yyyy-MM-dd"
                            customInput={<DateChipButton/>}
                        />
                    </div>

                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="relative flex-1 min-w-0">
                            <input
                                value={reviewMenu}
                                onChange={(e) => setReviewMenu(e.target.value)}
                                onFocus={() => setShowMenuSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowMenuSuggestions(false), 150)}
                                placeholder="오늘 뭐 드셨어요?"
                                className="w-full text-[13px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                            {showMenuSuggestions && menuSuggestions.length > 0 && (
                                <div
                                    className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#E7E0CF] rounded-lg shadow-md max-h-48 overflow-y-auto">
                                    {menuSuggestions.map((summary) => (
                                        <button
                                            key={summary.menu}
                                            type="button"
                                            onMouseDown={() => selectMenuSuggestion(summary.menu)}
                                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-[#211D17] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors"
                                        >
                                            <span className="truncate">{summary.menu}</span>
                                            <span className="text-[11.5px] text-[#B7AF9F] font-semibold shrink-0">리뷰 {summary.review_count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex bg-[#F6F3EC] rounded-xl p-[3px] gap-[2px] shrink-0">
                            {([1, 0, -1] as SentimentKey[]).map((value) => {
                                const {icon: Icon} = SENTIMENTS[value]
                                const active = reviewPoint === value
                                return (
                                    <button
                                        key={value}
                                        onClick={() => setReviewPoint(value)}
                                        className={`w-[32px] h-[32px] rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                                            active ? "bg-[#24564A]" : ""
                                        }`}
                                    >
                                        <Icon size={18} color={active ? "#FFFFFF" : "#B7AF9F"}/>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            value={reviewContent}
                            onChange={(e) => setReviewContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.nativeEvent.isComposing) registerReview()
                            }}
                            placeholder="한줄평 (선택)"
                            className="flex-1 min-w-0 text-[13px] text-[#211D17] bg-[#F6F3EC] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                        />
                        <button
                            onClick={registerReview}
                            className="text-[13px] font-extrabold px-4 py-2.5 bg-[#D2571E] text-white rounded-lg shrink-0 cursor-pointer sm:hover:bg-[#b84a19] transition-colors"
                        >
                            기록
                        </button>
                    </div>
                </div>

                {/* ---- 탭 ---- */}
                <div className="flex gap-1.5 px-5 mb-3">
                    <button
                        onClick={() => {
                            setActiveTab("menu");
                            setMenuFilter(null)
                        }}
                        className={`px-4 py-2 rounded-full text-[12.5px] font-bold border cursor-pointer transition-colors ${
                            activeTab === "menu"
                                ? "bg-[#24564A] text-white border-[#24564A]"
                                : "bg-white text-[#8A8172] border-[#E7E0CF]"
                        }`}
                    >
                        메뉴별 보기
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab("all");
                            setMenuFilter(null)
                        }}
                        className={`px-4 py-2 rounded-full text-[12.5px] font-bold border cursor-pointer transition-colors ${
                            activeTab === "all"
                                ? "bg-[#24564A] text-white border-[#24564A]"
                                : "bg-white text-[#8A8172] border-[#E7E0CF]"
                        }`}
                    >
                        리뷰 보기
                    </button>
                </div>

                {/* ---- 필터 표시 ---- */}
                {activeTab === "all" && menuFilter && (
                    <div className="px-5 mb-2.5">
                        <button
                            onClick={() => setMenuFilter(null)}
                            className="inline-flex items-center gap-2 bg-[#E4EEEA] text-[#24564A] text-[12px] font-bold px-3.5 py-1.5 rounded-full cursor-pointer"
                        >
                            {menuFilter != "" ? menuFilter : "메뉴 미기재"}
                            <span className="text-[11px] opacity-70">✕</span>
                        </button>
                    </div>
                )}

                {/* ---- 리스트 ---- */}
                <div className="mx-5 border border-[#E7E0CF] rounded-2xl px-3.5">
                    {activeTab === "menu" ? (
                        menuSummaries.length === 0 ? (
                            <p className="text-[13px] text-[#B7AF9F] text-center py-8">아직 기록된 메뉴가 없어요.</p>
                        ) : (
                            menuSummaries.map(({menu, review_count, review_avg}: MenuSummaryType, index) => {
                                const reviewTextBox = getReviewTextBox(review_avg)

                                return (
                                    <button
                                        key={index}
                                        onClick={() => openMenuReviews(menu)}
                                        className="w-full flex items-center gap-3 py-3.5 border-b border-[#F0EBDD] last:border-0 cursor-pointer text-left"
                                    >
                                        <div
                                            className="flex-1 min-w-0 font-extrabold text-[#211D17] truncate">{menu || "메뉴 미기재"}
                                        </div>
                                        <div>{reviewTextBox}</div>
                                        <div
                                            className="text-[11.5px] text-[#B7AF9F] font-semibold shrink-0">리뷰 {review_count}</div>
                                        <FaChevronRight size={11} className="text-[#D8D0BC] shrink-0"/>
                                    </button>
                                )
                            })
                        )
                    ) : (
                        <>
                            {isReviewLoading && reviews.length === 0 ? (
                                <p className="text-[13px] text-[#B7AF9F] text-center py-8">불러오는 중...</p>
                            ) : reviews.length === 0 ? (
                                <p className="text-[13px] text-[#B7AF9F] text-center py-8">아직 리뷰가 없어요.</p>
                            ) : (
                                reviews.map((review) => {
                                    const {icon: Icon, color, bg} = SENTIMENTS[review.point as SentimentKey]
                                    return (
                                        <div key={review.id}
                                             className="flex gap-2.5 py-3.5 border-b border-[#F0EBDD] last:border-0">
                                            <div
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                                                <Icon size={16} color={color}/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[14px] font-extrabold text-[#211D17] truncate">
                                                        {review.menu?.trim() || "메뉴 미기재"}
                                                    </div>
                                                    <div
                                                        className="text-[11.5px] text-[#B7AF9F] font-semibold ml-auto shrink-0">
                                                        {review.ordered_at}
                                                    </div>
                                                </div>
                                                {review.content && (
                                                    <div
                                                        className="text-[13px] text-[#8A8172] mt-0.5 leading-snug">{review.content}</div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            {hasMoreReviews && (
                                <button
                                    onClick={() => fetchReviews(menuFilter, reviewPage + 1, true)}
                                    disabled={isReviewLoading}
                                    className="w-full py-3.5 text-[12.5px] font-bold text-[#24564A] border-t border-[#F0EBDD] cursor-pointer disabled:opacity-50"
                                >
                                    {isReviewLoading ? "불러오는 중..." : "더 보기"}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Suspense>
    )
}