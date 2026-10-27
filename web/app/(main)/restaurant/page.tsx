"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {useAppRouter} from "@/components/navigation_progress";
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {RESTAURANT_API, RESTAURANT_PAGE} from "@/constants/routeUrl";
import {RestaurantListItemType, RestaurantSort, RestaurantType} from "@/types/restaurant";
import {useZoneStore} from "@/store/zone";
import {useCategoryStore} from "@/store/category";
import {categoryLabel, fetchZoneRestaurants} from "@/lib/restaurant";
import {Skeleton} from "@/components/skeleton";
import {LuEllipsisVertical, LuSearch, LuX} from "react-icons/lu";
import {ActionDrawer} from "@/components/ui/action_drawer";
import {Dropdown} from "@/components/ui/dropdown";
import {apiRequest, toastError} from "@/lib/api";
import toast from "react-hot-toast";
import {RestaurantEditSheet} from "@/components/restaurant/restaurant_edit_sheet";
import {getReviewTextBox} from "@/components/ui/review_textbox";

const SORT_OPTIONS: { value: RestaurantSort; label: string }[] = [
    {value: "recent", label: "최근 방문순"},
    {value: "rating", label: "만족도순"},
    {value: "visits", label: "방문 많은순"},
    {value: "name", label: "이름순"},
]

