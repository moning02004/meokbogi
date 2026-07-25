"use client"

import {useRouter} from "next/navigation"

export default function Page() {
    const router = useRouter() 

    return (
        <div className="min-h-[100dvh] bg-white">

            <div className="px-6 pt-[calc(env(safe-area-inset-top)+56px)] pb-10 text-center">
                <div className="w-16 h-16 rounded-full bg-[#E0603A] flex items-center justify-center mx-auto mb-5">
                    <svg width="31" height="31" viewBox="0 0 120 120">
                        <g transform="translate(60,60)" fill="#fff">
                            <path d="M-22 -28 L-19 -28 L-19 -12 L-17 -8 L-17 28 L-21 28 L-21 -8 L-23 -12 L-23 -28 Z"/>
                            <rect x="-18.5" y="-28" width="2.6" height="15"/>
                            <rect x="-14.5" y="-28" width="2.6" height="15"/>
                            <path
                                d="M13 -28 Q22 -24 22 -12 Q22 -3 15 1 L15 28 L10 28 L10 1 Q6 -1 6 -8 Q6 -20 13 -28 Z"/>
                        </g>
                    </svg>
                </div>
                <h1 className="text-[27px] font-extrabold text-[#211D17] tracking-tight mb-2">먹보기</h1>
                <p className="text-[14.5px] text-[#8A8172] font-semibold leading-relaxed">
                    <span className="text-[#D2571E] font-extrabold">먹어보고 기록하고</span><br/>
                    다녀온 식당을 나만의 기준으로
                </p>
            </div>

            <div className="mx-5 mb-8 bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-5 py-5 text-center">
                <p className="text-[13.5px] text-[#5B5548] font-semibold leading-[1.75]">
                    &ldquo;저번에 그 집 뭐가 맛있었더라?&rdquo;<br/>
                    매번 같은 고민을 반복하지 않도록,<br/>
                    <span className="text-[#24564A] font-extrabold">먹어본 것만</span> 차곡차곡 모아둡니다.
                </p>
            </div>

            <div className="px-5">
                <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-3.5">
                    이런 걸 할 수 있어요
                </div>
                <div className="flex flex-col gap-5 mb-9">
                    {FEATURES.map(({title, desc, bg, icon}) => (
                        <div key={title} className="flex gap-3.5 items-start">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                                {icon}
                            </div>
                            <div>
                                <div className="text-[14.5px] font-extrabold text-[#211D17] mb-0.5">{title}</div>
                                <div className="text-[12.5px] text-[#8A8172] font-medium leading-relaxed">{desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+40px)] text-center">
                <button
                    onClick={() => router.push("/login")}
                    className="text-[13px] font-bold text-[#24564A] border-[1.5px] border-[#E7E0CF] rounded-full px-7 py-3 cursor-pointer active:scale-[0.98] transition-transform"
                >
                    기록하러 가기
                </button>
            </div>
        </div>
    )
}

const FEATURES = [
    {
        title: "장소별로 나눠서 기록",
        desc: "우리집, 회사, 친구집. 지금 있는 자리에 맞는 식당만 모아서 봅니다.",
        bg: "bg-[#E4EEEA]",
        icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M3 11l9-8 9 8" stroke="#24564A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 10v10h14V10" stroke="#24564A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>,
    },
    {
        title: "메뉴 하나하나 솔직하게",
        desc: "좋았던 메뉴도, 별로였던 메뉴도. 같은 집이어도 메뉴별로 남겨둡니다.",
        bg: "bg-[#FDEBE1]",
        icon: <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.5" stroke="#D2571E" strokeWidth="2"/>
            <circle cx="9" cy="10" r="1" fill="#D2571E"/>
            <circle cx="15" cy="10" r="1" fill="#D2571E"/>
            <path d="M8.3 14.5c1.1 1 2.4 1.4 3.7 1.4s2.6-.4 3.7-1.4" stroke="#D2571E" strokeWidth="1.7"
                  strokeLinecap="round"/>
        </svg>,
    },
    {
        title: "못 정하겠는 날엔 뽑기",
        desc: "카드를 섞어 오늘의 메뉴를 골라주고, 그 메뉴를 파는 곳을 보여줍니다.",
        bg: "bg-[#F1EFE8]",
        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="#8A8172" strokeWidth="2"/>
            <circle cx="8.2" cy="8.2" r="1.5" fill="#8A8172"/>
            <circle cx="15.8" cy="8.2" r="1.5" fill="#8A8172"/>
            <circle cx="8.2" cy="15.8" r="1.5" fill="#8A8172"/>
            <circle cx="15.8" cy="15.8" r="1.5" fill="#8A8172"/>
            <circle cx="12" cy="12" r="1.5" fill="#8A8172"/>
        </svg>,
    },
]