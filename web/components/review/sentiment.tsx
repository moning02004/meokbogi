import {MdSentimentNeutral, MdSentimentSatisfiedAlt, MdSentimentVeryDissatisfied} from "react-icons/md";

export const SENTIMENTS = {
    1: {icon: MdSentimentSatisfiedAlt, bg: "bg-good-soft", text: "text-good", ring: "ring-good", label: "만족"},
    0: {icon: MdSentimentNeutral, bg: "bg-fill-hover", text: "text-ink2", ring: "ring-ink3", label: "보통"},
    [-1]: {icon: MdSentimentVeryDissatisfied, bg: "bg-bad-soft", text: "text-bad", ring: "ring-bad", label: "실망"},
} as const

export type SentimentKey = 1 | 0 | -1

// 만족·보통·실망 선택. 손가락으로 누르기 쉽도록 한 칸을 넉넉하게 잡고, 글자도 함께 보여준다.
export function SentimentPicker({value, onChange}: { value: SentimentKey; onChange: (value: SentimentKey) => void }) {
    return (
        <div role="radiogroup" aria-label="만족도" className="grid grid-cols-3 gap-2">
            {([1, 0, -1] as SentimentKey[]).map((option) => {
                const {icon: Icon, label, bg, text, ring} = SENTIMENTS[option]
                const active = value === option
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        onClick={() => onChange(option)}
                        className={`h-[72px] rounded-2xl flex flex-col items-center justify-center gap-1 text-[13.5px] cursor-pointer transition-colors ${
                            active ? `${bg} ${text} font-bold ring-2 ring-inset ${ring}` : "bg-fill text-ink3 font-semibold"
                        }`}
                    >
                        <Icon size={26}/>
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
