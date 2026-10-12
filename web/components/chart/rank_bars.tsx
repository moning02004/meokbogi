interface RankRow {
    key: string | number
    label: string
    count: number
}

interface RankBarsProps {
    rows: RankRow[]
    // 값 뒤에 붙는 단위
    unit?: string
}

// 많은 순으로 가로 막대. 이름은 왼쪽, 값은 막대 끝에 붙인다.
export function RankBars({rows, unit = "번"}: RankBarsProps) {
    const max = Math.max(...rows.map((row) => row.count), 1)

    return (
        <ul className="flex flex-col gap-3">
            {rows.map((row) => (
                <li key={row.key} className="flex items-center gap-3">
                    <span className="w-[76px] shrink-0 text-[14px] font-semibold text-ink truncate">{row.label}</span>
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="h-4 rounded-r-[4px] bg-chart" aria-hidden
                              style={{width: `${Math.max((row.count / max) * 100, 2)}%`, maxWidth: "calc(100% - 44px)"}}/>
                        <span className="shrink-0 text-[13px] font-bold text-ink tabular-nums">{row.count}{unit}</span>
                    </span>
                </li>
            ))}
        </ul>
    )
}
