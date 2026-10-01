"use client"

import {useState} from "react"
import {Drawer} from "vaul"
import toast from "react-hot-toast"
import {BRANCH_API, RESTAURANT_API} from "@/constants/routeUrl"
import {apiRequest, errorMessage} from "@/lib/api"
import {useKeyboardInset, useVisibleHeight} from "@/hooks/useVisualViewport"
import {useCreateCategory} from "@/hooks/useCreateCategory"
import {useCategoryStore} from "@/store/category"
import {BranchType, RestaurantType} from "@/types/restaurant"
import {CategoryChips} from "@/components/restaurant/category_chips"
import {BranchManager} from "@/components/restaurant/branch_manager"

interface RestaurantEditSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    // 열 때의 음식점. 부모는 열 때 key를 바꿔서 폼을 새로 만든다. 지점 목록은 바뀔 때마다 새로 받는다.
    restaurant: RestaurantType
    // 저장했거나 지점을 더하고 지웠을 때. 부모가 음식점을 다시 읽는다.
    onChanged: (change: "saved" | "branches") => void
}

// 음식점 수정 바텀시트 (상세 화면과 목록 화면에서 같이 쓴다).
// 리뷰 시트처럼 키보드가 올라오면 시트 전체를 키보드 위로 올려서 저장 버튼이 항상 키보드 바로 위에 있게 한다.
export function RestaurantEditSheet({open, onOpenChange, restaurant, onChanged}: RestaurantEditSheetProps) {
    const categories = useCategoryStore(state => state.categories)
    const createCategory = useCreateCategory()

    const [categoryIds, setCategoryIds] = useState(() => restaurant.categories.map((category) => category.id))
    const [name, setName] = useState(restaurant.name)
    const [description, setDescription] = useState(restaurant.description ?? "")
    const [error, setError] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const keyboardInset = useKeyboardInset()
    const visibleHeight = useVisibleHeight()

    const createBranch = (branchName: string) => {
        const add = BRANCH_API.add
        return apiRequest[add.method]<BranchType>(add.endpoint({restaurant: restaurant.id}), {
            body: JSON.stringify({name: branchName}),
        }).then((branch) => {
            onChanged("branches")
            toast.success(`'${branch.name}' 지점을 추가했어요.`)
        }).catch((error) => {
            toast.error(errorMessage(error, "지점을 추가하지 못했어요."))
            throw error
        })
    }

    const removeBranch = (branch: BranchType) => {
        const remove = BRANCH_API.delete
        return apiRequest[remove.method](remove.endpoint({restaurant: restaurant.id, branch: branch.id}))
            .then(() => {
                onChanged("branches")
                toast.success(`'${branch.name}' 지점을 지웠어요.`)
            })
            .catch((error) => {
                toast.error(errorMessage(error, "지점을 지우지 못했어요."))
                throw error
            })
    }

    const save = () => {
        if (isSaving) return
        if (!name.trim() || categoryIds.length === 0) {
            setError("음식점 이름과 카테고리를 하나 이상 골라주세요.")
            return
        }
        setIsSaving(true)
        const update = RESTAURANT_API.update
        apiRequest[update.method](update.endpoint({restaurant: restaurant.id}), {
            body: JSON.stringify({
                category_ids: categoryIds,
                name: name.trim(),
                description: description.trim(),
            })
        }).then(() => {
            onOpenChange(false)
            onChanged("saved")
            toast.success("음식점 정보를 저장했어요.")
        }).catch((error) => {
            toast.error(errorMessage(error, "저장하지 못했어요. 잠시 후 다시 시도해주세요."))
        }).finally(() => setIsSaving(false))
    }

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>
                <Drawer.Content
                    aria-describedby={undefined}
                    className="fixed left-0 right-0 z-50 mx-auto w-full md:w-[50vw] flex flex-col bg-white rounded-t-2xl outline-none"
                    style={{
                        bottom: keyboardInset,
                        // 키보드가 떠 있으면 보이는 높이 안에 시트가 다 들어오게 한다
                        maxHeight: visibleHeight ? visibleHeight - 12 : "88dvh",
                    }}
                >
                    <div className="shrink-0 flex flex-col items-center pt-2.5">
                        <div className="w-10 h-1 rounded-full bg-[#E7E0CF]" aria-hidden/>
                    </div>
                    <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-2">
                        <Drawer.Title className="text-[16px] font-extrabold text-[#211D17]">음식점 수정</Drawer.Title>
                        <Drawer.Close
                            className="text-[12.5px] font-bold text-[#B7AF9F] cursor-pointer p-2 -m-2 sm:hover:text-[#8A8172] transition-colors">
                            닫기
                        </Drawer.Close>
                    </div>

                    {/* 카테고리가 많거나 키보드가 올라와도 내용만 스크롤되고 저장 버튼은 아래에 붙어 있다 */}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-3 flex flex-col gap-4">
                        <div>
                            <div id="edit-categories-label" className="text-[12px] font-bold text-[#8A8172] mb-1.5">
                                카테고리 <span className="text-[#D2571E]">*</span>
                            </div>
                            <CategoryChips categories={categories} selected={categoryIds}
                                           onChange={(next) => {
                                               setCategoryIds(next)
                                               setError("")
                                           }}
                                           labelledBy="edit-categories-label" onCreate={createCategory}/>
                        </div>

                        <div>
                            <label htmlFor="edit-name" className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                이름 <span className="text-[#D2571E]">*</span>
                            </label>
                            <input
                                id="edit-name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value)
                                    setError("")
                                }}
                                maxLength={100}
                                placeholder="예: 미뜨레피자"
                                autoComplete="off"
                                className="w-full text-[15px] text-[#211D17] border border-[#E7E0CF] rounded-xl px-3.5 py-3 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                        </div>

                        <div>
                            <label htmlFor="edit-description" className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                설명 <span className="font-medium text-[#B7AF9F]">(선택)</span>
                            </label>
                            <textarea
                                id="edit-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={100}
                                rows={2}
                                placeholder="예: 양념은 따로 달라고 하기"
                                className="w-full text-[14px] text-[#211D17] border border-[#E7E0CF] rounded-xl px-3.5 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F] resize-none leading-relaxed"
                            />
                        </div>

                        <div>
                            <div className="text-[12px] font-bold text-[#8A8172] mb-1.5">
                                지점 <span className="font-medium text-[#B7AF9F]">메뉴는 같고 맛이 다른 곳</span>
                            </div>
                            <BranchManager branches={restaurant.branches} onCreate={createBranch} onRemove={removeBranch}/>
                        </div>
                    </div>

                    {/* 저장 버튼: 시트 맨 아래 = 키보드 바로 위 */}
                    <div
                        className="shrink-0 border-t border-[#F0EBDD] bg-white px-5 pt-2.5 flex flex-col gap-1.5"
                        style={{paddingBottom: keyboardInset ? 10 : "calc(env(safe-area-inset-bottom) + 12px)"}}
                    >
                        {error && <p role="alert" className="text-[12px] font-semibold text-[#C23B1E]">{error}</p>}
                        <button
                            type="button"
                            onClick={save}
                            disabled={isSaving}
                            // 누르는 순간 입력칸 포커스가 빠지며 키보드가 내려가 버튼이 움직이지 않도록 포커스를 뺏지 않는다
                            onMouseDown={(e) => e.preventDefault()}
                            className="w-full py-3.5 rounded-xl bg-[#24564A] text-white font-extrabold text-[15px] cursor-pointer sm:hover:bg-[#1c443a] transition-colors disabled:opacity-50"
                        >
                            {isSaving ? "저장 중…" : "저장하기"}
                        </button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
