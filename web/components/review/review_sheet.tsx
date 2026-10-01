"use client"

import {useState} from "react"
import {Drawer} from "vaul"
import {SentimentKey, SentimentPicker} from "@/components/review/sentiment"
import {useKeyboardInset, useVisibleHeight} from "@/hooks/useVisualViewport"
import {formatDate, today} from "@/lib/date"
import {normalizeMenu} from "@/lib/menu"

export interface ReviewDraft {
    ordered_at: string
    menu: string
    point: SentimentKey
    content: string
}

interface ReviewSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    submitLabel: string
    // 열 때마다 이 값으로 폼을 채운다. 부모는 열 때 key를 바꿔서 폼을 새로 만든다.
    initial: ReviewDraft
    // 이 음식점에서 전에 기록한 메뉴들 (빠르게 고르기 · 표기 합치기 안내)
    menus: string[]
    onSubmit: (draft: ReviewDraft) => Promise<unknown>
}

const shiftDays = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return formatDate(date)
}

const DAY_CHIPS = [
    {label: "오늘", value: () => shiftDays(0)},
    {label: "어제", value: () => shiftDays(1)},
    {label: "그저께", value: () => shiftDays(2)},
]

// 리뷰 쓰기·고치기 바텀시트.
// 키보드가 올라오면 시트 전체를 키보드 위로 올려서 저장 버튼이 항상 키보드 바로 위에 있게 한다.
export function ReviewSheet({open, onOpenChange, title, submitLabel, initial, menus, onSubmit}: ReviewSheetProps) {
    const [orderedAt, setOrderedAt] = useState(initial.ordered_at)
    const [menu, setMenu] = useState(initial.menu)
    const [point, setPoint] = useState<SentimentKey>(initial.point)
    const [content, setContent] = useState(initial.content)
    const [error, setError] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const keyboardInset = useKeyboardInset()
    const visibleHeight = useVisibleHeight()

    const keyword = menu.trim()
    const key = normalizeMenu(keyword)
    const menuChips = menus.filter((option) => option && (!key || normalizeMenu(option).includes(key)) && option !== keyword)
    // 띄어쓰기만 다른 기존 메뉴가 있으면 서버가 그 표기로 합쳐서 저장한다. 미리 알려준다.
    const mergeTarget = keyword ? menus.find((option) => option !== keyword && normalizeMenu(option) === key) : undefined

    const submit = () => {
        if (isSaving) return
        if (!keyword) {
            setError("드신 메뉴를 입력해주세요.")
            return
        }
        setIsSaving(true)
        onSubmit({ordered_at: orderedAt || today(), menu: keyword, point, content: content.trim()})
            .finally(() => setIsSaving(false))
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
                        <Drawer.Title className="text-[16px] font-extrabold text-[#211D17]">{title}</Drawer.Title>
                        <Drawer.Close
                            className="text-[12.5px] font-bold text-[#B7AF9F] cursor-pointer p-2 -m-2 sm:hover:text-[#8A8172] transition-colors">
                            닫기
                        </Drawer.Close>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 flex flex-col gap-4">
                        <div>
                            <label htmlFor="review-menu" className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                메뉴 <span className="text-[#D2571E]">*</span>
                            </label>
                            <input
                                id="review-menu"
                                value={menu}
                                onChange={(e) => {
                                    setMenu(e.target.value)
                                    setError("")
                                }}
                                maxLength={255}
                                placeholder="오늘 뭐 드셨어요?"
                                enterKeyHint="next"
                                className="w-full text-[15px] text-[#211D17] border border-[#E7E0CF] rounded-xl px-3.5 py-3 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                            {mergeTarget && (
                                <p className="mt-1.5 text-[12px] font-semibold text-[#24564A]">
                                    &lsquo;{mergeTarget}&rsquo;(으)로 합쳐서 기록돼요.
                                </p>
                            )}
                            {menuChips.length > 0 && (
                                <div className="flex gap-1.5 overflow-x-auto mt-2 -mx-5 px-5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                                     aria-label="전에 먹은 메뉴">
                                    {menuChips.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => {
                                                setMenu(option)
                                                setError("")
                                            }}
                                            className="shrink-0 whitespace-nowrap text-[12.5px] font-bold text-[#5B5548] bg-[#F6F3EC] border border-[#E7E0CF] rounded-full px-3 py-1.5 cursor-pointer"
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-[12px] font-bold text-[#8A8172] mb-1.5">어땠어요?</div>
                            <SentimentPicker value={point} onChange={setPoint}/>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="review-date" className="text-[12px] font-bold text-[#8A8172]">먹은 날</label>
                                <div className="flex gap-1">
                                    {DAY_CHIPS.map((chip) => {
                                        const value = chip.value()
                                        const active = (orderedAt || today()) === value
                                        return (
                                            <button
                                                key={chip.label}
                                                type="button"
                                                onClick={() => setOrderedAt(value)}
                                                aria-pressed={active}
                                                className={`text-[11.5px] font-bold rounded-full px-2.5 py-1 cursor-pointer transition-colors ${
                                                    active ? "bg-[#24564A] text-white" : "bg-[#F6F3EC] text-[#8A8172]"
                                                }`}
                                            >
                                                {chip.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <input
                                id="review-date"
                                type="date"
                                value={orderedAt || today()}
                                max={today()}
                                onChange={(e) => setOrderedAt(e.target.value)}
                                className="w-full text-[14px] text-[#211D17] border border-[#E7E0CF] rounded-xl px-3.5 py-2.5 outline-none focus:border-[#24564A] transition-colors bg-white"
                            />
                        </div>

                        <div>
                            <label htmlFor="review-content" className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                한줄평 <span className="font-medium text-[#B7AF9F]">(선택)</span>
                            </label>
                            <textarea
                                id="review-content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                maxLength={255}
                                rows={2}
                                placeholder="다음에 시킬 때 참고할 한마디"
                                className="w-full text-[14px] text-[#211D17] bg-[#FBFAF6] border border-[#E7E0CF] rounded-xl px-3.5 py-2.5 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F] resize-none"
                            />
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
                            onClick={submit}
                            disabled={isSaving}
                            // 누르는 순간 입력칸 포커스가 빠지며 키보드가 내려가 버튼이 움직이지 않도록 포커스를 뺏지 않는다
                            onMouseDown={(e) => e.preventDefault()}
                            className="w-full py-3.5 rounded-xl bg-[#D2571E] text-white font-extrabold text-[15px] cursor-pointer sm:hover:bg-[#b84a19] transition-colors disabled:opacity-50"
                        >
                            {isSaving ? "저장 중…" : submitLabel}
                        </button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
