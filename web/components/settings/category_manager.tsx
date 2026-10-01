"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import toast from "react-hot-toast"
import {LuPlus, LuSearch, LuX} from "react-icons/lu"

import {CATEGORY_API} from "@/constants/routeUrl"
import {apiRequest, errorMessage} from "@/lib/api"
import {ManagedCategoryType} from "@/types/zone"

interface CategoryManagerProps {
    zoneId: number
    // 목록을 새로 읽을 때마다 호출된다. mutated는 추가·삭제 직후인지 여부.
    onCategoriesChange?: (categories: ManagedCategoryType[], mutated: boolean) => void
}

// 대소문자·공백 차이만 있는 건 같은 카테고리로 본다 ("돈 까스" vs "돈까스")
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "")

// 검색어와 겹치는 부분을 칠해서 "비슷한 게 이미 있는지"가 한눈에 들어오게 한다.
// 공백을 지운 뒤에야 걸린 경우(예: "돈까스"로 "돈 까스"를 찾은 경우)는 그냥 원문을 보여준다.
function highlightMatch(text: string, query: string) {
    if (!query) return text

    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index < 0) return text

    return (
        <>
            {text.slice(0, index)}
            <mark className="bg-[#E4EEEA] text-[#24564A] rounded-[3px]">
                {text.slice(index, index + query.length)}
            </mark>
            {text.slice(index + query.length)}
        </>
    )
}

