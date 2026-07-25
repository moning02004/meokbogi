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
import {apiRequest} from "@/lib/api";
import {fetchZoneRestaurants} from "@/lib/restaurant";

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    const categories = useCategoryStore(state => state.categories)

    // fields
    const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null)
    const [name, setName] = useState<string>("")
    const [description, setDescription] = useState<string>("")
    const [address, setAddress] = useState<string>("")

    // 카테고리는 입력 없이 기존 목록에서 선택만 가능
    const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)

    // 이름 입력 시 같은 존 안의 기존 식당 제안 (중복 등록 방지)
    const [existingRestaurants, setExistingRestaurants] = useState<RestaurantListItemType[]>([])
    const [showNameSuggestions, setShowNameSuggestions] = useState(false)

    useEffect(() => {
        if (!token) router.replace("/login")
    }, [token])

    useEffect(() => {
        if (!selectedZone) return
        fetchZoneRestaurants(selectedZone.id).then((res) => setExistingRestaurants(res.results))
    }, [selectedZone])

    if (!selectedZone) return <LoadingPage/>

    const selectCategorySuggestion = (category: CategoryType) => {
        setSelectedCategory(category)
        setShowCategorySuggestions(false)
    }

    const keyword = name.trim()
    const nameSuggestions = keyword
        ? existingRestaurants.filter((restaurant) => restaurant.name.includes(keyword))
        : existingRestaurants

    const goToExistingRestaurant = (_id: number) => {
        setShowNameSuggestions(false)
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    const registerRestaurant = () => {
        const addAPI = RESTAURANT_API.add

        if (!name || !selectedCategory) {
            toast.error("음식점 이름과 카테고리를 선택해주세요.")
            return;
        }

        apiRequest[addAPI.method]<{ id: number }>(addAPI.endpoint({
                zone: selectedZone.id,
                category: selectedCategory.id,
            }), {
                body: JSON.stringify({
                    name: name,
                    description: description,
                    address: address
                })
            }
        ).then((response: { id: number }) => {
            router.replace(RESTAURANT_PAGE.detail(response.id))
        }).catch(error => {
            toast.error(error)
        })
    }

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="h-[100%] pb-6">

                <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-[#E7E0CF]">
                    <button onClick={() => router.back()} className="text-[#211D17] cursor-pointer">
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
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors"
                        />
                        {showNameSuggestions && nameSuggestions.length > 0 && (
                            <div
                                className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#E7E0CF] rounded-xl shadow-md max-h-56 overflow-y-auto">
                                <p className="px-3.5 pt-2.5 pb-1 text-[11.5px] font-semibold text-[#B7AF9F]">
                                    이미 등록된 식당이에요. 눌러서 바로 이동할 수 있어요.
                                </p>
                                {nameSuggestions.map((restaurant) => (
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
                            placeholder="이 식당에 대한 짧은 메모"
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
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors"
                        />
                    </div>

                    <button
                        onClick={registerRestaurant}
                        className="w-full py-3.5 rounded-xl bg-[#D2571E] text-white font-bold text-[15px] cursor-pointer sm:hover:bg-[#b84a19] transition-colors mt-2"
                    >
                        등록
                    </button>
                </div>
            </div>
        </Suspense>
    )
}