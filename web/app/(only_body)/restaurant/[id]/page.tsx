"use client"

import {forwardRef, Suspense, useCallback, useEffect, useState} from "react"
import {useParams, useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {RESTAURANT_API, RESTAURANT_REVIEW_API} from "@/constants/routeUrl";
import {ApiError, apiRequest, errorMessage} from "@/lib/api";
import {parseLocalDate} from "@/lib/date";
import {normalizeMenu} from "@/lib/menu";
import NotFound from "next/dist/client/components/builtin/not-found";
import {MdSentimentNeutral, MdSentimentSatisfiedAlt, MdSentimentVeryDissatisfied} from "react-icons/md";
import {MenuSummaryType, RestaurantReviewType, RestaurantType} from "@/types/restaurant";
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import {FaArrowLeft, FaChevronRight} from "react-icons/fa";
import {FiArrowUpLeft} from "react-icons/fi";
import {LuCalendar, LuEllipsisVertical} from "react-icons/lu";
import toast from "react-hot-toast";
import {getReviewTextBox} from "@/components/ui/review_textbox";
import {ActionDrawer} from "@/components/ui/action_drawer";
import {Modal} from "@/components/ui/modal";
import {useCategoryStore} from "@/store/category";
import {CategoryType} from "@/types/zone";

const SENTIMENTS = {
    1: {icon: MdSentimentSatisfiedAlt, color: "#24564A", bg: "bg-[#B5E3C4]", text: "text-[#24564A]", label: "만족"},
    0: {icon: MdSentimentNeutral, color: "#8A8172", bg: "bg-[#D6D2CC]", text: "text-[#8A8172]", label: "보통"},
    [-1]: {
        icon: MdSentimentVeryDissatisfied,
        color: "#C23B1E",
        bg: "bg-[#EBB9A2]",
        text: "text-[#C23B1E]",
        label: "실망"
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

// 만족·보통·실망 선택. 기록 폼과 리뷰 수정 시트에서 같이 쓴다.
// 손가락으로 누르기 쉽도록 한 칸을 40px로 잡는다.
function SentimentPicker({value, onChange}: { value: SentimentKey; onChange: (value: SentimentKey) => void }) {
    return (
        <div role="radiogroup" aria-label="만족도" className="flex bg-[#F6F3EC] rounded-xl p-[3px] gap-[2px] shrink-0">
            {([1, 0, -1] as SentimentKey[]).map((option) => {
                const {icon: Icon, label} = SENTIMENTS[option]
                const active = value === option
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        onClick={() => onChange(option)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                            active ? "bg-[#24564A]" : ""
                        }`}
                    >
                        <Icon size={19} color={active ? "#FFFFFF" : "#B7AF9F"}/>
                    </button>
                )
            })}
        </div>
    )
}

// 한줄평이 2줄을 넘으면 "더보기"로 펼칠 수 있게 한다.
// 넘치는지 여부는 ref 콜백에서 실측한다 (effect 안에서 setState 하지 않기 위해).
function ReviewContent({content}: { content: string }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isOverflowing, setIsOverflowing] = useState(false)

    const measureRef = useCallback((element: HTMLDivElement | null) => {
        if (!element) return
        setIsOverflowing(element.scrollHeight > element.clientHeight + 1)
    }, [])

    return (
        <>
            <div
                ref={measureRef}
                className={`text-[13px] text-[#8A8172] mt-0.5 leading-snug whitespace-pre-wrap ${
                    isExpanded ? "" : "line-clamp-2"
                }`}
            >
                {content}
            </div>
            {isOverflowing && (
                <button
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="text-[12px] font-bold text-[#B7AF9F] mt-0.5 cursor-pointer sm:hover:text-[#24564A] transition-colors"
                >
                    {isExpanded ? "접기" : "더보기"}
                </button>
            )}
        </>
    )
}

export default function Page() {
    const {id: restaurantId} = useParams<{ id: string }>()
    const {token} = useAuthStore.getState()
    const router = useRouter()
    const categories = useCategoryStore(state => state.categories)
    const maxDate = new Date();

    const [restaurant, setRestaurant] = useState<RestaurantType | null>(null)
    // 없는 음식점·지워진 음식점이면 로딩 화면에서 멈추지 않고 안내를 보여준다
    const [loadError, setLoadError] = useState<string | null>(null)
    const [menuSummaries, setMenuSummaries] = useState<MenuSummaryType[]>([])

    // 음식점 수정
    const [isEditingRestaurant, setIsEditingRestaurant] = useState(false)
    const [editCategory, setEditCategory] = useState<CategoryType | null>(null)
    const [editName, setEditName] = useState("")
    const [editDescription, setEditDescription] = useState("")
    const [editAddress, setEditAddress] = useState("")

    // 리뷰 폼
    const [reviewPoint, setReviewPoint] = useState<SentimentKey>(1)
    const [orderedAt, setOrderedAt] = useState("")
    const [reviewMenu, setReviewMenu] = useState("")
    const [reviewContent, setReviewContent] = useState("")
    const [showMenuSuggestions, setShowMenuSuggestions] = useState(false)
    const [isSubmittingReview, setIsSubmittingReview] = useState(false)

    // 리뷰 수정
    const [editingReview, setEditingReview] = useState<RestaurantReviewType | null>(null)
    const [editReviewDate, setEditReviewDate] = useState("")
    const [editReviewMenu, setEditReviewMenu] = useState("")
    const [editReviewContent, setEditReviewContent] = useState("")
    const [editReviewPoint, setEditReviewPoint] = useState<SentimentKey>(1)
    const [isSavingReview, setIsSavingReview] = useState(false)

    // 리뷰 목록 (별도 페이지네이션)
    const [activeTab, setActiveTab] = useState<"menu" | "all">("menu")
    const [menuFilter, setMenuFilter] = useState<string | null>(null)
    const [reviews, setReviews] = useState<RestaurantReviewType[]>([])
    const [reviewCount, setReviewCount] = useState(0)
    const [reviewPage, setReviewPage] = useState(1)
    const [hasMoreReviews, setHasMoreReviews] = useState(false)
    const [isReviewLoading, setIsReviewLoading] = useState(false)

    const orderedAtDate = orderedAt ? parseLocalDate(orderedAt) : null

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
        }).catch((error) => {
            setLoadError(error instanceof ApiError && error.status === 404
                ? "음식점을 찾을 수 없어요. 삭제되었거나 다른 계정의 음식점이에요."
                : errorMessage(error, "음식점 정보를 불러오지 못했어요."))
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
        }).catch((error) => {
            toast.error(errorMessage(error, "리뷰를 불러오지 못했어요."))
        }).finally(() => setIsReviewLoading(false))
    }, [restaurantId])

    // 전체 리뷰 탭으로 들어가거나 필터가 바뀌면 1페이지부터 다시 요청한다.
    // effect로 하면 렌더 → effect → setState가 연쇄되므로 탭/필터를 바꾸는 이벤트에서 바로 부른다.
    const showReviews = (menu: string | null) => {
        setMenuFilter(menu)
        setActiveTab("all")
        fetchReviews(menu, 1, false)
    }

    const openMenuReviews = (menu: string) => showReviews(menu)

    // 현재 값으로 폼을 채운 뒤 수정 모달을 연다
    const editRestaurant = () => {
        if (!restaurant) return
        setEditCategory(categories.find((category) => category.keyword === restaurant.category_name) ?? null)
        setEditName(restaurant.name)
        setEditDescription(restaurant.description ?? "")
        setEditAddress(restaurant.address ?? "")
        setIsEditingRestaurant(true)
    }

    const saveRestaurant = () => {
        if (!editName.trim() || !editCategory) {
            toast.error("음식점 이름과 카테고리를 선택해주세요.")
            return;
        }

        const restaurantUpdate = RESTAURANT_API.update
        apiRequest[restaurantUpdate.method](restaurantUpdate.endpoint({
            restaurant: Number(restaurantId)
        }), {
            body: JSON.stringify({
                category: editCategory.id,
                name: editName.trim(),
                description: editDescription,
                address: editAddress,
            })
        }).then(() => {
            setIsEditingRestaurant(false)
            fetchRestaurant()
            toast.success("음식점 정보를 고쳤어요.")
        }).catch((error) => {
            toast.error(errorMessage(error, "수정에 실패했어요. 잠시 후 다시 시도해주세요."))
        })
    }

    const deleteRestaurant = () => {
        const deleteRestaurantAPI = RESTAURANT_API.delete
        apiRequest[deleteRestaurantAPI.method](deleteRestaurantAPI.endpoint({restaurant: Number(restaurantId)}))
            .then(() => {
                toast.success("음식점이 삭제되었습니다.")
                router.replace("/restaurant")
            })
            .catch((error) => toast.error(errorMessage(error, "삭제에 실패했어요.")))
    }

    // 입력한 텍스트가 들어간 기존 메뉴 (없으면 새 메뉴로 기록됨). 공백·대소문자는 무시하고 찾는다.
    const keyword = reviewMenu.trim()
    const menuKey = normalizeMenu(keyword)
    const menuSuggestions = keyword
        ? menuSummaries.filter((summary) => summary.menu && normalizeMenu(summary.menu).includes(menuKey))
        : menuSummaries.filter((summary) => summary.menu)
    // 띄어쓰기만 다른 기존 메뉴가 있으면 서버가 그 표기로 합쳐서 저장한다. 미리 알려준다.
    const mergeTarget = keyword
        ? menuSummaries.find((summary) => summary.menu && summary.menu !== keyword && normalizeMenu(summary.menu) === menuKey)
        : undefined

    const selectMenuSuggestion = (menu: string) => {
        setReviewMenu(menu)
        setShowMenuSuggestions(false)
    }

    const registerReview = () => {
        if (isSubmittingReview) return
        if (!reviewMenu.trim()) {
            toast.error("드신 메뉴를 입력해주세요.")
            return;
        }

        // 기록 버튼을 연타하면 같은 리뷰가 여러 개 생기던 문제
        setIsSubmittingReview(true)
        // 터치로 버튼을 누르면 메뉴 입력칸의 포커스가 빠지지 않아 제안 목록이 열린 채 한줄평을 가렸다 (E2E에서 발견)
        setShowMenuSuggestions(false)

        const reviewAdd = RESTAURANT_REVIEW_API.add
        apiRequest[reviewAdd.method]<RestaurantReviewType>(reviewAdd.endpoint({
            restaurant: Number(restaurantId)
        }), {
            body: JSON.stringify({
                menu: reviewMenu.trim(),
                content: reviewContent.trim(),
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
            toast.success("기록했어요.")
        }).catch((error) => {
            toast.error(errorMessage(error, "기록에 실패했어요. 잠시 후 다시 시도해주세요."))
        }).finally(() => setIsSubmittingReview(false))
    }

    // 리뷰 삭제 요청만 보낸다. 확인은 호출하는 쪽(시트의 확인 단계, 되돌리기 버튼)이 맡는다.
    const removeReview = (reviewId: number) => {
        const reviewDelete = RESTAURANT_REVIEW_API.delete
        return apiRequest[reviewDelete.method](reviewDelete.endpoint({
            restaurant: Number(restaurantId),
            review: reviewId
        })).then(() => {
            setReviews((prev) => prev.filter((review) => review.id !== reviewId))
            setReviewCount((prev) => Math.max(prev - 1, 0))

            // 메뉴 요약/평균이 서버에서 재계산되므로 상세를 다시 불러온다
            fetchRestaurant()
        })
    }

    // "또 먹었어요": 같은 메뉴를 오늘 날짜, 지난번 만족도로 바로 기록한다. 잘못 눌렀으면 토스트에서 되돌린다.
    const quickLog = ({menu, last_point}: MenuSummaryType) => {
        if (isSubmittingReview || !menu) return
        setIsSubmittingReview(true)

        const reviewAdd = RESTAURANT_REVIEW_API.add
        apiRequest[reviewAdd.method]<RestaurantReviewType>(reviewAdd.endpoint({
            restaurant: Number(restaurantId)
        }), {
            body: JSON.stringify({
                menu,
                content: "",
                ordered_at: formatDate(new Date()),
                point: last_point,
            })
        }).then((created) => {
            fetchRestaurant()
            if (activeTab === "all") fetchReviews(menuFilter, 1, false)
            toast((t) => (
                <span className="flex items-center gap-3 text-[13.5px]">
                    <span>&lsquo;{menu}&rsquo; 오늘 먹은 걸로 기록했어요.</span>
                    <button
                        onClick={() => {
                            toast.dismiss(t.id)
                            removeReview(created.id)
                                .then(() => toast.success("기록을 되돌렸어요."))
                                .catch((error) => toast.error(errorMessage(error, "되돌리지 못했어요.")))
                        }}
                        className="shrink-0 font-bold text-[#D2571E] cursor-pointer">
                        되돌리기
                    </button>
                </span>
            ), {duration: 6000})
        }).catch((error) => {
            toast.error(errorMessage(error, "기록에 실패했어요. 잠시 후 다시 시도해주세요."))
        }).finally(() => setIsSubmittingReview(false))
    }

    const startEditingReview = (review: RestaurantReviewType) => {
        setEditingReview(review)
        setEditReviewDate(review.ordered_at)
        setEditReviewMenu(review.menu ?? "")
        setEditReviewContent(review.content ?? "")
        setEditReviewPoint(review.point as SentimentKey)
    }

    const saveReview = () => {
        if (!editingReview || isSavingReview) return
        if (!editReviewMenu.trim() || !editReviewDate) {
            toast.error("메뉴와 날짜를 입력해주세요.")
            return
        }

        setIsSavingReview(true)
        const reviewUpdate = RESTAURANT_REVIEW_API.update
        apiRequest[reviewUpdate.method]<RestaurantReviewType>(reviewUpdate.endpoint({
            restaurant: Number(restaurantId),
            review: editingReview.id,
        }), {
            body: JSON.stringify({
                ordered_at: editReviewDate,
                menu: editReviewMenu.trim(),
                content: editReviewContent.trim(),
                point: editReviewPoint,
            })
        }).then((updated) => {
            setReviews((prev) => prev.map((review) => review.id === updated.id ? updated : review))
            setEditingReview(null)
            fetchRestaurant()
            toast.success("리뷰를 고쳤어요.")
        }).catch((error) => {
            toast.error(errorMessage(error, "리뷰를 고치지 못했어요."))
        }).finally(() => setIsSavingReview(false))
    }

    const deleteReview = (reviewId: number) => {
        removeReview(reviewId).then(() => toast.success("리뷰를 삭제했어요.")).catch((error) => {
            toast.error(errorMessage(error, "삭제에 실패했어요. 잠시 후 다시 시도해주세요."))
        })
    }

    if (!restaurantId) return <NotFound/>
    if (loadError) return (
        <div className="flex flex-col items-center justify-center gap-4 h-full px-6 text-center">
            <p className="text-[14px] font-semibold text-[#8A8172] leading-relaxed">{loadError}</p>
            <button
                onClick={() => router.replace("/restaurant")}
                className="text-[13.5px] font-bold text-white bg-[#24564A] rounded-xl px-5 py-3 cursor-pointer sm:hover:bg-[#1c443a] transition-colors">
                음식점 목록으로
            </button>
        </div>
    )
    if (!restaurant) return <LoadingPage/>

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="min-h-[100%] bg-white mb-10">

                <div className="flex items-center gap-3 px-4 py-4 border-b border-[#E7E0CF]">
                    <button aria-label="뒤로" className="text-[#211D17] cursor-pointer p-2.5 -m-2.5" onClick={() => router.back()}>
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

                {/* ---- 음식점 정보 ---- */}
                <div className="mx-5 mt-2 mb-4 bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="flex flex-row">
                            <div
                                className="text-[18px] font-extrabold text-[#211D17] tracking-tight">
                                {restaurant.name}
                            </div>
                            {restaurant.review_avg !== null && getReviewTextBox(restaurant.review_avg)}
                        </div>
                        <div className="ml-auto">
                            <ActionDrawer
                                triggerLabel="음식점 메뉴 열기"
                                items={[{
                                    label: "음식점 수정",
                                    onClick: () => editRestaurant(),
                                }, {
                                    label: "음식점 삭제",
                                    danger: true,
                                    onClick: () => deleteRestaurant(),
                                    confirm: {
                                        title: `'${restaurant.name}'을(를) 삭제할까요?`,
                                        description: `리뷰 ${restaurant.review_count}개도 함께 사라지고 되돌릴 수 없어요.`,
                                        confirmLabel: "삭제",
                                    },
                                }]}
                            />
                        </div>
                    </div>
                    <div className="text-[12.5px] text-[#8A8172] font-medium">
                        {restaurant.category_name} · {restaurant.address || "주소 미등록"}
                    </div>
                    <div
                        className="text-[12.5px] text-[#5B5548] mt-2 leading-relaxed bg-white px-3 py-1 rounded border border-[#E7E0CF]">{restaurant.description || "소개 없음"}</div>
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
                                maxLength={255}
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
                                            <span
                                                className="text-[11.5px] text-[#B7AF9F] font-semibold shrink-0">리뷰 {summary.review_count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <SentimentPicker value={reviewPoint} onChange={setReviewPoint}/>
                    </div>
                    {mergeTarget && (
                        <p className="-mt-1.5 mb-3 text-[11.5px] font-semibold text-[#24564A]">
                            &lsquo;{mergeTarget.menu}&rsquo;(으)로 합쳐서 기록돼요.
                        </p>
                    )}

                    <div className="flex items-center gap-2">
                        <textarea
                            value={reviewContent}
                            onChange={(e) => setReviewContent(e.target.value)}
                            placeholder="한줄평 (선택)"
                            maxLength={255}
                            className="flex-1 min-w-0 text-[13px] text-[#211D17] bg-[#F6F3EC] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F] resize-none"
                            rows={2}
                        />
                        <button
                            onClick={registerReview}
                            disabled={isSubmittingReview}
                            className="text-[13px] font-extrabold px-4 py-2.5 bg-[#D2571E] text-white rounded-lg shrink-0 cursor-pointer sm:hover:bg-[#b84a19] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        onClick={() => showReviews(null)}
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
                            onClick={() => showReviews(null)}
                            className="inline-flex items-center gap-2 bg-[#E4EEEA] text-[#24564A] text-[12px] font-bold px-3.5 py-1.5 rounded-full cursor-pointer"
                        >
                            {menuFilter != "" ? menuFilter : "메뉴 미기재"}
                            <span className="text-[11px] opacity-70">✕</span>
                        </button>
                    </div>
                )}

                {/* ---- 리스트 ---- */}
                <div className="mx-5 border border-[#E7E0CF] rounded-2xl px-3.5 mb-10">
                    {activeTab === "menu" ? (
                        menuSummaries.length === 0 ? (
                            <p className="text-[13px] text-[#B7AF9F] text-center py-8">아직 기록된 메뉴가 없어요.</p>
                        ) : (
                            menuSummaries.map((summary: MenuSummaryType, index) => {
                                const {menu, review_count, review_avg} = summary
                                const reviewTextBox = getReviewTextBox(review_avg)

                                return (
                                    <div key={index}
                                         className="flex items-center gap-2 border-b border-[#F0EBDD] last:border-0">
                                        <button
                                            onClick={() => openMenuReviews(menu)}
                                            className="flex-1 min-w-0 flex items-center gap-3 py-3.5 cursor-pointer text-left"
                                        >
                                            <div
                                                className="flex-1 min-w-0 font-extrabold text-[#211D17] truncate">{menu || "메뉴 미기재"}
                                            </div>
                                            <div>{reviewTextBox}</div>
                                            <div
                                                className="text-[11.5px] text-[#B7AF9F] font-semibold shrink-0">리뷰 {review_count}</div>
                                            <FaChevronRight size={11} className="text-[#D8D0BC] shrink-0"/>
                                        </button>
                                        {menu && (
                                            <button
                                                onClick={() => quickLog(summary)}
                                                disabled={isSubmittingReview}
                                                aria-label={`${menu} 오늘 또 먹은 걸로 기록`}
                                                className="shrink-0 text-[11.5px] font-bold text-[#D2571E] bg-[#FDEBE1] rounded-full px-2.5 py-1.5 cursor-pointer sm:hover:bg-[#FBDCCB] transition-colors disabled:opacity-50"
                                            >
                                                또 먹었어요
                                            </button>
                                        )}
                                    </div>
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
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                                                <Icon size={20} color={color}/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[14px] font-extrabold text-[#211D17] truncate">
                                                        {review.menu?.trim() || "메뉴 미기재"}
                                                    </div>
                                                </div>
                                                <ReviewContent content={review.content || "내용 없음"}/>
                                            </div>
                                            <div
                                                className="my-auto text-[11.5px] text-[#B7AF9F] font-semibold ml-auto shrink-0">
                                                {review.ordered_at}
                                            </div>
                                            <ActionDrawer
                                                trigger={
                                                    <button
                                                        aria-label="리뷰 메뉴 열기"
                                                        className="my-auto text-[#D8D0BC] shrink-0 self-start cursor-pointer p-3 -m-3">
                                                        <LuEllipsisVertical size={16}/>
                                                    </button>
                                                }
                                                items={[{
                                                    label: "리뷰 수정",
                                                    onClick: () => startEditingReview(review),
                                                }, {
                                                    label: "리뷰 삭제",
                                                    danger: true,
                                                    onClick: () => deleteReview(review.id),
                                                    confirm: {
                                                        title: "이 리뷰를 삭제할까요?",
                                                        description: `${review.ordered_at} · ${review.menu?.trim() || "메뉴 미기재"}`,
                                                        confirmLabel: "삭제",
                                                    },
                                                }]}
                                            />
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

                {/* ---- 리뷰 수정 ---- */}
                <Modal
                    title="리뷰 수정"
                    open={editingReview !== null}
                    onOpenChange={(open) => {
                        if (!open) setEditingReview(null)
                    }}
                >
                    <div className="flex flex-col gap-3">
                        <div className="flex items-end gap-2.5">
                            <div className="flex-1 min-w-0">
                                <label htmlFor="edit-review-date"
                                       className="block text-[12px] font-bold text-[#8A8172] mb-1.5">먹은 날</label>
                                <input
                                    id="edit-review-date"
                                    type="date"
                                    value={editReviewDate}
                                    max={formatDate(new Date())}
                                    onChange={(e) => setEditReviewDate(e.target.value)}
                                    className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2 outline-none focus:border-[#24564A] transition-colors bg-white"
                                />
                            </div>
                            <SentimentPicker value={editReviewPoint} onChange={setEditReviewPoint}/>
                        </div>

                        <div>
                            <label htmlFor="edit-review-menu"
                                   className="block text-[12px] font-bold text-[#8A8172] mb-1.5">메뉴</label>
                            <input
                                id="edit-review-menu"
                                value={editReviewMenu}
                                onChange={(e) => setEditReviewMenu(e.target.value)}
                                maxLength={255}
                                className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors"
                            />
                        </div>

                        <div>
                            <label htmlFor="edit-review-content"
                                   className="block text-[12px] font-bold text-[#8A8172] mb-1.5">한줄평</label>
                            <textarea
                                id="edit-review-content"
                                value={editReviewContent}
                                onChange={(e) => setEditReviewContent(e.target.value)}
                                maxLength={255}
                                rows={2}
                                className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors resize-none"
                            />
                        </div>

                        <button
                            onClick={saveReview}
                            disabled={isSavingReview}
                            className="w-full text-[13.5px] font-bold text-white bg-[#24564A] rounded-lg py-3 mt-1 cursor-pointer sm:hover:bg-[#1c443a] transition-colors disabled:opacity-50"
                        >
                            {isSavingReview ? "저장 중…" : "수정하기"}
                        </button>
                    </div>
                </Modal>

                {/* ---- 음식점 수정 ---- */}
                <Modal
                    title="음식점 수정"
                    open={isEditingRestaurant}
                    onOpenChange={setIsEditingRestaurant}
                >
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                대표 카테고리 <span className="text-[#D2571E]">*</span>
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {categories.map((category: CategoryType) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => setEditCategory(category)}
                                        className={`px-3 py-1.5 rounded-full text-[12.5px] font-bold border cursor-pointer transition-colors ${
                                            editCategory?.id === category.id
                                                ? "bg-[#24564A] text-white border-[#24564A]"
                                                : "bg-white text-[#8A8172] border-[#E7E0CF]"
                                        }`}
                                    >
                                        {category.keyword}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                이름 <span className="text-[#D2571E]">*</span>
                            </label>
                            <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                maxLength={100}
                                placeholder="예: 미뜨레피자"
                                className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-bold text-[#8A8172] mb-1.5">설명</label>
                            <input
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                maxLength={100}
                                placeholder="이 음식점에 대한 짧은 메모"
                                className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                        </div>

                        <div>
                            <label className="block text-[12px] font-bold text-[#8A8172] mb-1.5">주소</label>
                            <input
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                maxLength={255}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) saveRestaurant()
                                }}
                                placeholder="예: 서울시 강남구 ..."
                                className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                        </div>

                        <button
                            onClick={saveRestaurant}
                            className="w-full text-[13.5px] font-bold text-white bg-[#24564A] rounded-lg py-3 mt-1 cursor-pointer sm:hover:bg-[#1c443a] transition-colors"
                        >
                            수정하기
                        </button>
                    </div>
                </Modal>
            </div>
        </Suspense>
    )
}