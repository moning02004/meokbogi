"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import toast from "react-hot-toast"
import {LuChevronDown, LuSearch, LuX} from "react-icons/lu"

import {getReviewTextBox} from "@/components/ui/review_textbox"
import {CATEGORY_API, RESTAURANT_PAGE} from "@/constants/routeUrl"
import {apiRequest, errorMessage} from "@/lib/api"
import {syncZones} from "@/lib/zone"
import {useZoneStore} from "@/store/zone"
import {RestaurantListItemType} from "@/types/restaurant"
import {ManagedCategoryType} from "@/types/zone"

interface CategoryManagerProps {
    // 목록을 새로 읽을 때마다 호출된다. mutated는 이름 바꾸기·삭제 직후인지 여부.
    onCategoriesChange?: (categories: ManagedCategoryType[], mutated: boolean) => void
}

type ZoneGroup = { zone: { id: number; name: string }; restaurants: RestaurantListItemType[] }

// 대소문자·공백 차이만 있는 건 같은 카테고리로 본다 ("돈 까스" vs "돈까스")
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "")

// 카테고리별로 어느 장소에 어떤 음식점이 있는지 본다. 카테고리는 장소와 상관없이 한 벌이고,
// 새 카테고리는 음식점을 등록할 때 만든다. 여기서는 찾아보기와 이름 바꾸기·지우기만.
export function CategoryManager({onCategoriesChange}: CategoryManagerProps) {
    const router = useRouter()
    const [categories, setCategories] = useState<ManagedCategoryType[] | null>(null)
    const [keyword, setKeyword] = useState("")
    const [openId, setOpenId] = useState<number | null>(null)
    // 펼쳐 본 카테고리의 장소별 음식점 (다시 펼칠 때 바로 보이도록 남겨 둔다)
    const [groups, setGroups] = useState<Record<number, ZoneGroup[]>>({})
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValue, setEditValue] = useState("")
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showEmpty, setShowEmpty] = useState(false)

    // 부모가 인라인 함수를 넘겨도 목록을 다시 읽지 않도록 ref로 받아둔다
    const notify = useRef(onCategoriesChange)
    useEffect(() => {
        notify.current = onCategoriesChange
    })

    const loadCategories = useCallback((mutated: boolean) => {
        const list = CATEGORY_API.list
        return apiRequest[list.method]<ManagedCategoryType[]>(list.endpoint).then((rows) => {
            setCategories(rows)
            notify.current?.(rows, mutated)
        })
    }, [])

    useEffect(() => {
        loadCategories(false).catch(() => null)
    }, [loadCategories])

    const toggle = (category: ManagedCategoryType) => {
        const next = openId === category.id ? null : category.id
        setOpenId(next)
        setEditingId(null)
        setConfirmingDeleteId(null)
        if (next === null || category.restaurant_count === 0) return
        const restaurants = CATEGORY_API.restaurants
        apiRequest[restaurants.method]<ZoneGroup[]>(restaurants.endpoint({category: category.id}))
            .then((rows) => setGroups((prev) => ({...prev, [category.id]: rows})))
            .catch((error) => toast.error(errorMessage(error, "음식점을 불러오지 못했어요.")))
    }

    // 다른 장소의 음식점이면 그 장소로 바꾼 뒤 상세로 간다 (돌아왔을 때 목록이 그 장소 기준이도록)
    const openRestaurant = async (zoneId: number, restaurantId: number) => {
        const zoneStore = useZoneStore.getState()
        let zone = zoneStore.zones.find((z) => z.id === zoneId)
        if (!zone) zone = (await syncZones().catch(() => [])).find((z) => z.id === zoneId)
        if (zone) zoneStore.setSelectedZone(zone)
        router.push(RESTAURANT_PAGE.detail(restaurantId))
    }

    const editTrimmed = editValue.trim()
    const editDuplicate = editTrimmed !== "" && (categories?.some(
        (category) => category.id !== editingId && normalize(category.keyword) === normalize(editTrimmed)
    ) ?? false)

    const rename = (category: ManagedCategoryType) => {
        if (isSubmitting || !editTrimmed || editDuplicate) return
        if (editTrimmed === category.keyword) {
            setEditingId(null)
            return
        }
        setIsSubmitting(true)
        const update = CATEGORY_API.update
        apiRequest[update.method](update.endpoint({category: category.id}), {
            body: JSON.stringify({keyword: editTrimmed}),
        }).then(() => {
            setEditingId(null)
            toast.success("카테고리 이름을 바꿨어요.")
            return loadCategories(true)
        }).catch((error) => {
            toast.error(errorMessage(error, "이름을 바꾸지 못했어요."))
        }).finally(() => setIsSubmitting(false))
    }

    const remove = (category: ManagedCategoryType) => {
        if (isSubmitting) return
        setIsSubmitting(true)
        const remove = CATEGORY_API.delete
        apiRequest[remove.method](remove.endpoint({category: category.id})).then(() => {
            toast.success(`'${category.keyword}' 카테고리를 지웠어요.`)
            setOpenId(null)
            return loadCategories(true)
        }).catch((error) => {
            // 목록을 받은 뒤에 음식점이 생겼다면 서버가 400으로 막는다 (메시지는 서버가 준 사유)
            toast.error(errorMessage(error, "카테고리를 지우지 못했어요."))
            return loadCategories(true)
        }).finally(() => {
            setIsSubmitting(false)
            setConfirmingDeleteId(null)
        })
    }

    const query = normalize(keyword.trim())
    const matched = categories?.filter((category) => !query || normalize(category.keyword).includes(query)) ?? null
    // 음식점이 있는 카테고리를 많은 순으로 위에. 비어 있는 기본 카테고리들이 앞을 가리지 않게 접어 둔다 (찾을 때는 다 보여준다)
    const used = matched?.filter((c) => c.restaurant_count > 0).sort((a, b) => b.restaurant_count - a.restaurant_count) ?? null
    const empty = matched?.filter((c) => c.restaurant_count === 0) ?? []
    const visible = used === null ? null : (query || showEmpty) ? [...used, ...empty] : used

    return (
        <div>
            <div className="relative">
                <LuSearch size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B7AF9F] pointer-events-none"/>
                <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="카테고리 찾기"
                    aria-label="카테고리 찾기"
                    maxLength={100}
                    className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg pl-8.5 pr-8 py-2.5 outline-none focus:border-[#24564A] transition-colors"
                />
                {keyword && (
                    <button onClick={() => setKeyword("")} aria-label="검색어 지우기"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#B7AF9F] cursor-pointer">
                        <LuX size={13}/>
                    </button>
                )}
            </div>

            <div className="mt-3">
                {visible === null ? (
                    <div className="flex flex-col gap-1.5">
                        {[0, 1, 2].map((row) => <div key={row} className="h-[52px] rounded-lg bg-[#F6F3EC] animate-pulse"/>)}
                    </div>
                ) : (matched?.length ?? 0) === 0 ? (
                    <p className="text-[13px] text-[#8A8172] py-3 text-center leading-relaxed">
                        {query ? "맞는 카테고리가 없어요." : "카테고리가 없어요."}<br/>
                        <span className="text-[12px] text-[#B7AF9F]">새 카테고리는 음식점을 등록할 때 만들 수 있어요.</span>
                    </p>
                ) : visible.length === 0 ? (
                    <p className="text-[13px] text-[#8A8172] py-3 text-center">아직 음식점을 등록한 카테고리가 없어요.</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-[#F0EBDD] border border-[#E7E0CF] rounded-xl overflow-hidden">
                        {visible.map((category) => {
                            const isOpen = openId === category.id
                            const summary = category.zones.length
                                ? category.zones.map((zone) => `${zone.name} ${zone.count}`).join(" · ")
                                : "등록한 음식점 없음"
                            return (
                                <li key={category.id} className="bg-white">
                                    <button
                                        onClick={() => toggle(category)}
                                        aria-expanded={isOpen}
                                        className="w-full flex items-center gap-2 px-3.5 py-3 text-left cursor-pointer sm:hover:bg-[#FBFAF6]"
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-[14px] font-bold text-[#211D17] truncate">{category.keyword}</span>
                                            <span className="block text-[12px] text-[#8A8172] truncate">{summary}</span>
                                        </span>
                                        <span className="shrink-0 text-[11.5px] font-bold rounded-full px-2 py-0.5 bg-[#F1EFE8] text-[#8A8172]">
                                            {category.restaurant_count}곳
                                        </span>
                                        <LuChevronDown size={16}
                                                       className={`shrink-0 text-[#B7AF9F] transition-transform ${isOpen ? "rotate-180" : ""}`}/>
                                    </button>

                                    {isOpen && (
                                        <div className="px-3.5 pb-3 flex flex-col gap-3 bg-[#FBFAF6] border-t border-[#F0EBDD]">
                                            {/* ---- 장소별 음식점 ---- */}
                                            {category.restaurant_count > 0 && (
                                                groups[category.id] === undefined ? (
                                                    <p className="pt-3 text-[12.5px] text-[#B7AF9F]">불러오는 중…</p>
                                                ) : (
                                                    groups[category.id].map((group) => (
                                                        <div key={group.zone.id} className="pt-3">
                                                            <div className="text-[11.5px] font-bold text-[#8A8172] mb-1.5">{group.zone.name}</div>
                                                            <div className="flex flex-col gap-1">
                                                                {group.restaurants.map((restaurant) => (
                                                                    <button key={restaurant.id}
                                                                            onClick={() => openRestaurant(group.zone.id, restaurant.id)}
                                                                            className="flex items-center justify-between gap-2 bg-white border border-[#E7E0CF] rounded-lg px-3 py-2 text-left cursor-pointer sm:hover:bg-[#F6F3EC]">
                                                                        <span className="min-w-0 truncate text-[13.5px] font-semibold text-[#211D17]">{restaurant.name}</span>
                                                                        {restaurant.review_avg !== null
                                                                            ? getReviewTextBox(restaurant.review_avg, "sm")
                                                                            : <span className="shrink-0 text-[11.5px] text-[#B7AF9F]">기록 없음</span>}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))
                                                )
                                            )}

                                            {/* ---- 이름 바꾸기 · 지우기 ---- */}
                                            {editingId === category.id ? (
                                                <div className="pt-3 flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            value={editValue}
                                                            onChange={(event) => setEditValue(event.target.value)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === "Enter" && !event.nativeEvent.isComposing) rename(category)
                                                                if (event.key === "Escape") setEditingId(null)
                                                            }}
                                                            aria-label={`${category.keyword} 새 이름`}
                                                            maxLength={100}
                                                            autoFocus
                                                            className="flex-1 min-w-0 text-[13.5px] font-semibold text-[#211D17] border border-[#24564A] rounded-md px-2.5 py-1.5 outline-none bg-white"
                                                        />
                                                        <button onClick={() => rename(category)} disabled={!editTrimmed || editDuplicate || isSubmitting}
                                                                className="shrink-0 text-[12px] font-bold text-white bg-[#24564A] rounded-md px-2.5 py-1.5 cursor-pointer disabled:opacity-40">
                                                            저장
                                                        </button>
                                                        <button onClick={() => setEditingId(null)}
                                                                className="shrink-0 text-[12px] font-bold text-[#8A8172] px-1.5 py-1.5 cursor-pointer">
                                                            취소
                                                        </button>
                                                    </div>
                                                    {editDuplicate && (
                                                        <p className="text-[11.5px] font-semibold text-[#C23B1E]">
                                                            &lsquo;{editTrimmed}&rsquo;은(는) 이미 있는 카테고리예요.
                                                        </p>
                                                    )}
                                                </div>
                                            ) : confirmingDeleteId === category.id ? (
                                                <div className="pt-3 flex flex-col gap-2">
                                                    <p className="text-[12.5px] text-[#8A6A5C] leading-relaxed">
                                                        &lsquo;{category.keyword}&rsquo;을(를) 지울까요? 음식점은 남고 이 카테고리만 빠져요.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setConfirmingDeleteId(null)}
                                                                className="flex-1 text-[12.5px] font-bold text-[#5B5548] bg-white border border-[#E7E0CF] rounded-lg py-2 cursor-pointer">
                                                            취소
                                                        </button>
                                                        <button onClick={() => remove(category)} disabled={isSubmitting}
                                                                className="flex-1 text-[12.5px] font-bold text-white bg-[#C23B1E] rounded-lg py-2 cursor-pointer disabled:opacity-50">
                                                            지우기
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="pt-3 flex items-center gap-3">
                                                    <button onClick={() => {
                                                        setEditingId(category.id)
                                                        setEditValue(category.keyword)
                                                    }} className="shrink-0 whitespace-nowrap text-[12.5px] font-bold text-[#24564A] cursor-pointer">
                                                        이름 바꾸기
                                                    </button>
                                                    {category.exclusive_restaurant_count > 0 ? (
                                                        <span className="text-[11.5px] text-[#B7AF9F] leading-snug">
                                                            이 카테고리만 붙은 음식점 {category.exclusive_restaurant_count}곳이 있어 지울 수 없어요
                                                        </span>
                                                    ) : (
                                                        <button onClick={() => setConfirmingDeleteId(category.id)}
                                                                className="text-[12.5px] font-bold text-[#C23B1E] cursor-pointer">
                                                            지우기
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}
                {!query && empty.length > 0 && (
                    <button onClick={() => setShowEmpty((prev) => !prev)}
                            className="mt-2 w-full text-[12.5px] font-bold text-[#8A8172] py-2 cursor-pointer">
                        {showEmpty ? "음식점 없는 카테고리 접기" : `음식점 없는 카테고리 ${empty.length}개 보기`}
                    </button>
                )}
            </div>

            <p className="text-[11.5px] text-[#B7AF9F] mt-2.5 leading-relaxed">
                카테고리는 모든 장소에서 같이 써요. 새 카테고리는 음식점을 등록할 때 만들 수 있어요.
            </p>
        </div>
    )
}
