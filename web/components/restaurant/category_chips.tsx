"use client"

import {useState} from "react"
import {CategoryType} from "@/types/zone"

interface CategoryChipsProps {
    categories: CategoryType[]
    selected: number[]
    onChange: (selected: number[]) => void
    labelledBy?: string
    // 목록에 없는 카테고리를 그 자리에서 만든다. 만든 카테고리를 돌려주면 바로 선택된다.
    onCreate?: (keyword: string) => Promise<CategoryType>
}

// 공백·대소문자만 다른 건 같은 카테고리로 본다 (카테고리 관리 화면, 서버와 같은 기준)
const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "")

// 음식점에 붙일 카테고리 고르기. 여러 개를 고를 수 있다 (분식 + 돈까스 파는 김밥집).
export function CategoryChips({categories, selected, onChange, labelledBy, onCreate}: CategoryChipsProps) {
    const [isAdding, setIsAdding] = useState(false)
    const [newKeyword, setNewKeyword] = useState("")
    const [isCreating, setIsCreating] = useState(false)

    const toggle = (id: number) => {
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
    }

    const closeAdding = () => {
        setIsAdding(false)
        setNewKeyword("")
    }

    const create = () => {
        const keyword = newKeyword.trim()
        if (!keyword || !onCreate || isCreating) return
        // 이미 있으면 새로 만들지 않고 그걸 고른다
        const existing = categories.find((category) => normalize(category.keyword) === normalize(keyword))
        if (existing) {
            if (!selected.includes(existing.id)) onChange([...selected, existing.id])
            closeAdding()
            return
        }
        setIsCreating(true)
        onCreate(keyword)
            .then((category) => {
                onChange([...selected, category.id])
                closeAdding()
            })
            .catch(() => null)
            .finally(() => setIsCreating(false))
    }

    return (
        <div>
            <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
                {categories.map((category) => {
                    const active = selected.includes(category.id)
                    return (
                        <button
                            key={category.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggle(category.id)}
                            className={`px-3 py-1.5 rounded-full text-[13px] font-bold border cursor-pointer transition-colors ${
                                active
                                    ? "bg-strong text-white border-strong"
                                    : "bg-fill text-ink2 border-fill sm:hover:bg-fill-hover"
                            }`}
                        >
                            {category.keyword}
                        </button>
                    )
                })}
                {onCreate && !isAdding && (
                    <button type="button" onClick={() => setIsAdding(true)}
                            className="px-3 py-1.5 rounded-full text-[13px] font-bold border border-dashed border-line-strong text-ink3 cursor-pointer">
                        + 새 카테고리
                    </button>
                )}
            </div>
            {isAdding && (
                <div className="flex items-center gap-2 mt-2">
                    <input
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                e.preventDefault()
                                create()
                            }
                        }}
                        autoFocus
                        maxLength={100}
                        placeholder="예: 샐러드"
                        aria-label="새 카테고리 이름"
                        className="flex-1 min-w-0 text-[14px] text-ink rounded-[14px] px-3 py-2 bg-fill outline-none focus:ring-2 focus:ring-strong placeholder:text-ink4"
                    />
                    <button type="button" onClick={create} disabled={!newKeyword.trim() || isCreating}
                            className="shrink-0 text-[13px] font-bold text-white bg-strong rounded-xl px-3.5 py-2 cursor-pointer disabled:opacity-40">
                        {isCreating ? "추가 중…" : "추가"}
                    </button>
                    <button type="button" onClick={closeAdding}
                            className="shrink-0 text-[12.5px] font-bold text-ink3 px-1 cursor-pointer">
                        취소
                    </button>
                </div>
            )}
        </div>
    )
}
