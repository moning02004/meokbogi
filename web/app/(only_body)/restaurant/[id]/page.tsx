"use client"

import {categoryLabel} from "@/lib/restaurant";

import {Suspense, useCallback, useEffect, useState} from "react"
import {useParams, useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {BRANCH_API, RESTAURANT_API, RESTAURANT_REVIEW_API} from "@/constants/routeUrl";
import {ApiError, apiRequest, errorMessage} from "@/lib/api";
import {today} from "@/lib/date";
import NotFound from "next/dist/client/components/builtin/not-found";
import {MenuSummaryType, RestaurantReviewType, RestaurantType} from "@/types/restaurant";
import {FaArrowLeft, FaChevronRight} from "react-icons/fa";
import {FiArrowUpLeft} from "react-icons/fi";
import {LuEllipsisVertical, LuPencilLine} from "react-icons/lu";
import toast from "react-hot-toast";
import {getReviewTextBox} from "@/components/ui/review_textbox";
import {ActionDrawer} from "@/components/ui/action_drawer";
import {Modal} from "@/components/ui/modal";
import {useCategoryStore} from "@/store/category";
import {CategoryChips} from "@/components/restaurant/category_chips";
import {BranchManager} from "@/components/restaurant/branch_manager";
import {SENTIMENTS, SentimentKey} from "@/components/review/sentiment";
import {ReviewDraft, ReviewSheet} from "@/components/review/review_sheet";

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

    const [restaurant, setRestaurant] = useState<RestaurantType | null>(null)
    // 없는 음식점·지워진 음식점이면 로딩 화면에서 멈추지 않고 안내를 보여준다
    const [loadError, setLoadError] = useState<string | null>(null)
    const [menuSummaries, setMenuSummaries] = useState<MenuSummaryType[]>([])

    // 음식점 수정
    const [isEditingRestaurant, setIsEditingRestaurant] = useState(false)
    const [editCategoryIds, setEditCategoryIds] = useState<number[]>([])
    const [editName, setEditName] = useState("")
    const [editDescription, setEditDescription] = useState("")

    // 지점 거르기: null = 전체, "none" = 지점 없이 남긴 리뷰, 숫자 = 그 지점
    const [selectedBranch, setSelectedBranch] = useState<number | "none" | null>(null)

    // 리뷰 쓰기·고치기 시트. 열 때마다 seq를 올려 폼을 새로 만든다.
    const [sheet, setSheet] = useState<{ review: RestaurantReviewType | null; initial: ReviewDraft; seq: number } | null>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)

    // 리뷰 목록 (별도 페이지네이션)
    const [activeTab, setActiveTab] = useState<"menu" | "all">("menu")
    const [menuFilter, setMenuFilter] = useState<string | null>(null)
    const [reviews, setReviews] = useState<RestaurantReviewType[]>([])
    const [reviewCount, setReviewCount] = useState(0)
    const [reviewPage, setReviewPage] = useState(1)
    const [hasMoreReviews, setHasMoreReviews] = useState(false)
    const [isReviewLoading, setIsReviewLoading] = useState(false)

    useEffect(() => {
        if (!token) router.replace("/login")
    }, [token])

    // 상세 조회 (메뉴별 요약 포함)
    // 상세 조회 (메뉴별 요약은 고른 지점 기준)
    const fetchRestaurant = useCallback(() => {
        const retrieve = RESTAURANT_API.retrieve
        const qs = selectedBranch !== null ? `?branch=${selectedBranch}` : ""
        return apiRequest[retrieve.method]<RestaurantType>(`${retrieve.endpoint({
            restaurant: Number(restaurantId)
        })}${qs}`).then((response: RestaurantType) => {
            setRestaurant(response)
            setMenuSummaries(response.menu_summaries ?? [])
            setReviewCount(response.review_count ?? 0)
        }).catch((error) => {
            setLoadError(error instanceof ApiError && error.status === 404
                ? "음식점을 찾을 수 없어요. 삭제되었거나 다른 계정의 음식점이에요."
                : errorMessage(error, "음식점 정보를 불러오지 못했어요."))
        })
    }, [restaurantId, selectedBranch])

    useEffect(() => {
        fetchRestaurant()
    }, [fetchRestaurant])

    // 리뷰 목록 조회 (menu 필터 / 페이지)
    const fetchReviews = useCallback((menu: string | null, page: number, append: boolean,
                                      branch: number | "none" | null = selectedBranch) => {
        const reviewList = RESTAURANT_REVIEW_API.list
        setIsReviewLoading(true)

        const params = new URLSearchParams()
        if (menu != null) params.set("menu", menu)
        if (branch !== null) params.set("branch", String(branch))
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
    }, [restaurantId, selectedBranch])

    // 지점 칩을 누르면 요약(fetchRestaurant가 selectedBranch에 따라 다시 읽음)과 리뷰 목록을 그 지점 기준으로
    const chooseBranch = (branch: number | "none" | null) => {
        setSelectedBranch(branch)
        if (activeTab === "all") fetchReviews(menuFilter, 1, false, branch)
    }

    const createBranch = (name: string) => {
        const add = BRANCH_API.add
        return apiRequest[add.method]<{ id: number; name: string }>(add.endpoint({restaurant: Number(restaurantId)}), {
            body: JSON.stringify({name}),
        }).then((branch) => {
            fetchRestaurant()
            toast.success(`'${branch.name}' 지점을 추가했어요.`)
            return branch
        }).catch((error) => {
            toast.error(errorMessage(error, "지점을 추가하지 못했어요."))
            throw error
        })
    }

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
        setEditCategoryIds(restaurant.categories.map((category) => category.id))
        setEditName(restaurant.name)
        setEditDescription(restaurant.description ?? "")
        setIsEditingRestaurant(true)
    }

    const saveRestaurant = () => {
        if (!editName.trim() || editCategoryIds.length === 0) {
            toast.error("음식점 이름과 카테고리를 하나 이상 골라주세요.")
            return;
        }

        const restaurantUpdate = RESTAURANT_API.update
        apiRequest[restaurantUpdate.method](restaurantUpdate.endpoint({
            restaurant: Number(restaurantId)
        }), {
            body: JSON.stringify({
                category_ids: editCategoryIds,
                name: editName.trim(),
                description: editDescription.trim(),
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

    const openSheet = (review: RestaurantReviewType | null, initial: Partial<ReviewDraft> = {}) => {
        setSheet((prev) => ({
            review,
            initial: {ordered_at: today(), branch: null, menu: "", point: 1, content: "", ...initial},
            seq: (prev?.seq ?? 0) + 1,
        }))
        setIsSheetOpen(true)
    }

    // 새 기록. "또 먹었어요"는 그 메뉴와 지난번 만족도·지점을 채워서 연다.
    // 지점을 골라 보고 있는 중이면 그 지점이 먼저다.
    const startRecording = (summary?: MenuSummaryType) => {
        const branch = typeof selectedBranch === "number" ? selectedBranch : summary?.last_branch ?? null
        openSheet(null, summary
            ? {menu: summary.menu, point: summary.last_point as SentimentKey, branch}
            : {branch})
    }

    const startEditingReview = (review: RestaurantReviewType) => {
        openSheet(review, {
            ordered_at: review.ordered_at,
            menu: review.menu ?? "",
            point: review.point as SentimentKey,
            content: review.content ?? "",
            branch: review.branch ?? null,
        })
    }

    const submitReview = (draft: ReviewDraft) => {
        const editing = sheet?.review
        const request = editing
            ? apiRequest[RESTAURANT_REVIEW_API.update.method]<RestaurantReviewType>(RESTAURANT_REVIEW_API.update.endpoint({
                restaurant: Number(restaurantId),
                review: editing.id,
            }), {body: JSON.stringify(draft)})
            : apiRequest[RESTAURANT_REVIEW_API.add.method]<RestaurantReviewType>(RESTAURANT_REVIEW_API.add.endpoint({
                restaurant: Number(restaurantId)
            }), {body: JSON.stringify(draft)})

        return request.then((saved) => {
            setIsSheetOpen(false)
            if (editing) setReviews((prev) => prev.map((review) => review.id === saved.id ? saved : review))
            // 요약/카운트가 서버에서 재계산되므로 상세를 다시 불러온다
            fetchRestaurant()
            if (!editing && activeTab === "all") fetchReviews(menuFilter, 1, false)
            toast.success(editing ? "리뷰를 고쳤어요." : "기록했어요.")
        }).catch((error) => {
            toast.error(errorMessage(error, editing ? "리뷰를 고치지 못했어요." : "기록에 실패했어요. 잠시 후 다시 시도해주세요."))
        })
    }

    // 확인은 리뷰 메뉴 시트 안의 확인 단계가 맡는다
    const deleteReview = (reviewId: number) => {
        const reviewDelete = RESTAURANT_REVIEW_API.delete
        apiRequest[reviewDelete.method](reviewDelete.endpoint({
            restaurant: Number(restaurantId),
            review: reviewId
        })).then(() => {
            setReviews((prev) => prev.filter((review) => review.id !== reviewId))
            setReviewCount((prev) => Math.max(prev - 1, 0))
            // 메뉴 요약/평균이 서버에서 재계산되므로 상세를 다시 불러온다
            fetchRestaurant()
            toast.success("리뷰를 삭제했어요.")
        }).catch((error) => {
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
            <div className="min-h-[100%] bg-white pb-28">

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
                        {categoryLabel(restaurant.categories)}
                    </div>
                    {/* 설명은 쓴 경우에만 보여준다 (비어 있으면 "소개 없음" 칸이 자리만 차지했다) */}
                    {restaurant.description && (
                        <div className="text-[12.5px] text-[#5B5548] mt-2 leading-relaxed bg-white px-3 py-1.5 rounded border border-[#E7E0CF] whitespace-pre-wrap">
                            {restaurant.description}
                        </div>
                    )}
                    <div className="text-[11.5px] text-[#B7AF9F] font-medium mt-1.5">
                        방문 {restaurant.ordered_count}회 · 최근 방문 {restaurant.latest_ordered_at || "-"} · 전체
                        리뷰 {restaurant.review_count} 개
                    </div>
                </div>

                {/* ---- 지점 거르기 (지점이 있을 때만) ---- */}
                {restaurant.branches.length > 0 && (
                    <div role="radiogroup" aria-label="지점"
                         className="flex gap-1.5 overflow-x-auto px-5 mb-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        {[{id: null as number | "none" | null, label: "모든 지점"},
                            ...restaurant.branches.map((b) => ({id: b.id as number | "none" | null, label: b.name})),
                            {id: "none" as const, label: "지점 없음"}].map((option) => {
                            const active = selectedBranch === option.id
                            return (
                                <button key={String(option.id)} role="radio" aria-checked={active}
                                        onClick={() => chooseBranch(option.id)}
                                        className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-[12.5px] font-bold border cursor-pointer transition-colors ${
                                            active ? "bg-[#211D17] text-white border-[#211D17]"
                                                : "bg-white text-[#8A8172] border-[#E7E0CF]"
                                        }`}>
                                    {option.label}
                                </button>
                            )
                        })}
                    </div>
                )}

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
                                                onClick={() => startRecording(summary)}
                                                aria-label={`${menu} 또 먹었어요`}
                                                className="shrink-0 text-[11.5px] font-bold text-[#D2571E] bg-[#FDEBE1] rounded-full px-2.5 py-1.5 cursor-pointer sm:hover:bg-[#FBDCCB] transition-colors"
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
                                                className="my-auto text-[11.5px] text-[#B7AF9F] font-semibold ml-auto shrink-0 text-right">
                                                {review.ordered_at}
                                                {review.branch_name && <div className="text-[#8A8172]">{review.branch_name}</div>}
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

                {/* ---- 리뷰 쓰기·고치기 시트 ---- */}
                {sheet && (
                    <ReviewSheet
                        key={sheet.seq}
                        open={isSheetOpen}
                        onOpenChange={setIsSheetOpen}
                        title={sheet.review ? "리뷰 수정" : sheet.initial.menu ? `${sheet.initial.menu} 또 먹었어요` : "먹은 메뉴 기록"}
                        submitLabel={sheet.review ? "수정하기" : "기록하기"}
                        initial={sheet.initial}
                        menus={restaurant.menus}
                        branches={restaurant.branches}
                        onCreateBranch={createBranch}
                        onSubmit={submitReview}
                    />
                )}

                {/* ---- 화면 아래 고정 기록 버튼 ---- */}
                <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full sm:w-[70%] bg-white/95 backdrop-blur border-t border-[#E7E0CF] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                    <button
                        onClick={() => startRecording()}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#D2571E] text-white font-extrabold text-[15px] cursor-pointer sm:hover:bg-[#b84a19] transition-colors"
                    >
                        <LuPencilLine size={17}/>
                        먹은 메뉴 기록하기
                    </button>
                </div>

                {/* ---- 음식점 수정 ---- */}
                <Modal
                    title="음식점 수정"
                    open={isEditingRestaurant}
                    onOpenChange={setIsEditingRestaurant}
                >
                    <div className="flex flex-col gap-3">
                        <div>
                            <div id="edit-categories-label" className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                카테고리 <span className="text-[#D2571E]">*</span>
                            </div>
                            <CategoryChips categories={categories} selected={editCategoryIds}
                                           onChange={setEditCategoryIds} labelledBy="edit-categories-label"/>
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
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) saveRestaurant()
                                }}
                                placeholder="예: 양념은 따로 달라고 하기"
                                className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                        </div>

                        <div>
                            <div className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                지점 <span className="font-medium text-[#B7AF9F]">메뉴는 같고 맛이 다른 곳</span>
                            </div>
                            <BranchManager restaurantId={restaurant.id} branches={restaurant.branches}
                                           onCreate={createBranch} onChanged={() => {
                                // 지운 지점으로 거르고 있었다면 전체로 돌린다
                                setSelectedBranch(null)
                                fetchRestaurant()
                            }}/>
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