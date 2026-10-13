import {PamphletLayout} from "@/lib/guide";

// 팜플렛 모양을 종이의 실루엣으로 보여준다. 이름만으로는 어떤 모양인지 알기 어려워서 그렸다.
// 가로 종이는 넓게, 세로 종이는 길게, 채운 자리는 골목 정보(표지), 줄은 실린 집이다.
export function LayoutIcon({layout}: { layout: PamphletLayout }) {
    return (
        <svg viewBox="0 0 48 40" width="48" height="40" fill="currentColor" aria-hidden>
            {layout === "menu" && (
                <>
                    <rect x="2" y="7" width="44" height="26" rx="2" opacity="0.18"/>
                    <rect x="2" y="7" width="13" height="26" rx="2" opacity="0.55"/>
                    {[11, 15, 19, 23, 27].map((y) => <rect key={y} x="18" y={y} width="25" height="1.6" rx="0.8"/>)}
                </>
            )}
            {layout === "booklet" && (
                <>
                    {/* 뒤에 겹친 장은 표지 */}
                    <rect x="9" y="2" width="24" height="33" rx="2" opacity="0.55"/>
                    <rect x="15" y="5" width="24" height="33" rx="2" fill="var(--surface)"/>
                    <rect x="15" y="5" width="24" height="33" rx="2" opacity="0.18"/>
                    {/* 2×2 네 칸 */}
                    {[[18, 9], [28.5, 9], [18, 23], [28.5, 23]].map(([x, y]) => (
                        <g key={`${x}-${y}`}>
                            <circle cx={x + 1.8} cy={y + 1.8} r="1.8"/>
                            <rect x={x} y={y + 5.5} width="7.5" height="1.4" rx="0.7"/>
                            <rect x={x} y={y + 8.5} width="5.5" height="1.4" rx="0.7"/>
                        </g>
                    ))}
                </>
            )}
            {layout === "list" && (
                <>
                    <rect x="12" y="2" width="24" height="36" rx="2" opacity="0.18"/>
                    <rect x="12" y="2" width="24" height="9" rx="2" opacity="0.55"/>
                    {[14, 17, 20, 23, 26, 29, 32, 35].map((y) => <rect key={y} x="15" y={y} width="18" height="1.2" rx="0.6"/>)}
                </>
            )}
            {layout === "receipt" && (
                <>
                    <rect x="2" y="7" width="44" height="26" rx="2" opacity="0.4"/>
                    {[17, 32].map((x) => (
                        <g key={x}>
                            <rect x={x} y="10" width="12" height="20" fill="var(--surface)"/>
                            {[13.5, 19.5, 25.5].map((y) => <rect key={y} x={x + 2} y={y} width="8" height="1.4" rx="0.7"/>)}
                        </g>
                    ))}
                </>
            )}
        </svg>
    )
}