export default function Page() {
    const router = useAppRouter()
    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    const selectedZoneId = selectedZone?.id
    const categories = useCategoryStore(state => state.categories)

    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [sort, setSort] = useState<RestaurantSort>("recent")
    // 입력할 때마다 요청하지 않도록 잠깐 멈췄을 때의 값으로 검색한다
    const [searchInput, setSearchInput] = useState("")
    const [search, setSearch] = useState("")

    const [restaurants, setRestaurants] = useState<RestaurantListItemType[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    // 존이 바뀌면 이전 존의 카테고리 필터가 남아 "0곳"으로 보였다. 존이 바뀌면 전체로 되돌린다.
    const [trackedZoneId, setTrackedZoneId] = useState(selectedZoneId)
    if (selectedZoneId !== trackedZoneId) {
        setTrackedZoneId(selectedZoneId)
        setSelectedCategoryId(null)
    }

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 250)
        return () => clearTimeout(timer)
    }, [searchInput])

    const listKey = `${selectedZoneId ?? ""}:${selectedCategoryId ?? "all"}:${sort}:${search}`
    const [trackedListKey, setTrackedListKey] = useState(listKey)
    if (listKey !== trackedListKey) {
        setTrackedListKey(listKey)
        setRestaurants([])
        setPage(1)
        setHasMore(true)
        setIsLoading(true)
    }

    const sentinelRef = useRef<HTMLDivElement | null>(null)

    // 음식점 수정 시트. 지점 목록이 필요해서 상세를 받아서 연다. 열 때마다 seq를 올려 폼을 새로 만든다.
    const [editing, setEditing] = useState<{ restaurant: RestaurantType; seq: number } | null>(null)
    const [isEditOpen, setIsEditOpen] = useState(false)

    useEffect(() => {
        if (!token) router.replace("/login")
    }, [token, router])

    useEffect(() => {
        if (!selectedZoneId) return
        // 필터를 빠르게 바꾸면 이전 요청의 응답이 늦게 와서 목록을 덮어쓸 수 있다
        let ignore = false

        fetchZoneRestaurants(selectedZoneId, {categoryId: selectedCategoryId, page: 1, search, sort})
            .then((res) => {
                if (ignore) return
                setRestaurants(res.results)
                setTotalCount(res.count)
                setHasMore(Boolean(res.next))
            })
            .catch((error) => {
                if (ignore) return
                setHasMore(false)
                toastError(error)
            })
            .finally(() => {
                if (!ignore) setIsLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [selectedZoneId, selectedCategoryId, search, sort]);

    const loadMore = useCallback(() => {
        if (!selectedZoneId || isLoading || isFetchingMore || !hasMore) return

        const nextPage = page + 1
        setIsFetchingMore(true)
        fetchZoneRestaurants(selectedZoneId, {categoryId: selectedCategoryId, page: nextPage, search, sort})
            .then((res) => {
                setRestaurants((prev) => [...prev, ...res.results])
                setTotalCount(res.count)
                setPage(nextPage)
                setHasMore(Boolean(res.next))
            })
            .catch((error) => {
                // 실패한 페이지를 센티널이 무한히 다시 요청하지 않도록 멈춘다
                setHasMore(false)
                toastError(error)
            })
            .finally(() => setIsFetchingMore(false))
    }, [selectedZoneId, selectedCategoryId, search, sort, page, isLoading, isFetchingMore, hasMore]);

    useEffect(() => {
        const target = sentinelRef.current
        if (!target) return

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) loadMore()
        }, {rootMargin: "200px"})

        observer.observe(target)
        return () => observer.disconnect()
    }, [loadMore]);

    // 상세 화면 코드를 미리 받아 두어 누르면 바로 넘어가게 한다 (어느 음식점이든 같은 코드)
    const firstRestaurantId = restaurants[0]?.id
    useEffect(() => {
        if (firstRestaurantId) router.prefetch(RESTAURANT_PAGE.detail(firstRestaurantId))
    }, [firstRestaurantId, router])

    const gotoRestaurant = (_id: number) => {
        router.push(RESTAURANT_PAGE.detail(_id))
    }
    const fetchRestaurant = (_id: number) => {
        const retrieve = RESTAURANT_API.retrieve
        return apiRequest[retrieve.method]<RestaurantType>(retrieve.endpoint({restaurant: _id}))
    }

    const editRestaurant = (_id: number) => {
        fetchRestaurant(_id).then((restaurant) => {
            setEditing((prev) => ({restaurant, seq: (prev?.seq ?? 0) + 1}))
            setIsEditOpen(true)
        }).catch((error) => toastError(error, "음식점 정보를 불러오지 못했어요."))
    }

    // 저장했으면 목록의 그 칸을, 지점을 바꿨으면 시트의 지점 목록을 새로 고친다
    const refreshEditing = (_id: number) => {
        fetchRestaurant(_id).then((restaurant) => {
            setEditing((prev) => prev && prev.restaurant.id === _id ? {...prev, restaurant} : prev)
            setRestaurants((prev) => prev.map((item) => item.id === _id ? {
                ...item,
                name: restaurant.name,
                description: restaurant.description,
                categories: restaurant.categories,
            } : item))
        }).catch(() => null)
    }

    const deleteRestaurant = (_id: number) => {
        const deleteRestaurantAPI = RESTAURANT_API.delete
        apiRequest[deleteRestaurantAPI.method](deleteRestaurantAPI.endpoint({restaurant: _id})).then(() => {
            setRestaurants((prev) => prev.filter(x => x.id !== _id))
            setTotalCount((prev) => Math.max(prev - 1, 0))
            toast.success("음식점을 삭제했어요.")
        }).catch((error) => toastError(error))
    }

    if (!token || !selectedZone) return <LoadingPage/>

    return (
        <div className="flex flex-col min-h-[100%]">
            <div className="sticky top-0 z-10 bg-bg pt-1">
            <div className="px-4">
                <div className="relative">
                    <LuSearch size={18}
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none"/>
                    <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="음식점 이름으로 찾기"
                        aria-label="음식점 이름으로 찾기"
                        maxLength={100}
                        className="w-full h-12 text-[15px] text-ink bg-surface rounded-[14px] pl-11 pr-11 outline-none focus:ring-2 focus:ring-strong transition-shadow placeholder:text-ink4 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searchInput && (
                        <button
                            onClick={() => setSearchInput("")}
                            aria-label="검색어 지우기"
                            className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full text-ink3 cursor-pointer sm:hover:bg-fill transition-colors"
                        >
                            <LuX size={16}/>
                        </button>
                    )}
                </div>
            </div>
            <div
                className="flex gap-1.5 overflow-x-auto px-4 pt-2.5 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={`shrink-0 h-10 px-4 rounded-full text-[14px] cursor-pointer whitespace-nowrap transition-colors ${
                        selectedCategoryId === null
                            ? "bg-strong text-white font-bold"
                            : "bg-surface text-ink2 font-semibold sm:hover:bg-fill-hover"
                    }`}
                >
                    전체
                </button>
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`shrink-0 h-10 px-4 rounded-full text-[14px] cursor-pointer whitespace-nowrap transition-colors ${
                            selectedCategoryId === category.id
                                ? "bg-strong text-white font-bold"
                                : "bg-surface text-ink2 font-semibold sm:hover:bg-fill-hover"
                        }`}
                    >
                        {category.keyword}
                    </button>
                ))}
            </div>

            <div className="flex items-center justify-between px-5 h-11">
                <div className="text-[13px] font-semibold text-ink3">총 {totalCount}곳</div>
                <Dropdown value={sort} options={SORT_OPTIONS} onChange={setSort} label="정렬"/>
            </div>
            </div>

            <div className="mx-4 mb-4 rounded-3xl bg-surface pl-5 pr-2 py-1.5">
                {isLoading ? (
                    Array.from({length: 6}).map((_, i) => <Skeleton key={i}/>)
                ) : !restaurants.length ? (
                    <p className="text-ink3 text-center py-8 pr-3 text-[13.5px]">
                        {search ? `'${search}'에 맞는 음식점이 없어요.` : "아직 등록된 음식점이 없습니다."}
                    </p>
                ) : (
                    restaurants.map((restaurant) => (
                        <div key={restaurant.id}
                             className="flex items-center gap-1 border-b border-line last:border-0 cursor-pointer"
                        >
                            <div className="flex-1 min-w-0 flex items-center gap-2.5 py-3.5" onClick={() => gotoRestaurant(restaurant.id)}>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[16px] text-ink tracking-tight truncate">{restaurant.name}</p>
                                    <p className="text-[13px] text-ink3 mt-0.5 line-clamp-2">{restaurant.description || `${categoryLabel(restaurant.categories)} 음식점`}</p>
                                    <div className="flex flex-row mt-1">
                                        <div
                                            className="text-[13px] text-ink3">방문 {restaurant.ordered_count} 회
                                        </div>
                                        {restaurant.latest_ordered_at && (
                                            <>
                                                <span className="inline-block mx-2 text-ink3">·</span>
                                                <div className="text-[13px] text-ink3">최근
                                                    방문 {restaurant.latest_ordered_at}</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {restaurant.review_avg !== null && restaurant.ordered_count > 0 && getReviewTextBox(restaurant.review_avg)}
                            </div>
                            <ActionDrawer
                                trigger={
                                    <button
                                        aria-label={`${restaurant.name} 메뉴 열기`}
                                        className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-ink3 cursor-pointer sm:hover:bg-fill transition-colors">
                                        <LuEllipsisVertical size={18}/>
                                    </button>
                                }
                                items={[{
                                    label: "음식점 수정",
                                    onClick: () => editRestaurant(restaurant.id),
                                }, {
                                    label: "음식점 삭제",
                                    danger: true,
                                    onClick: () => deleteRestaurant(restaurant.id),
                                    confirm: {
                                        title: `'${restaurant.name}'을(를) 삭제할까요?`,
                                        description: "남긴 리뷰도 모두 함께 사라지고 되돌릴 수 없어요.",
                                        confirmLabel: "삭제",
                                    },
                                }]}
                            />
                        </div>
                    ))
                )}

                {isFetchingMore && <Skeleton/>}

                <div ref={sentinelRef} className="h-1"/>
            </div>

            {editing && (
                <RestaurantEditSheet
                    key={editing.seq}
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    restaurant={editing.restaurant}
                    onChanged={() => refreshEditing(editing.restaurant.id)}
                />
            )}
        </div>
    )
}