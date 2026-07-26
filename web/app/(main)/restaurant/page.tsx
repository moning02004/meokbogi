"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {RESTAURANT_API, RESTAURANT_PAGE} from "@/constants/routeUrl";
import {RestaurantListItemType} from "@/types/restaurant";
import {useZoneStore} from "@/store/zone";
import {useCategoryStore} from "@/store/category";
import {fetchZoneRestaurants} from "@/lib/restaurant";
import {Skeleton} from "@/components/skeleton";
import {LuEllipsisVertical} from "react-icons/lu";
import {ActionDrawer} from "@/components/ui/action_drawer";
import {apiRequest} from "@/lib/api";

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    const categories = useCategoryStore(state => state.categories)

    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

    const [restaurants, setRestaurants] = useState<RestaurantListItemType[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    const listKey = `${selectedZone?.id ?? ""}:${selectedCategoryId ?? "all"}`
    const [trackedListKey, setTrackedListKey] = useState(listKey)
    if (listKey !== trackedListKey) {
        setTrackedListKey(listKey)
        setRestaurants([])
        setPage(1)
        setHasMore(true)
        setIsLoading(true)
    }

    const sentinelRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!token) router.replace("/login")
    }, [token, router])

    useEffect(() => {
        if (!selectedZone) return

        fetchZoneRestaurants(selectedZone.id, {categoryId: selectedCategoryId, page: 1})
            .then((res) => {
                setRestaurants(res.results)
                setTotalCount(res.count)
                setHasMore(Boolean(res.next))
            })
            .finally(() => setIsLoading(false))
    }, [selectedZone, selectedCategoryId]);

    const loadMore = useCallback(() => {
        if (!selectedZone || isLoading || isFetchingMore || !hasMore) return

        const nextPage = page + 1
        setIsFetchingMore(true)
        fetchZoneRestaurants(selectedZone.id, {categoryId: selectedCategoryId, page: nextPage})
            .then((res) => {
                setRestaurants((prev) => [...prev, ...res.results])
                setTotalCount(res.count)
                setPage(nextPage)
                setHasMore(Boolean(res.next))
            })
            .finally(() => setIsFetchingMore(false))
    }, [selectedZone, selectedCategoryId, page, isLoading, isFetchingMore, hasMore]);

    useEffect(() => {
        const target = sentinelRef.current
        if (!target) return

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) loadMore()
        }, {rootMargin: "200px"})

        observer.observe(target)
        return () => observer.disconnect()
    }, [loadMore]);

    const gotoRestaurant = (_id: number) => {
        router.push(RESTAURANT_PAGE.detail(_id))
    }
    const deleteRestaurant = (_id: number) => {
        const deleteRestaurantAPI = RESTAURANT_API.delete
        apiRequest[deleteRestaurantAPI.method](deleteRestaurantAPI.endpoint({restaurant: _id})).then(() => {
            setRestaurants(() => restaurants.filter(x => x.id != _id))
        })
    }

    if (!token || !selectedZone) return <LoadingPage/>

    return (
        <div className="flex flex-col min-h-[100%]">
            <div
                className="flex gap-2 overflow-x-auto px-4 py-2 sticky top-0 bg-white shadow-sm mb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={`shrink-0 px-4 py-1 rounded-full text-[13.5px] font-semibold border cursor-pointer whitespace-nowrap transition-colors ${
                        selectedCategoryId === null
                            ? "bg-[#24564A] text-white border-[#24564A]"
                            : "bg-white text-[#8A8172] border-[#E7E0CF] sm:hover:bg-[#F6F3EC]"
                    }`}
                >
                    전체
                </button>
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`shrink-0 px-4 py-1 rounded-full text-[13.5px] font-semibold border cursor-pointer whitespace-nowrap transition-colors ${
                            selectedCategoryId === category.id
                                ? "bg-[#24564A] text-white border-[#24564A]"
                                : "bg-white text-[#8A8172] border-[#E7E0CF] sm:hover:bg-[#F6F3EC]"
                        }`}
                    >
                        {category.keyword}
                    </button>
                ))}
            </div>

            <div className="px-4 my-2 text-[12.5px] font-semibold text-[#8A8172]">총 {totalCount}곳</div>

            <div className="flex flex-col px-4 gap-2.5 pb-3">
                {isLoading ? (
                    Array.from({length: 6}).map((_, i) => <Skeleton key={i}/>)
                ) : !restaurants.length ? (
                    <p className="text-[#B7AF9F] text-center py-8 text-sm">아직 등록된 식당이 없습니다.</p>
                ) : (
                    restaurants.map((restaurant) => (
                        <div key={restaurant.id}
                             className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E7E0CF] cursor-pointer sm:hover:bg-white transition-colors"
                        >
                            <div className="flex-1" onClick={() => gotoRestaurant(restaurant.id)}>
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
                            <ActionDrawer
                                trigger={
                                    <button
                                        className="ml-auto text-[#D8D0BC] shrink-0 self-start cursor-pointer p-1 -m-1">
                                        <LuEllipsisVertical size={16}/>
                                    </button>
                                }
                                items={[{
                                    label: "음식점 삭제",
                                    danger: true,
                                    onClick: () => deleteRestaurant(restaurant.id),
                                }]}
                            />
                        </div>
                    ))
                )}

                {isFetchingMore && <Skeleton/>}

                <div ref={sentinelRef} className="h-1"/>
            </div>
        </div>
    )
}