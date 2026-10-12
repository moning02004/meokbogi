"use client"

import {useEffect, useState} from "react"
import {Drawer} from "vaul"
import {LuCheck, LuSearch} from "react-icons/lu"
import toast from "react-hot-toast"
import {errorMessage} from "@/lib/api"
import {categoryLabel, fetchZoneRestaurants} from "@/lib/restaurant"
import {useKeyboardInset, useVisibleHeight} from "@/hooks/useVisualViewport"
import {useZoneStore} from "@/store/zone"
import {RestaurantListItemType} from "@/types/restaurant"

interface RestaurantPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    // 이미 골목에 실린 음식점
    pickedIds: number[]
    onPick: (restaurant: RestaurantListItemType, zoneName: string) => void
}

// 골목에 실을 음식점 고르기. 골목은 장소를 가리지 않으므로 장소를 바꿔 가며 고른다. 많이 간 집이 위에 온다.
export function RestaurantPicker({open, onOpenChange, pickedIds, onPick}: RestaurantPickerProps) {
    const zones = useZoneStore((state) => state.zones)
    const selectedZone = useZoneStore((state) => state.selectedZone)
    const [zoneId, setZoneId] = useState<number | null>(null)
    const activeZoneId = zoneId ?? selectedZone?.id ?? zones[0]?.id ?? null

    const [searchInput, setSearchInput] = useState("")
    const [search, setSearch] = useState("")
    const [restaurants, setRestaurants] = useState<RestaurantListItemType[]>([])
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const keyboardInset = useKeyboardInset()
    const visibleHeight = useVisibleHeight()

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 250)
        return () => clearTimeout(timer)
    }, [searchInput])

    const listKey = `${activeZoneId ?? ""}:${search}`
    const [trackedListKey, setTrackedListKey] = useState(listKey)
    if (listKey !== trackedListKey) {
        setTrackedListKey(listKey)
        setRestaurants([])
        setPage(1)
        setIsLoading(true)
    }

    useEffect(() => {
        if (!open || !activeZoneId) return
        let ignore = false
        fetchZoneRestaurants(activeZoneId, {search, sort: "visits"})
            .then((res) => {
                if (ignore) return
                setRestaurants(res.results)
                setHasMore(Boolean(res.next))
            })
            .catch((error) => {
                if (!ignore) toast.error(errorMessage(error))
            })
            .finally(() => {
                if (!ignore) setIsLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [open, activeZoneId, search])

    const loadMore = () => {
        if (!activeZoneId) return
        const nextPage = page + 1
        fetchZoneRestaurants(activeZoneId, {search, sort: "visits", page: nextPage})
            .then((res) => {
                setRestaurants((prev) => [...prev, ...res.results])
                setPage(nextPage)
                setHasMore(Boolean(res.next))
            })
            .catch((error) => {
                setHasMore(false)
                toast.error(errorMessage(error))
            })
    }

    const zoneName = zones.find((zone) => zone.id === activeZoneId)?.name ?? ""

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>
                <Drawer.Content
                    aria-describedby={undefined}
                    className="fixed left-0 right-0 z-50 mx-auto w-full max-w-[560px] flex flex-col bg-surface rounded-t-[28px] outline-none"
                    style={{
                        bottom: keyboardInset,
                        height: visibleHeight ? Math.min(visibleHeight - 12, 720) : "88dvh",
                    }}
                >
                    <div className="shrink-0 flex flex-col items-center pt-2.5">
                        <div className="w-10 h-1 rounded-full bg-line" aria-hidden/>
                    </div>
                    <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-2">
                        <Drawer.Title className="text-[16px] font-extrabold text-ink">음식점 고르기</Drawer.Title>
                        <Drawer.Close
                            className="text-[12.5px] font-bold text-ink3 cursor-pointer p-2 -m-2 transition-colors">
                            닫기
                        </Drawer.Close>
                    </div>

                    <div className="shrink-0 px-5 pb-2 flex flex-col gap-2">
                        {zones.length > 1 && (
                            <div
                                className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {zones.map((zone) => (
                                    <button
                                        key={zone.id}
                                        onClick={() => setZoneId(zone.id)}
                                        aria-pressed={zone.id === activeZoneId}
                                        className={`shrink-0 h-10 px-4 rounded-full text-[14px] cursor-pointer whitespace-nowrap transition-colors ${
                                            zone.id === activeZoneId
                                                ? "bg-strong text-white font-bold"
                                                : "bg-fill text-ink2 font-semibold sm:hover:bg-fill-hover"
                                        }`}
                                    >
                                        {zone.name}
                                    </button>
                                ))}
                            </div>
                        )}
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
                                className="w-full h-12 text-[15px] text-ink bg-fill rounded-[14px] pl-11 pr-4 outline-none focus:ring-2 focus:ring-strong transition-shadow placeholder:text-ink4 [&::-webkit-search-cancel-button]:hidden"
                            />
                        </div>
                    </div>

                    <div
                        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                        {isLoading ? (
                            <p className="text-ink3 text-center py-8 text-[13.5px]">불러오는 중…</p>
                        ) : !restaurants.length ? (
                            <p className="text-ink3 text-center py-8 text-[13.5px]">
                                {search ? `'${search}'에 맞는 음식점이 없어요.` : "이 장소에 등록된 음식점이 없어요."}
                            </p>
                        ) : restaurants.map((restaurant) => {
                            const picked = pickedIds.includes(restaurant.id)
                            return (
                                <button
                                    key={restaurant.id}
                                    onClick={() => onPick(restaurant, zoneName)}
                                    disabled={picked}
                                    className="w-full flex items-center gap-3 py-3 text-left border-b border-line last:border-0 cursor-pointer disabled:cursor-default"
                                >
                                    <span className="flex-1 min-w-0">
                                        <span className={`block font-bold text-[15.5px] tracking-tight truncate ${picked ? "text-ink3" : "text-ink"}`}>
                                            {restaurant.name}
                                        </span>
                                        <span className="block text-[12.5px] text-ink3 mt-0.5 truncate">
                                            {categoryLabel(restaurant.categories)} · 방문 {restaurant.ordered_count}회
                                        </span>
                                    </span>
                                    {picked ? (
                                        <span className="shrink-0 flex items-center gap-1 text-[12.5px] font-bold text-ink3">
                                            <LuCheck size={15}/> 담음
                                        </span>
                                    ) : (
                                        <span className="shrink-0 text-[12.5px] font-bold text-ink bg-fill px-3 py-1.5 rounded-full">
                                            담기
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                        {hasMore && !isLoading && (
                            <button onClick={loadMore}
                                    className="w-full h-12 mt-2 rounded-xl bg-fill text-ink font-bold text-[14px] cursor-pointer sm:hover:bg-fill-hover transition-colors">
                                더 보기
                            </button>
                        )}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
