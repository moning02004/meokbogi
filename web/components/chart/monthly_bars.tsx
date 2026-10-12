"use client"

import {MonthlyVisit, parseMonth} from "@/lib/stats";

interface MonthlyBarsProps {
    months: MonthlyVisit[]
    // 강조할 달(막대 위에 값이 붙는다). 없으면 마지막 달
    selected?: string
    // 주면 막대를 눌러 달을 고를 수 있다
    onSelect?: (month: string) => void
    // 막대가 그려지는 높이(px)
    height?: number
    // 홈 카드처럼 작게 볼 때: 달 이름을 줄이고 값은 붙이지 않는다
    compact?: boolean
}

// 달마다 몇 번 먹었는지 세로 막대로. 고른 달만 진하게, 나머지는 옅게 둬서 한 달이 눈에 들어오게 한다.
export function MonthlyBars({months, selected, onSelect, height = 132, compact = false}: MonthlyBarsProps) {
    const max = Math.max(...months.map((row) => row.count), 1)
    const active = selected ?? months[months.length - 1]?.month

    return (
        <div className="w-full">
            <div className="flex items-end gap-0.5" style={{height: height + (compact ? 0 : 22)}}>
                {months.map((row) => {
                    const {year, month} = parseMonth(row.month)
                    const isActive = row.month === active
                    // 0번인 달도 자리가 보이도록 바닥에 얇게 남긴다
                    const barHeight = row.count === 0 ? 2 : Math.max(Math.round((row.count / max) * height), 4)
                    const bar = (
                        <>
                            {!compact && (
                                <span className={`text-[12px] tabular-nums leading-none mb-1.5 ${
                                    isActive ? "font-bold text-ink" : "font-semibold text-transparent"}`}>
                                    {row.count}
                                </span>
                            )}
                            <span
                                className={`w-full max-w-6 rounded-t-[4px] transition-colors ${
                                    row.count === 0 ? "bg-line-strong" : isActive ? "bg-chart" : "bg-chart-muted"}`}
                                style={{height: barHeight}}
                            />
                        </>
                    )
                    const className = "flex-1 min-w-0 h-full flex flex-col items-center justify-end"
                    return onSelect ? (
                        <button key={row.month} type="button" aria-pressed={isActive}
                                aria-label={`${year}년 ${month}월 ${row.count}번`}
                                onClick={() => onSelect(row.month)}
                                className={`${className} cursor-pointer`}>
                            {bar}
                        </button>
                    ) : (
                        <div key={row.month} className={className}>{bar}</div>
                    )
                })}
            </div>
            <div className="flex gap-0.5 border-t border-line pt-1.5" aria-hidden>
                {months.map((row) => {
                    const {month} = parseMonth(row.month)
                    const isActive = row.month === active
                    return (
                        <span key={row.month}
                              className={`flex-1 min-w-0 text-center tabular-nums whitespace-nowrap ${compact ? "text-[10px]" : "text-[11px]"} ${
                                  isActive ? "font-bold text-ink" : "font-medium text-ink3"}`}>
                            {month}{compact ? "" : "월"}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}
