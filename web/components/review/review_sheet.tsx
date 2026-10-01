"use client"

import {forwardRef, useState} from "react"
import {Drawer} from "vaul"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import {ko} from "date-fns/locale"
import {LuCalendar, LuChevronDown, LuChevronLeft, LuChevronRight} from "react-icons/lu"
import {SentimentKey, SentimentPicker} from "@/components/review/sentiment"
import {useKeyboardInset, useVisibleHeight} from "@/hooks/useVisualViewport"
import {daysSince, formatDate, parseLocalDate, today} from "@/lib/date"
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
    // 이 음식점에서 전에 기록한 메뉴들 (고르기 · 표기 합치기 안내)
    menus: { menu: string; review_count: number }[]
    onSubmit: (draft: ReviewDraft) => Promise<unknown>
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

// "오늘 · 10월 1일 (수)" 처럼 읽히는 날짜
const dateLabel = (value: string) => {
    const date = parseLocalDate(value)
    const text = `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`
    const ago = daysSince(value)
    if (ago === 0) return `오늘 · ${text}`
    if (ago === 1) return `어제 · ${text}`
    if (date.getFullYear() !== new Date().getFullYear()) return `${date.getFullYear()}년 ${text}`
    return text
}

// 날짜 칸. 키보드가 뜨지 않도록 입력창이 아니라 버튼이고, 누르면 달력이 떠서 나온다.
const DateButton = forwardRef<HTMLButtonElement, { label: string; onClick?: () => void }>(
    ({label, onClick}, ref) => (
        <button
            type="button"
            ref={ref}
            onClick={onClick}
            aria-labelledby="review-date-label review-date-value"
            className="w-full flex items-center gap-2 text-[14px] font-semibold text-[#211D17] bg-white border border-[#E7E0CF] rounded-xl px-3.5 py-3 cursor-pointer"
        >
            <LuCalendar size={16} className="text-[#8A8172]"/>
            <span id="review-date-value" className="flex-1 text-left">{label}</span>
            <LuChevronDown size={16} className="text-[#B7AF9F]"/>
        </button>
    )
)
DateButton.displayName = "DateButton"

