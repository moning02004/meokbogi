"use client"

import {parseMonth} from "@/lib/stats";
import {today} from "@/lib/date";

interface MonthCalendarProps {
    month: string                    // "2026-10"
    counts: Record<string, number>   // 날짜("2026-10-12") → 그날 간 음식점 수
    selected: string | null
    // 기록이 있는 날을 누르면 그 날짜, 다시 누르면 null
    onSelect: (date: string | null) => void
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const pad = (n: number) => String(n).padStart(2, "0")

// 한 달 달력. 기록을 남긴 날에 색을 칠하고, 간 음식점 수만큼 아래에 점을 찍는다.
export function MonthCalendar({month, counts, selected, onSelect}: MonthCalendarProps) {
    const {year, month: monthNumber} = parseMonth(month)
    const firstWeekday = new Date(year, monthNumber - 1, 1).getDay()
    const dayCount = new Date(year, monthNumber, 0).getDate()
    const todayKey = today()

    return (
        <div>
            <div className="grid grid-cols-7 mb-1" aria-hidden>
                {WEEKDAYS.map((weekday, i) => (
                    <span key={weekday}
                          className={`text-center text-[12px] font-semibold ${i === 0 ? "text-danger-text" : "text-ink3"}`}>
                        {weekday}
                    </span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({length: firstWeekday}).map((_, i) => <span key={`blank-${i}`}/>)}
                {Array.from({length: dayCount}).map((_, i) => {
                    const day = i + 1
                    const key = `${year}-${pad(monthNumber)}-${pad(day)}`
                    const count = counts[key] ?? 0
                    const isSelected = selected === key
                    const number = (
                        <span className={`w-9 h-9 flex items-center justify-center rounded-full text-[14px] tabular-nums transition-colors ${
                            isSelected ? "bg-chart text-on-chart font-bold"
                                : count > 0 ? "bg-chart-muted text-ink font-bold"
                                    : key > todayKey ? "text-ink4 font-medium"
                                        : "text-ink2 font-medium"
                        } ${key === todayKey && !isSelected ? "ring-1 ring-inset ring-ink3" : ""}`}>
                            {day}
                        </span>
                    )
                    const dots = (
                        <span className="h-1.5 flex items-center gap-0.5" aria-hidden>
                            {Array.from({length: Math.min(count, 3)}).map((_, dot) => (
                                <span key={dot} className="w-1 h-1 rounded-full bg-chart"/>
                            ))}
                        </span>
                    )
                    const className = "h-12 flex flex-col items-center justify-start gap-0.5"
                    return count > 0 ? (
                        <button key={key} type="button" aria-pressed={isSelected}
                                aria-label={`${monthNumber}월 ${day}일, 기록 ${count}곳`}
                                onClick={() => onSelect(isSelected ? null : key)}
                                className={`${className} cursor-pointer`}>
                            {number}
                            {dots}
                        </button>
                    ) : (
                        <span key={key} className={className}>{number}{dots}</span>
                    )
                })}
            </div>
        </div>
    )
}
