"use client"

import {Suspense, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {SectionBox} from "@/components/section";
import {FaArrowLeft} from "react-icons/fa";
import {RESTAURANT_API, RESTAURANT_PAGE} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {useCategoryStore} from "@/store/category";
import {RestaurantListItemType} from "@/types/restaurant";
import {CategoryType} from "@/types/zone";
import toast from "react-hot-toast";
import {apiRequest, errorMessage} from "@/lib/api";
import {fetchZoneRestaurants} from "@/lib/restaurant";

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    const selectedZoneId = selectedZone?.id
    const categories = useCategoryStore(state => state.categories)

    // fields
    const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null)
    const [name, setName] = useState<string>("")
    const [description, setDescription] = useState<string>("")
    const [address, setAddress] = useState<string>("")

    // 카테고리는 입력 없이 기존 목록에서 선택만 가능
    const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)

    // 이름 입력 시 같은 존 안의 기존 음식점 제안 (중복 등록 방지)
    // 예전에는 첫 페이지(20곳)만 받아 거기서 찾았기 때문에 21번째부터는 중복을 못 잡았다. 서버에서 검색한다.
    const [nameSuggestions, setNameSuggestions] = useState<RestaurantListItemType[]>([])
    const [showNameSuggestions, setShowNameSuggestions] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const keyword = name.trim()

    useEffect(() => {
        if (!token) router.replace("/login")
    }, [token])

    useEffect(() => {
        if (!selectedZoneId || !keyword) return
        let ignore = false
        const timer = setTimeout(() => {
            fetchZoneRestaurants(selectedZoneId, {search: keyword})
                .then((res) => {
                    if (!ignore) setNameSuggestions(res.results)
                })
                .catch(() => null)
        }, 250)
        return () => {
            ignore = true
            clearTimeout(timer)
        }
    }, [selectedZoneId, keyword])

    if (!selectedZone) return <LoadingPage/>

    const selectCategorySuggestion = (category: CategoryType) => {
        setSelectedCategory(category)
        setShowCategorySuggestions(false)
    }

    // 입력이 비었을 때는 "이미 등록된 음식점" 안내를 띄우지 않는다
    const visibleNameSuggestions = keyword ? nameSuggestions : []

    const goToExistingRestaurant = (_id: number) => {
        setShowNameSuggestions(false)
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    const registerRestaurant = () => {
        const addAPI = RESTAURANT_API.add

        if (isSubmitting) return
        if (!keyword || !selectedCategory) {
            toast.error("음식점 이름과 카테고리를 선택해주세요.")
            return;
        }

        setIsSubmitting(true)

        apiRequest[addAPI.method]<{ id: number }>(addAPI.endpoint({
                zone: selectedZone.id,
                category: selectedCategory.id,
            }), {
                body: JSON.stringify({
                    name: keyword,
                    description: description.trim(),
                    address: address.trim()
                })
            }
        ).then((response: { id: number }) => {
            router.replace(RESTAURANT_PAGE.detail(response.id))
        }).catch((error) => {
            // Error 객체를 그대로 toast에 넘기면 React가 객체를 렌더링하려다 화면이 깨진다
            toast.error(errorMessage(error, "음식점을 등록하지 못했어요."))
            setIsSubmitting(false)
        })
    }

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="h-[100%] pb-6">

                <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-[#E7E0CF]">
                    <button onClick={() => router.back()} aria-label="뒤로" className="text-[#211D17] cursor-pointer p-2.5 -m-2.5">
                        <FaArrowLeft size={16}/>
                    </button>
                    <div className="text-[15px] font-bold text-[#211D17]">음식점 추가</div>
                </div>

                <div className="px-5 pt-6 flex flex-col gap-5">

                    <div className="relative">
                        <label className="block text-[12.5px] font-bold text-[#8A8172] mb-2">
                            대표 카테고리 <span className="text-[#D2571E]">*</span>
                        </label>
                        <input
                            value={selectedCategory?.keyword ?? ""}
                            readOnly
                            onFocus={() => setShowCategorySuggestions(true)}
                            onClick={() => setShowCategorySuggestions(true)}
                            onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 150)}
                            type="text"
                            placeholder="카테고리를 선택해주세요"
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors cursor-pointer bg-white"
                        />
                        {showCategorySuggestions && categories.length > 0 && (
                            <div
                                className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#E7E0CF] rounded-xl shadow-md max-h-56 overflow-y-auto">
                                {categories.map((category: CategoryType) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onMouseDown={() => selectCategorySuggestion(category)}
                                        className="w-full px-3.5 py-2.5 text-left text-[13.5px] font-bold text-[#211D17] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors"
                                    >
                                        {category.keyword}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <label className="block text-[12.5px] font-bold text-[#8A8172] mb-2">
                            이름 <span className="text-[#D2571E]">*</span>
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onFocus={() => setShowNameSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                            type="text"
                            placeholder="예: 미뜨레피자"
                            maxLength={100}
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors"
                        />
                        {showNameSuggestions && visibleNameSuggestions.length > 0 && (
                            <div
                                className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#E7E0CF] rounded-xl shadow-md max-h-56 overflow-y-auto">
                                <p className="px-3.5 pt-2.5 pb-1 text-[11.5px] font-semibold text-[#B7AF9F]">
                                    이미 등록된 음식점이에요. 눌러서 바로 이동할 수 있어요.
                                </p>
                                {visibleNameSuggestions.map((restaurant) => (
                                    <button
                                        key={restaurant.id}
                                        type="button"
                                        onMouseDown={() => goToExistingRestaurant(restaurant.id)}
                                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors"
                                    >
                                        <span className="text-[13.5px] font-bold text-[#211D17] truncate">{restaurant.name}</span>
                                        <span className="text-[11.5px] text-[#B7AF9F] font-semibold shrink-0">{restaurant.category_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-[12.5px] font-bold text-[#8A8172] mb-2">설명</label>
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            type="text"
                            placeholder="이 음식점에 대한 짧은 메모"
                            maxLength={100}
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-[12.5px] font-bold text-[#8A8172] mb-2">주소</label>
                        <input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            type="text"
                            placeholder="예: 서울시 강남구 ..."
                            maxLength={255}
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors"
                        />
                    </div>

                    <button
                        onClick={registerRestaurant}
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-xl bg-[#D2571E] text-white font-bold text-[15px] cursor-pointer sm:hover:bg-[#b84a19] transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "등록 중…" : "등록"}
                    </button>
                </div>
            </div>
        </Suspense>
    )
}