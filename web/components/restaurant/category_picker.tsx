"use client"

import {useEffect, useRef, useState} from "react"
import {LuCheck, LuChevronDown} from "react-icons/lu"
import {CategoryType} from "@/types/zone"

interface CategoryPickerProps {
    id: string
    categories: CategoryType[]
    selected: number[]
    onChange: (selected: number[]) => void
    placeholder?: string
}

// 긴 입력칸처럼 보이는 카테고리 고르기. 누르면 아래에 목록이 열리고 여러 개를 체크할 수 있다.
// 고르는 동안 목록은 열려 있고, 바깥을 누르거나 "완료"를 누르면 닫힌다.
export function CategoryPicker({id, categories, selected, onChange, placeholder = "카테고리를 골라주세요"}: CategoryPickerProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        const close = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener("pointerdown", close)
        return () => document.removeEventListener("pointerdown", close)
    }, [open])

    const toggle = (categoryId: number) => {
        onChange(selected.includes(categoryId) ? selected.filter((x) => x !== categoryId) : [...selected, categoryId])
    }

    // 고른 순서가 아니라 목록 순서로 보여준다
    const label = categories.filter((category) => selected.includes(category.id)).map((c) => c.keyword).join(", ")

    return (
        <div ref={rootRef} className="relative">
            <button
                id={id}
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`w-full flex items-center gap-2 border rounded-xl px-3.5 py-3 text-[14.5px] text-left bg-white cursor-pointer transition-colors ${
                    open ? "border-[#24564A]" : "border-[#E7E0CF]"
                }`}
            >
                <span className={`flex-1 min-w-0 truncate ${label ? "text-[#211D17]" : "text-[#B7AF9F]"}`}>
                    {label || placeholder}
                </span>
                {selected.length > 1 && (
                    <span className="shrink-0 text-[11.5px] font-bold text-[#24564A] bg-[#E4EEEA] rounded-full px-2 py-0.5">
                        {selected.length}개
                    </span>
                )}
                <LuChevronDown size={16} className={`shrink-0 text-[#B7AF9F] transition-transform ${open ? "rotate-180" : ""}`}/>
            </button>

            {open && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#E7E0CF] rounded-xl shadow-lg overflow-hidden">
                    <ul role="listbox" aria-multiselectable="true" aria-labelledby={id}
                        className="max-h-64 overflow-y-auto py-1">
                        {categories.map((category) => {
                            const active = selected.includes(category.id)
                            return (
                                <li key={category.id} role="option" aria-selected={active}
                                    onClick={() => toggle(category.id)}
                                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-[14px] cursor-pointer sm:hover:bg-[#F6F3EC]">
                                    <span className={active ? "font-bold text-[#24564A]" : "font-semibold text-[#211D17]"}>
                                        {category.keyword}
                                    </span>
                                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                        active ? "bg-[#24564A] border-[#24564A] text-white" : "border-[#D6D2CC]"
                                    }`}>
                                        {active && <LuCheck size={13}/>}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                    <div className="flex items-center justify-between gap-2 border-t border-[#F0EBDD] px-3.5 py-2">
                        <span className="text-[12px] text-[#8A8172]">여러 개 고를 수 있어요</span>
                        <button type="button" onClick={() => setOpen(false)}
                                className="text-[13px] font-bold text-[#24564A] px-2 py-1 cursor-pointer">
                            완료
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