// 한 존의 카테고리를 검색·추가·삭제한다.
// 입력창은 검색을 겸한다. 비슷한 키워드가 이미 있으면 목록이 좁혀지면서 눈에 띄도록.
// 음식점이 묶여 있는 카테고리는 지울 수 없다 (Restaurant.category가 CASCADE라 음식점까지 사라진다).
export function CategoryManager({zoneId, onCategoriesChange}: CategoryManagerProps) {
    // 존이 바뀌는 순간 이전 존의 목록이 잠깐 보이지 않도록 zoneId를 함께 들고 있는다
    const [loaded, setLoaded] = useState<{ zoneId: number; rows: ManagedCategoryType[] } | null>(null)
    const categories = loaded && loaded.zoneId === zoneId ? loaded.rows : null

    const [keyword, setKeyword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // 부모가 인라인 함수를 넘겨도 목록을 다시 읽지 않도록 ref로 받아둔다
    const notify = useRef(onCategoriesChange)
    useEffect(() => {
        notify.current = onCategoriesChange
    })

    const loadCategories = useCallback((mutated: boolean) => {
        const list = CATEGORY_API.list
        return apiRequest[list.method]<ManagedCategoryType[]>(list.endpoint({zone: zoneId}))
            .then((rows) => {
                setLoaded({zoneId, rows})
                notify.current?.(rows, mutated)
            })
    }, [zoneId])

    useEffect(() => {
        loadCategories(false)
    }, [loadCategories])

    const trimmed = keyword.trim()
    const query = normalize(trimmed)
    const matched = query === "" ? categories : categories?.filter(
        (category) => normalize(category.keyword).includes(query)
    ) ?? null
    const isDuplicate = query !== "" && (categories?.some(
        (category) => normalize(category.keyword) === query
    ) ?? false)

    const addCategory = () => {
        if (!trimmed || isDuplicate || isSubmitting) return

        setIsSubmitting(true)
        const add = CATEGORY_API.add
        apiRequest[add.method](add.endpoint({zone: zoneId}), {
            body: JSON.stringify({keyword: trimmed})
        }).then(() => {
            setKeyword("")
            return loadCategories(true)
        }).catch((error) => {
            toast.error(errorMessage(error, "카테고리 추가에 실패했어요."))
        }).finally(() => setIsSubmitting(false))
    }

    const deleteCategory = (category: ManagedCategoryType) => {
        if (isSubmitting) return

        setIsSubmitting(true)
        const remove = CATEGORY_API.delete
        apiRequest[remove.method](remove.endpoint({zone: zoneId, category: category.id})
        ).then(() => {
            toast.success(`'${category.keyword}' 카테고리를 삭제했어요.`)
            return loadCategories(true)
        }).catch((error) => {
            // 목록을 받은 뒤에 음식점이 생겼다면 서버가 400으로 막는다 (메시지는 서버가 준 사유)
            toast.error(errorMessage(error, "카테고리를 삭제하지 못했어요."))
            return loadCategories(true)
        }).finally(() => setIsSubmitting(false))
    }

    return (
        <div>
            {/* ---- 검색 겸 추가 입력 ---- */}
            <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                    <LuSearch
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B7AF9F] pointer-events-none"
                    />
                    <input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.nativeEvent.isComposing) addCategory()
                        }}
                        placeholder="카테고리 찾기 · 추가 (예: 샐러드)"
                        maxLength={100}
                        className="w-full text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg pl-8.5 pr-8 py-2.5 outline-none focus:border-[#24564A] transition-colors"
                    />
                    {keyword && (
                        <button
                            onClick={() => setKeyword("")}
                            aria-label="검색어 지우기"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#B7AF9F] cursor-pointer sm:hover:bg-[#F1EFE8] transition-colors"
                        >
                            <LuX size={13}/>
                        </button>
                    )}
                </div>
                <button
                    onClick={addCategory}
                    disabled={!trimmed || isDuplicate || isSubmitting}
                    className="shrink-0 flex items-center gap-1 text-[13px] font-bold text-white bg-[#24564A] rounded-lg px-3.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed sm:hover:bg-[#1c443a] transition-colors"
                >
                    <LuPlus size={14}/>
                    추가
                </button>
            </div>

            {/* ---- 검색 상태 ---- */}
            {query !== "" && categories !== null && (
                <p className={`text-[11.5px] font-semibold mt-2 ${isDuplicate ? "text-[#C23B1E]" : "text-[#8A8172]"}`}>
                    {isDuplicate
                        ? `'${trimmed}'은(는) 이미 있는 카테고리예요.`
                        : `비슷한 카테고리 ${matched?.length ?? 0}개`}
                </p>
            )}

            {/* ---- 카테고리 목록 ---- */}
            <div className="mt-3">
                {categories === null ? (
                    <div className="flex flex-col gap-1.5">
                        {[0, 1, 2].map((row) => (
                            <div key={row} className="h-[42px] rounded-lg bg-[#F6F3EC] animate-pulse"/>
                        ))}
                    </div>
                ) : categories.length === 0 ? (
                    <p className="text-[13px] text-[#8A8172] py-3 text-center">
                        카테고리가 없어요. 위에서 추가해보세요.
                    </p>
                ) : matched === null || matched.length === 0 ? (
                    <p className="text-[13px] text-[#8A8172] py-3 text-center leading-relaxed">
                        비슷한 카테고리가 없어요.<br/>
                        <span className="text-[12px] text-[#B7AF9F]">추가 버튼을 눌러 새로 만들 수 있어요.</span>
                    </p>
                ) : (
                    <ul className="flex flex-col divide-y divide-[#F0EBDD] border border-[#E7E0CF] rounded-xl overflow-hidden">
                        {matched.map((category) => {
                            const isLocked = category.restaurant_count > 0
                            return (
                                <li key={category.id} className="flex items-center gap-2 px-3.5 py-2.5 bg-white">
                                    <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-[#211D17] truncate">
                                        {highlightMatch(category.keyword, trimmed)}
                                    </span>
                                    <span
                                        className={`shrink-0 text-[11.5px] font-bold rounded-full px-2 py-0.5 ${
                                            isLocked ? "bg-[#E4EEEA] text-[#24564A]" : "bg-[#F1EFE8] text-[#B7AF9F]"
                                        }`}
                                    >
                                        음식점 {category.restaurant_count}
                                    </span>
                                    <button
                                        onClick={() => deleteCategory(category)}
                                        disabled={isLocked || isSubmitting}
                                        title={isLocked ? "등록된 음식점이 있어 삭제할 수 없어요" : "삭제"}
                                        aria-label={`${category.keyword} 삭제`}
                                        className="shrink-0 p-1.5 rounded-lg text-[#C23B1E] cursor-pointer sm:hover:bg-[#FDEBE1] transition-colors disabled:text-[#D6D2CC] disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    >
                                        <LuX size={15}/>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>

            <p className="text-[11.5px] text-[#B7AF9F] mt-2.5 leading-relaxed">
                음식점이 등록된 카테고리는 삭제할 수 없어요. 음식점을 다른 카테고리로 옮기거나 삭제한 뒤에 지워주세요.
            </p>
        </div>
    )
}
