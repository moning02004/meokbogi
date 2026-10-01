"use client"

import {Suspense, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import FoodCardShuffle from "@/components/play/shuffle_card";
import {RESTAURANT_API, RESTAURANT_PAGE} from "@/constants/routeUrl";
import {useCategoryStore} from "@/store/category";
import {RecentRegisteredRestaurant, RestaurantListItemType} from "@/types/restaurant";
import {apiRequest, errorMessage} from "@/lib/api";
import {categoryLabel, PaginatedResponse, pickRestaurant} from "@/lib/restaurant";
import {useZoneStore} from "@/store/zone";
import {daysSince} from "@/lib/date";
import {FiArrowUpRight} from "react-icons/fi";
import {getReviewTextBox} from "@/components/ui/review_textbox";
import toast from "react-hot-toast";

// 뽑힌 이유를 한 줄로. 서버 가중치(오래 안 간 곳·만족도 높은 곳)를 사람이 읽는 말로 옮긴다.
const pickReason = (restaurant: RestaurantListItemType) => {
    if (!restaurant.latest_ordered_at) return "아직 안 가본 곳이에요"
    const days = daysSince(restaurant.latest_ordered_at)
    if (days <= 0) return "오늘 다녀온 곳이에요"
    return `마지막 방문 ${days}일 전`
}

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()

    const selectedZone = useZoneStore(state => state.selectedZone)
    const selectedZoneId = selectedZone?.id
    const categories = useCategoryStore(state => state.categories)

    const [excluded, setExcluded] = useState<number[]>([])
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isShuffling, setIsShuffling] = useState(false)

    const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
    // 뽑힌 카테고리의 음식점. 어느 카테고리 것인지 함께 들고 있어서, 새로 뽑았을 때 이전 목록이 잠깐 보이지 않는다
    const [loaded, setLoaded] = useState<{ categoryId: number; rows: RecentRegisteredRestaurant[] } | null>(null)
    const restaurants = loaded && loaded.categoryId === selectedCategory ? loaded.rows : null

    const [picked, setPicked] = useState<RestaurantListItemType | null>(null)
    const [pickEmpty, setPickEmpty] = useState(false)
    const [isPicking, setIsPicking] = useState(false)
    const [includeDisappointing, setIncludeDisappointing] = useState(false)

    // 존을 바꾸면 이전 존에서 뽑은 결과와 제외 목록을 지운다
    const [trackedZoneId, setTrackedZoneId] = useState(selectedZoneId)
    if (selectedZoneId !== trackedZoneId) {
        setTrackedZoneId(selectedZoneId)
        setSelectedCategory(null)
        setLoaded(null)
        setExcluded([])
        setPicked(null)
        setPickEmpty(false)
    }

    // 카테고리가 바뀌면(다시 섞기 포함) 이전 음식점 뽑기 결과를 지운다
    const [trackedCategory, setTrackedCategory] = useState(selectedCategory)
    if (selectedCategory !== trackedCategory) {
        setTrackedCategory(selectedCategory)
        setPicked(null)
        setPickEmpty(false)
    }

    useEffect(() => {
        if (!selectedZoneId || !selectedCategory) return;
        let ignore = false

        const restaurantList = RESTAURANT_API.list
        apiRequest[restaurantList.method]<PaginatedResponse<RecentRegisteredRestaurant>>(
            `${restaurantList.endpoint({zone: selectedZoneId})}?category=${selectedCategory}`
        ).then((response) => {
            if (!ignore) setLoaded({categoryId: selectedCategory, rows: response.results})
        }).catch(() => {
            if (!ignore) setLoaded({categoryId: selectedCategory, rows: []})
        })
        return () => {
            ignore = true
        }
    }, [selectedZoneId, selectedCategory]);

    useEffect(() => {
        if (!token) window.location.href = "/login"
    }, [token])

    // 섞을 카드: 모든 카테고리에서 직접 뺀 것만 제외한다.
    // 아직 안 먹어본 카테고리가 나와도 "이거 먹어봐야겠네"가 되도록 일부러 거르지 않는다.
    const deck = categories.filter((category) => !excluded.includes(category.id))
    const categoryInfo = Object.fromEntries(deck.map((item) => [item.keyword, item.id]))
    const selectedCategoryName = categories.find((category) => category.id === selectedCategory)?.keyword ?? ""

    const toggleExcluded = (id: number) => {
        setExcluded((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    }

    const pick = () => {
        if (!selectedZoneId || !selectedCategory || isPicking) return
        setIsPicking(true)
        pickRestaurant(selectedZoneId, {categoryId: selectedCategory, includeDisappointing})
            .then(({restaurant}) => {
                setPicked(restaurant)
                setPickEmpty(restaurant === null)
            })
            .catch((error) => toast.error(errorMessage(error, "뽑지 못했어요.")))
            .finally(() => setIsPicking(false))
    }

    const gotoRestaurant = (_id: number) => {
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    if (!selectedZone) return <LoadingPage/>

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="min-h-[100%] bg-white pb-6">
                {deck.length > 0 ? (
                    <FoodCardShuffle categoryInfo={categoryInfo}
                                     items={deck.map((category) => category.keyword)}
                                     setSelectedCategory={setSelectedCategory}
                                     onBusyChange={setIsShuffling}/>
                ) : (
                    <div className="mx-5 mt-5 bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-5 py-6 text-center text-[13px] text-[#8A8172] font-semibold">
                        섞을 카테고리가 없어요. 아래에서 뺀 카테고리를 다시 넣어주세요.
                    </div>
                )}

                {/* ---- 이번 판 카테고리 고르기 ---- */}
                <div className="px-5 mt-2">
                    <button
                        onClick={() => setIsPickerOpen((prev) => !prev)}
                        aria-expanded={isPickerOpen}
                        className="w-full flex items-center justify-between text-[12.5px] font-semibold text-[#8A8172] py-2 cursor-pointer"
                    >
                        <span>{categories.length}개 중 <b className="text-[#24564A]">{deck.length}개</b>로 섞어요</span>
                        <span className="text-[#24564A] font-bold">{isPickerOpen ? "접기" : "카테고리 고르기"}</span>
                    </button>

                    {isPickerOpen && (
                        <div className="flex flex-col gap-2.5 pb-2">
                            <p className="text-[11.5px] text-[#B7AF9F]">눌러서 이번 판에서 빼거나 다시 넣어요.</p>
                            <div className="flex flex-wrap gap-1.5">
                                {categories.map((category) => {
                                    const isOut = excluded.includes(category.id)
                                    return (
                                        <button
                                            key={category.id}
                                            onClick={() => toggleExcluded(category.id)}
                                            disabled={isShuffling}
                                            aria-pressed={!isOut}
                                            className={`px-3 py-1.5 rounded-full text-[12.5px] font-bold border cursor-pointer transition-colors disabled:cursor-not-allowed ${
                                                isOut
                                                    ? "bg-white text-[#C9C1AF] border-[#EFEAE0] line-through"
                                                    : "bg-[#E4EEEA] text-[#24564A] border-[#CFE0D8]"
                                            }`}
                                        >
                                            {category.keyword}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ---- 결과가 나온 뒤에만 목록 영역 표시 ---- */}
                {selectedCategory && restaurants !== null && (
                    <div className="px-5 mt-4 flex flex-col gap-3">
                        {/* 음식점까지 뽑기: 등록한 곳이 있을 때만 */}
                        {restaurants.length > 0 && <div className="rounded-2xl border border-[#F6C9B2] bg-[#FDF6F1] px-4 py-3.5 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-[13px] font-extrabold text-[#211D17]">
                                    {selectedCategoryName}, 어디서 시킬까요?
                                </div>
                                <button
                                    onClick={pick}
                                    disabled={isPicking}
                                    className="shrink-0 text-[12.5px] font-extrabold text-white bg-[#D2571E] rounded-xl px-3.5 py-2 cursor-pointer sm:hover:bg-[#b84a19] transition-colors disabled:opacity-50"
                                >
                                    {isPicking ? "뽑는 중…" : picked ? "다시 뽑기" : "한 곳 뽑기"}
                                </button>
                            </div>

                            {picked && (
                                <button
                                    onClick={() => gotoRestaurant(picked.id)}
                                    className="w-full text-left flex items-center justify-between gap-3 bg-white border-2 border-[#D2571E] rounded-xl px-3.5 py-3 cursor-pointer"
                                >
                                    <span className="min-w-0">
                                        <span className="block font-extrabold text-[15.5px] text-[#211D17] truncate">{picked.name}</span>
                                        <span className="block text-[12px] text-[#8A8172] mt-0.5">
                                            {pickReason(picked)} · 방문 {picked.ordered_count}회
                                        </span>
                                    </span>
                                    {picked.review_avg !== null && getReviewTextBox(picked.review_avg, "sm")}
                                </button>
                            )}
                            {pickEmpty && (
                                <p className="text-[12.5px] text-[#8A8172]">
                                    {includeDisappointing
                                        ? "이 카테고리에 등록한 음식점이 없어요."
                                        : "뽑을 곳이 없어요. 실망했던 곳도 포함하면 뽑을 수 있을지도 몰라요."}
                                </p>
                            )}

                            <label className="flex items-center gap-2 text-[12px] text-[#8A8172] font-semibold cursor-pointer">
                                <input
                                    id="include-disappointing"
                                    type="checkbox"
                                    checked={includeDisappointing}
                                    onChange={(e) => setIncludeDisappointing(e.target.checked)}
                                    className="accent-[#D2571E] w-4 h-4"
                                />
                                실망했던 곳도 포함
                            </label>
                            <p className="text-[11px] text-[#B7AF9F] leading-relaxed">
                                오래 안 간 곳, 만족도가 높았던 곳일수록 잘 뽑혀요.
                            </p>
                        </div>}

                        <div className="flex items-center gap-2">
                            <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase">
                                {selectedCategoryName || "음식점"} 음식점
                            </div>
                            {restaurants.length > 0 && (
                                <div className="text-[11px] font-bold text-[#D2571E]">{restaurants.length}</div>
                            )}
                        </div>

                        {restaurants.length === 0 ? (
                            <div className="bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-5 py-6 text-center">
                                <div className="text-[15px] font-extrabold text-[#211D17] mb-1.5">
                                    오늘은 {selectedCategoryName} 도전!
                                </div>
                                <div className="text-[13px] text-[#8A8172] font-semibold leading-relaxed mb-4">
                                    아직 기록한 {selectedCategoryName} 음식점이 없어요.<br/>
                                    시켜 먹어 보고 맛있었던 곳을 남겨 두세요.
                                </div>
                                <button
                                    onClick={() => router.push(RESTAURANT_PAGE.add)}
                                    className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-white bg-[#D2571E] rounded-xl px-4 py-2.5 cursor-pointer active:scale-[0.98] transition-transform"
                                >
                                    <FiArrowUpRight size={15}/>
                                    {selectedCategoryName} 음식점 등록하기
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {restaurants.map((restaurant) => (
                                    <div key={restaurant.id}
                                         className="flex items-center justify-between p-3.5 rounded-2xl border border-[#E7E0CF] bg-white cursor-pointer sm:hover:bg-[#FAF8F2] transition-colors"
                                         onClick={() => gotoRestaurant(restaurant.id)}
                                    >
                                        <div>
                                            <p className="font-bold text-[15.5px] text-[#211D17] tracking-tight">{restaurant.name}</p>
                                            <p className="text-[12.5px] text-[#8A8172] mt-0.5">{restaurant.description || `${categoryLabel(restaurant.categories)} 음식점`}</p>
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Suspense>
    )
}