// 리뷰 쓰기·고치기 바텀시트.
// 키보드가 올라오면 시트 전체를 키보드 위로 올려서 저장 버튼이 항상 키보드 바로 위에 있게 한다.
export function ReviewSheet({open, onOpenChange, title, submitLabel, initial, menus, onSubmit}: ReviewSheetProps) {
    const [orderedAt, setOrderedAt] = useState(initial.ordered_at)
    const [menu, setMenu] = useState(initial.menu)
    const [point, setPoint] = useState<SentimentKey>(initial.point)
    const [content, setContent] = useState(initial.content)
    const [error, setError] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    // 메뉴 칸을 누르면 그 아래에 고를 수 있는 메뉴 상자가 열린다
    const [isMenuBoxOpen, setIsMenuBoxOpen] = useState(false)

    const keyboardInset = useKeyboardInset()
    const visibleHeight = useVisibleHeight()

    const keyword = menu.trim()
    const key = normalizeMenu(keyword)
    const menuOptions = menus.filter((option) => option.menu && (!key || normalizeMenu(option.menu).includes(key)))
    const exactMatch = menus.some((option) => option.menu === keyword)
    // 띄어쓰기만 다른 기존 메뉴가 있으면 서버가 그 표기로 합쳐서 저장한다. 미리 알려준다.
    const mergeTarget = keyword
        ? menus.find((option) => option.menu !== keyword && normalizeMenu(option.menu) === key)?.menu
        : undefined
    const date = orderedAt || today()

    const chooseMenu = (value: string) => {
        setMenu(value)
        setError("")
        setIsMenuBoxOpen(false)
        // 골랐으면 키보드를 내린다
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }

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
                            <div id="review-date-label" className="text-[12px] font-bold text-[#8A8172] mb-1.5">먹은 날</div>
                            <DatePicker
                                locale={ko}
                                selected={parseLocalDate(date)}
                                maxDate={new Date()}
                                onChange={(value: Date | null) => {
                                    if (value) setOrderedAt(formatDate(value))
                                }}
                                onCalendarOpen={() => setIsMenuBoxOpen(false)}
                                customInput={<DateButton label={dateLabel(date)}/>}
                                wrapperClassName="w-full"
                                // 달력은 버튼 위에 떠서 나온다. 포털로 시트 밖에 그리면 시트가 바깥 클릭을 막으므로
                                // 시트 DOM 안에 그리되, fixed 배치로 스크롤 영역에 잘리지 않게 한다.
                                popperClassName="review-calendar"
                                popperPlacement="bottom-start"
                                popperProps={{strategy: "fixed"}}
                                renderCustomHeader={({date: shown, decreaseMonth, increaseMonth, nextMonthButtonDisabled}) => (
                                    <div className="flex items-center justify-between px-2 py-2">
                                        <button type="button" onClick={decreaseMonth} aria-label="이전 달"
                                                className="w-10 h-10 flex items-center justify-center rounded-full text-[#5B5548] cursor-pointer sm:hover:bg-[#F1EDE2]">
                                            <LuChevronLeft size={18}/>
                                        </button>
                                        <span className="text-[15px] font-extrabold text-[#211D17]">
                                            {shown.getFullYear()}년 {shown.getMonth() + 1}월
                                        </span>
                                        {/* 미래 날짜는 고를 수 없지만 자리는 지켜서 가운데 정렬이 흔들리지 않게 한다 */}
                                        <button type="button" onClick={increaseMonth} aria-label="다음 달"
                                                disabled={nextMonthButtonDisabled}
                                                className="w-10 h-10 flex items-center justify-center rounded-full text-[#5B5548] cursor-pointer sm:hover:bg-[#F1EDE2] disabled:text-[#E7E0CF] disabled:cursor-default disabled:hover:bg-transparent">
                                            <LuChevronRight size={18}/>
                                        </button>
                                    </div>
                                )}
                            />
                        </div>

                        <div>
                            <label htmlFor="review-menu" className="block text-[12px] font-bold text-[#8A8172] mb-1.5">
                                메뉴 <span className="text-[#D2571E]">*</span>
                            </label>
                            <div className="relative">
                            <input
                                id="review-menu"
                                value={menu}
                                onChange={(e) => {
                                    setMenu(e.target.value)
                                    setError("")
                                    setIsMenuBoxOpen(true)
                                }}
                                onFocus={() => setIsMenuBoxOpen(true)}
                                onBlur={() => setIsMenuBoxOpen(false)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.nativeEvent.isComposing) chooseMenu(menu)
                                }}
                                maxLength={255}
                                placeholder="눌러서 고르거나 직접 입력"
                                enterKeyHint="done"
                                autoComplete="off"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded={isMenuBoxOpen}
                                aria-controls="review-menu-box"
                                className="w-full text-[15px] text-[#211D17] border border-[#E7E0CF] rounded-xl px-3.5 py-3 outline-none focus:border-[#24564A] transition-colors placeholder:text-[#B7AF9F]"
                            />
                            {isMenuBoxOpen && (
                                // 항목을 누를 때 입력칸 포커스가 먼저 빠져 상자가 닫히지 않도록 mousedown 기본 동작을 막는다
                                <div id="review-menu-box" role="listbox" aria-label="메뉴 고르기"
                                     onMouseDown={(e) => e.preventDefault()}
                                     className="absolute left-0 right-0 top-full z-20 mt-1.5 border border-[#E7E0CF] rounded-xl bg-white shadow-lg max-h-52 overflow-y-auto">
                                    {keyword && !exactMatch && !mergeTarget && (
                                        <button type="button" role="option" aria-selected={false}
                                                onClick={() => chooseMenu(keyword)}
                                                className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left text-[14px] cursor-pointer sm:hover:bg-[#F6F3EC] border-b border-[#F0EBDD] last:border-0">
                                            <span className="font-bold text-[#211D17] truncate">&lsquo;{keyword}&rsquo;</span>
                                            <span className="shrink-0 text-[12px] font-bold text-[#D2571E]">새 메뉴로 쓰기</span>
                                        </button>
                                    )}
                                    {menuOptions.map((option) => (
                                        <button key={option.menu} type="button" role="option"
                                                aria-selected={option.menu === keyword}
                                                onClick={() => chooseMenu(option.menu)}
                                                className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left text-[14px] cursor-pointer sm:hover:bg-[#F6F3EC] border-b border-[#F0EBDD] last:border-0">
                                            <span className="font-semibold text-[#211D17] truncate">{option.menu}</span>
                                            <span className="shrink-0 text-[12px] font-semibold text-[#B7AF9F]">리뷰 {option.review_count}</span>
                                        </button>
                                    ))}
                                    {!keyword && menuOptions.length === 0 && (
                                        <p className="px-3.5 py-3 text-[13px] text-[#8A8172]">처음 기록하는 곳이에요. 메뉴 이름을 입력해주세요.</p>
                                    )}
                                </div>
                            )}
                            </div>
                            {mergeTarget && (
                                <p className="mt-1.5 text-[12px] font-semibold text-[#24564A]">
                                    &lsquo;{mergeTarget}&rsquo;(으)로 합쳐서 기록돼요.
                                </p>
                            )}
                        </div>

                        <div>
                            <div className="text-[12px] font-bold text-[#8A8172] mb-1.5">어땠어요?</div>
                            <SentimentPicker value={point} onChange={setPoint}/>
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
