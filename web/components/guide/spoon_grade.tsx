import {GUIDE_GRADE_LABELS, GuideGrade} from "@/lib/guide";

// 앱 아이콘의 숟가락과 같은 모양 (public/icons/icon-maskable.svg)
function Spoon({height}: { height: number }) {
    return (
        <svg viewBox="5 -29 18 58" height={height} width={height * 18 / 58} fill="currentColor" aria-hidden>
            <path d="M13 -28 Q22 -24 22 -12 Q22 -3 15 1 L15 28 L10 28 L10 1 Q6 -1 6 -8 Q6 -20 13 -28 Z"/>
        </svg>
    )
}

// 골목의 추천 등급을 숟가락 개수로 보여준다. 등급이 없으면 아무것도 그리지 않는다.
export function Spoons({grade, height = 18, className = "text-accent-text"}: {
    grade: number; height?: number; className?: string
}) {
    if (grade < 1) return null
    return (
        <span role="img" aria-label={`숟가락 ${grade}개`} className={`inline-flex items-center gap-0.5 ${className}`}>
            {Array.from({length: grade}).map((_, i) => <Spoon key={i} height={height}/>)}
        </span>
    )
}

// 추천 등급 고르기: 없음 / 숟가락 1~3개. 고른 등급이 무슨 뜻인지 아래에 적어 준다.
export function SpoonGradePicker({value, onChange}: { value: GuideGrade; onChange: (grade: GuideGrade) => void }) {
    return (
        <div>
            <div role="radiogroup" aria-label="추천 등급" className="grid grid-cols-4 gap-1.5">
                {([0, 1, 2, 3] as GuideGrade[]).map((grade) => {
                    const active = value === grade
                    return (
                        <button
                            key={grade}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={grade === 0 ? "등급 없음" : `숟가락 ${grade}개`}
                            onClick={() => onChange(grade)}
                            className={`h-12 rounded-[14px] flex items-center justify-center text-[13.5px] cursor-pointer transition-colors ${
                                active ? "bg-strong text-white font-bold" : "bg-fill text-ink2 font-semibold sm:hover:bg-fill-hover"
                            }`}
                        >
                            {grade === 0 ? "없음" : <Spoons grade={grade} height={22} className=""/>}
                        </button>
                    )
                })}
            </div>
            <p className="mt-1.5 text-[12px] text-ink3 min-h-[18px]">
                {value === 0 ? "등급을 매기지 않아요." : GUIDE_GRADE_LABELS[value]}
            </p>
        </div>
    )
}
