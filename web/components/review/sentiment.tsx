import {MdSentimentNeutral, MdSentimentSatisfiedAlt, MdSentimentVeryDissatisfied} from "react-icons/md";

export const SENTIMENTS = {
    1: {icon: MdSentimentSatisfiedAlt, color: "#24564A", bg: "bg-[#B5E3C4]", text: "text-[#24564A]", label: "만족"},
    0: {icon: MdSentimentNeutral, color: "#8A8172", bg: "bg-[#D6D2CC]", text: "text-[#8A8172]", label: "보통"},
    [-1]: {
        icon: MdSentimentVeryDissatisfied,
        color: "#C23B1E",
        bg: "bg-[#EBB9A2]",
        text: "text-[#C23B1E]",
        label: "실망"
    },
} as const

export type SentimentKey = 1 | 0 | -1

// 만족·보통·실망 선택. 손가락으로 누르기 쉽도록 한 칸을 넉넉하게 잡고, 글자도 함께 보여준다.
export function SentimentPicker({value, onChange}: { value: SentimentKey; onChange: (value: SentimentKey) => void }) {
    return (
        <div role="radiogroup" aria-label="만족도" className="grid grid-cols-3 bg-[#F6F3EC] rounded-xl p-[3px] gap-[3px]">
            {([1, 0, -1] as SentimentKey[]).map((option) => {
                const {icon: Icon, label} = SENTIMENTS[option]
                const active = value === option
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        onClick={() => onChange(option)}
                        className={`h-11 rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-bold cursor-pointer transition-colors ${
                            active ? "bg-[#24564A] text-white" : "text-[#B7AF9F]"
                        }`}
                    >
                        <Icon size={19} color={active ? "#FFFFFF" : "#B7AF9F"}/>
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
