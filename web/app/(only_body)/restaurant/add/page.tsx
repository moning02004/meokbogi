"use client"

import {Suspense, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {CategoryChips} from "@/components/restaurant/category_chips";
import {BranchItem, BranchManager} from "@/components/restaurant/branch_manager";
import {FaArrowLeft} from "react-icons/fa";
import {BRANCH_API, RESTAURANT_API, RESTAURANT_PAGE} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {useCategoryStore} from "@/store/category";
import {RestaurantListItemType} from "@/types/restaurant";
import toast from "react-hot-toast";
import {apiRequest, errorMessage} from "@/lib/api";
import {categoryLabel, fetchZoneRestaurants} from "@/lib/restaurant";
import {normalizeMenu} from "@/lib/menu";
import {useCreateCategory} from "@/hooks/useCreateCategory";

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()
    const selectedZone = useZoneStore(state => state.selectedZone)
    const selectedZoneId = selectedZone?.id
    const categories = useCategoryStore(state => state.categories)
    const createCategory = useCreateCategory()

    // fields
    // 여러 개 붙일 수 있다 (분식 + 돈까스 파는 김밥집)
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
    const [name, setName] = useState<string>("")
    const [description, setDescription] = useState<string>("")
    // 아직 음식점이 없으니 이름만 모아 두었다가 등록한 뒤에 만든다
    const [branches, setBranches] = useState<BranchItem[]>([])


    // 이름 입력 시 같은 존 안의 기존 음식점 제안 (중복 등록 방지)
    // 예전에는 첫 페이지(20곳)만 받아 거기서 찾았기 때문에 21번째부터는 중복을 못 잡았다. 서버에서 검색한다.
    const [nameSuggestions, setNameSuggestions] = useState<RestaurantListItemType[]>([])
    const [showNameSuggestions, setShowNameSuggestions] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const keyword = name.trim()
    // 이름 칸을 누르면 바로 보여줄 등록된 음식점 (카테고리를 골랐으면 그 카테고리 것만)
    const [categoryRestaurants, setCategoryRestaurants] = useState<RestaurantListItemType[]>([])
    const categoryKey = selectedCategoryIds.join(",")

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

    useEffect(() => {
        if (!selectedZoneId) return
        let ignore = false
        const categoryIds = categoryKey ? categoryKey.split(",").map(Number) : undefined
        fetchZoneRestaurants(selectedZoneId, {categoryIds, sort: "name"})
            .then((res) => {
                if (!ignore) setCategoryRestaurants(res.results)
            })
            .catch(() => null)
        return () => {
            ignore = true
        }
    }, [selectedZoneId, categoryKey])

    if (!selectedZone) return <LoadingPage/>


    // 입력 전: 등록된 음식점 목록(카테고리를 골랐으면 그 카테고리) / 입력 중: 장소 전체에서 이름이 비슷한 음식점
    const hasCategory = selectedCategoryIds.length > 0
    const visibleNameSuggestions = keyword ? nameSuggestions : categoryRestaurants

    const addBranch = async (branchName: string) => {
        // 띄어쓰기만 다른 지점은 서버도 같은 지점으로 보고 거절한다
        if (branches.some((branch) => normalizeMenu(branch.name) === normalizeMenu(branchName))) {
            toast.error(`'${branchName}' 지점은 이미 있어요.`)
            throw new Error("duplicate branch")
        }
        setBranches((prev) => [...prev, {name: branchName}])
    }

    const removeBranch = async (target: BranchItem) => {
        setBranches((prev) => prev.filter((branch) => branch !== target))
    }

    const goToExistingRestaurant = (_id: number) => {
        setShowNameSuggestions(false)
        router.push(RESTAURANT_PAGE.detail(_id))
    }

    const registerRestaurant = () => {
        const addAPI = RESTAURANT_API.add

        if (isSubmitting) return
        if (!keyword || selectedCategoryIds.length === 0) {
            toast.error("음식점 이름과 카테고리를 하나 이상 골라주세요.")
            return;
        }

        setIsSubmitting(true)

        apiRequest[addAPI.method]<{ id: number }>(addAPI.endpoint({
                zone: selectedZone.id,
            }), {
                body: JSON.stringify({
                    name: keyword,
                    description: description.trim(),
                    category_ids: selectedCategoryIds,
                })
            }
        ).then(async (response: { id: number }) => {
            // 음식점은 만들어졌으니 지점이 하나 안 만들어져도 상세로 간다 (상세의 수정에서 다시 더할 수 있다)
            const add = BRANCH_API.add
            for (const branch of branches) {
                await apiRequest[add.method](add.endpoint({restaurant: response.id}), {
                    body: JSON.stringify({name: branch.name}),
                }).catch((error) => toast.error(errorMessage(error, `'${branch.name}' 지점을 추가하지 못했어요.`)))
            }
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

                    <div>
                        <div id="restaurant-categories-label" className="text-[12.5px] font-bold text-[#8A8172] mb-2">
                            카테고리 <span className="text-[#D2571E]">*</span>
                            <span className="ml-1 font-medium text-[#B7AF9F]">여러 개 고를 수 있어요</span>
                        </div>
                        <CategoryChips categories={categories} selected={selectedCategoryIds}
                                       onChange={setSelectedCategoryIds} labelledBy="restaurant-categories-label"
                                       onCreate={createCategory}/>
                    </div>

                    <div className="relative">
                        <label htmlFor="restaurant-name" className="block text-[12.5px] font-bold text-[#8A8172] mb-2">
                            이름 <span className="text-[#D2571E]">*</span>
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onFocus={() => setShowNameSuggestions(true)}
                            // 이미 포커스가 있어도 누르면 다시 연다
                            onClick={() => setShowNameSuggestions(true)}
                            // 목록 항목은 mousedown에서 이동하므로 지연 없이 닫는다.
                            // (예전처럼 150ms 뒤에 닫으면, 다른 곳을 눌렀다 바로 다시 누를 때 새로 연 목록을 그 타이머가 닫았다)
                            onBlur={() => setShowNameSuggestions(false)}
                            type="text"
                            id="restaurant-name"
                            placeholder="예: 교촌치킨"
                            maxLength={100}
                            autoComplete="off"
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                        />
                        <p className="mt-1.5 text-[11.5px] text-[#B7AF9F]">이름에는 브랜드만 적고, 지점은 아래에 따로 더해 주세요.</p>
                        {showNameSuggestions && visibleNameSuggestions.length > 0 && (
                            <div
                                className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#E7E0CF] rounded-xl shadow-md max-h-56 overflow-y-auto">
                                <p className="px-3.5 pt-2.5 pb-1 text-[11.5px] font-semibold text-[#B7AF9F]">
                                    {keyword
                                        ? "이름이 비슷한 음식점이 이미 있어요. 눌러서 바로 이동할 수 있어요."
                                        : hasCategory
                                            ? "이 카테고리에 등록된 음식점이에요. 눌러서 바로 이동할 수 있어요."
                                            : "등록된 음식점이에요. 눌러서 바로 이동할 수 있어요."}
                                </p>
                                {visibleNameSuggestions.map((restaurant) => (
                                    <button
                                        key={restaurant.id}
                                        type="button"
                                        onMouseDown={() => goToExistingRestaurant(restaurant.id)}
                                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors"
                                    >
                                        <span className="text-[13.5px] font-bold text-[#211D17] truncate">{restaurant.name}</span>
                                        <span className="text-[11.5px] text-[#B7AF9F] font-semibold shrink-0">{categoryLabel(restaurant.categories)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="restaurant-description" className="block text-[12.5px] font-bold text-[#8A8172] mb-2">
                            설명 <span className="font-medium text-[#B7AF9F]">(선택)</span>
                        </label>
                        <textarea
                            id="restaurant-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="예: 양념은 따로 달라고 하기"
                            maxLength={100}
                            className="w-full border border-[#E7E0CF] rounded-xl px-3.5 py-3 text-[14.5px] text-[#211D17] outline-none focus:border-[#24564A] transition-colors resize-none leading-relaxed placeholder:text-[#B7AF9F]"
                        />
                    </div>

                    <div>
                        <div className="text-[12.5px] font-bold text-[#8A8172] mb-2">
                            지점 <span className="font-medium text-[#B7AF9F]">(선택) 메뉴는 같고 맛이 다른 곳</span>
                        </div>
                        <BranchManager branches={branches} onCreate={addBranch} onRemove={removeBranch}/>
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