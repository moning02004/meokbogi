"use client"

import {useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import toast from "react-hot-toast"
import {BsForkKnife} from "react-icons/bs"
import {FaGamepad, FaPlus} from "react-icons/fa"
import {IoMdHome} from "react-icons/io"
import {LuCheck, LuCopy, LuUser} from "react-icons/lu"
import {MdSentimentNeutral, MdSentimentSatisfiedAlt, MdSentimentVeryDissatisfied} from "react-icons/md"

import {InstallAppSection} from "@/components/ui/install_app_section"
import {getReviewTextBox} from "@/components/ui/review_textbox"
import {useAuthStore} from "@/store/auth"

const INSTALL_COMMAND = "curl -fsSL https://raw.githubusercontent.com/moning02004/meokbogi/main/install.sh | bash"

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()

    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (token) router.replace("/home")
    }, [token, router]);

    useEffect(() => {
        if (!copied) return
        const timer = setTimeout(() => setCopied(false), 1800)
        return () => clearTimeout(timer)
    }, [copied]);

    const copyInstallCommand = () => {
        navigator.clipboard.writeText(INSTALL_COMMAND)
            .then(() => setCopied(true))
            .catch(() => toast.error("복사하지 못했어요. 명령어를 직접 선택해 복사해주세요."))
    }

    return (
        <div className="min-h-[100dvh] bg-white">
            <div className="w-full max-w-[560px] mx-auto">

                {/* ================= 히어로 ================= */}
                <div className="px-6 pt-[calc(env(safe-area-inset-top)+44px)] pb-8 text-center">
                    <div className="inline-flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-full bg-[#E0603A] flex items-center justify-center">
                            <BrandMark size={16}/>
                        </div>
                        <span className="text-[15px] font-extrabold text-[#211D17] tracking-tight">먹보기</span>
                    </div>

                    <h1 className="text-[30px] leading-[1.28] font-extrabold text-[#211D17] tracking-tight mb-3.5">
                        먹어본 것만<br/>
                        <span className="text-[#D2571E]">차곡차곡</span> 쌓이는<br/>
                        나만의 맛집 목록
                    </h1>
                    <p className="text-[14px] text-[#8A8172] font-semibold leading-[1.75] mb-7">
                        &ldquo;저번에 그 집, 뭐가 맛있었더라?&rdquo;<br/>
                        그 질문에 답하려고 만들었습니다.
                    </p>

                    <button
                        onClick={() => router.push("/login")}
                        className="w-full max-w-[280px] py-3.5 rounded-xl bg-[#D2571E] text-white font-bold text-[15px] cursor-pointer active:scale-[0.98] sm:hover:bg-[#b84a19] transition-all"
                    >
                        기록하러 가기
                    </button>
                    <p className="text-[11.5px] text-[#B7AF9F] font-semibold mt-3">
                        아래에서 먼저 눌러보고 결정해도 괜찮아요
                    </p>
                </div>

                {/* ================= 앱 미리보기 ================= */}
                <div className="px-6 pb-11">
                    <AppPreview/>
                </div>

                {/* ================= 인터랙티브 데모 ================= */}
                <div className="px-5 pb-11">
                    <SectionLabel>직접 눌러보세요</SectionLabel>
                    <h2 className="text-[19px] font-extrabold text-[#211D17] tracking-tight mb-1.5">
                        기록은 이게 전부입니다
                    </h2>
                    <p className="text-[13px] text-[#8A8172] font-medium leading-relaxed mb-4">
                        먹은 메뉴마다 셋 중 하나만 누르면 끝. 별점 몇 개를 줄지 고민하지 않아도 됩니다.
                    </p>
                    <ReviewDemo/>
                </div>

                {/* ================= 사용 흐름 ================= */}
                <div className="px-5 pb-11">
                    <SectionLabel>이렇게 씁니다</SectionLabel>
                    <ol className="flex flex-col">
                        {STEPS.map(({title, desc}, index) => (
                            <li key={title} className="flex gap-3.5">
                                <div className="flex flex-col items-center shrink-0">
                                    <div
                                        className="w-7 h-7 rounded-full bg-[#24564A] text-white text-[12px] font-extrabold flex items-center justify-center">
                                        {index + 1}
                                    </div>
                                    {index < STEPS.length - 1 && <div className="w-px flex-1 bg-[#E7E0CF] my-1"/>}
                                </div>
                                <div className={index < STEPS.length - 1 ? "pb-5" : ""}>
                                    <div className="text-[14.5px] font-extrabold text-[#211D17] mb-1">{title}</div>
                                    <div
                                        className="text-[12.5px] text-[#8A8172] font-medium leading-relaxed">{desc}</div>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* ================= 기능 ================= */}
                <div className="px-5 pb-11">
                    <SectionLabel>이런 것도 있습니다</SectionLabel>
                    <div className="grid grid-cols-2 gap-2.5">
                        {FEATURES.map(({title, desc}) => (
                            <div key={title}
                                 className="bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-3.5 py-3.5">
                                <div className="text-[13px] font-extrabold text-[#211D17] mb-1">{title}</div>
                                <div className="text-[11.5px] text-[#8A8172] font-medium leading-relaxed">{desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ================= 설치 ================= */}
                <div className="px-5 pb-11">
                    <SectionLabel>직접 설치해서 씁니다</SectionLabel>
                    <div className="rounded-2xl bg-[#17372F] px-5 py-5 text-[#EFF4F1]">
                        <div className="text-[15px] font-extrabold mb-1.5">기록은 내 서버에만 남습니다</div>
                        <p className="text-[12.5px] text-[#9FB6AE] font-medium leading-relaxed mb-4">
                            남의 서버에 취향을 맡기지 않아도 됩니다. Docker와 git만 있으면 아래 한 줄로 끝나요.
                        </p>

                        <div
                            className="flex items-center gap-2 rounded-xl bg-black/25 border border-white/[0.12] pl-3 pr-2 py-2.5">
                            <code
                                className="flex-1 min-w-0 font-mono text-[11px] text-[#D8E5E0] overflow-x-auto whitespace-nowrap">
                                {INSTALL_COMMAND}
                            </code>
                            <button
                                onClick={copyInstallCommand}
                                aria-label="설치 명령어 복사"
                                className="shrink-0 flex items-center gap-1 text-[11.5px] font-bold text-[#17372F] bg-[#EFF4F1] rounded-lg px-2.5 py-1.5 cursor-pointer sm:hover:bg-white transition-colors"
                            >
                                {copied ? <LuCheck size={12}/> : <LuCopy size={12}/>}
                                {copied ? "복사됨" : "복사"}
                            </button>
                        </div>

                        <div className="flex flex-col gap-1.5 mt-4">
                            {INSTALL_NOTES.map((note) => (
                                <div key={note} className="flex gap-2 text-[12px] text-[#B9CFC8] font-medium">
                                    <span className="text-[#7FA99B]">·</span>
                                    <span className="leading-relaxed">{note}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <InstallAppSection/>

                {/* ================= 마무리 ================= */}
                <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+48px)] text-center">
                    <div className="text-[16px] font-extrabold text-[#211D17] tracking-tight mb-2">
                        오늘 먹은 것부터 남겨보세요
                    </div>
                    <p className="text-[12.5px] text-[#8A8172] font-medium leading-relaxed mb-5">
                        한 줄이면 됩니다. 세 번쯤 쌓이면 그때부터 목록이 일을 하기 시작해요.
                    </p>
                    <button
                        onClick={() => router.push("/login")}
                        className="w-full max-w-[280px] py-3.5 rounded-xl bg-[#D2571E] text-white font-bold text-[15px] cursor-pointer active:scale-[0.98] sm:hover:bg-[#b84a19] transition-all"
                    >
                        기록하러 가기
                    </button>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- 조각들

function SectionLabel({children}: { children: React.ReactNode }) {
    return (
        <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-3">
            {children}
        </div>
    )
}

function BrandMark({size}: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 120 120">
            <g transform="translate(60,60)" fill="#fff">
                <path d="M-22 -28 L-19 -28 L-19 -12 L-17 -8 L-17 28 L-21 28 L-21 -8 L-23 -12 L-23 -28 Z"/>
                <rect x="-18.5" y="-28" width="2.6" height="15"/>
                <rect x="-14.5" y="-28" width="2.6" height="15"/>
                <path d="M13 -28 Q22 -24 22 -12 Q22 -3 15 1 L15 28 L10 28 L10 1 Q6 -1 6 -8 Q6 -20 13 -28 Z"/>
            </g>
        </svg>
    )
}

// 실제 홈 화면(계기판 + 믿고 먹는 음식점)을 그대로 축소해 보여준다
function AppPreview() {
    return (
        <div
            className="mx-auto w-[248px] rounded-[26px] border-[7px] border-[#211D17] bg-white overflow-hidden shadow-[0_18px_44px_-14px_rgba(33,29,23,0.5)]">
            <div className="flex justify-between items-center bg-white border-b border-[#E7E0CF] px-3 py-2">
                <div>
                    <div className="text-[7px] font-semibold tracking-[0.14em] text-[#B7AF9F] uppercase">ZONE</div>
                    <div className="text-[12px] font-extrabold tracking-tight text-[#211D17]">우리집</div>
                </div>
                <div className="w-5 h-5 rounded-full bg-[#E4EEEA]"/>
            </div>

            <div className="p-2.5">
                <div className="rounded-[14px] bg-[#17372F] px-3 pt-2.5 pb-2 text-[#EFF4F1]">
                    <div className="flex items-center gap-1 text-[8px] font-semibold text-[#B9CFC8] mb-2">
                        <BsForkKnife size={8}/>
                        우리집 기록
                    </div>
                    <div className="flex">
                        {PREVIEW_STATS.map(({value, label}) => (
                            <div key={label} className="flex-1 text-center">
                                <div
                                    className="mx-1 font-mono text-[15px] font-semibold rounded-[6px] py-0.5 bg-white/[0.06] border border-white/[0.12]">
                                    {value}
                                </div>
                                <p className="text-[6.5px] font-medium text-[#9FB6AE] mt-1">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-1.5 mt-2.5">
                    <span className="px-2 py-1 rounded-full text-[8px] font-semibold bg-[#24564A] text-white">
                        믿고 먹는 음식점
                    </span>
                    <span
                        className="px-2 py-1 rounded-full text-[8px] font-semibold bg-white text-[#8A8172] border border-[#E7E0CF]">
                        최근 먹었던
                    </span>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                    {PREVIEW_ROWS.map(({name, category, avg}) => (
                        <div key={name}
                             className="flex items-center justify-between px-2.5 py-2 rounded-xl border border-[#E7E0CF]">
                            <div className="min-w-0">
                                <p className="text-[10.5px] font-bold text-[#211D17] tracking-tight truncate">{name}</p>
                                <p className="text-[8px] text-[#8A8172] mt-0.5">{category} 음식점</p>
                            </div>
                            <span className="shrink-0 scale-[0.78] origin-right">{getReviewTextBox(avg, "sm")}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-around border-t border-[#E7E0CF] px-2 py-1.5">
                <IoMdHome size={13} className="text-[#24564A]"/>
                <FaGamepad size={13} className="text-[#B7AF9F]"/>
                <div className="w-7 h-7 rounded-full bg-[#D2571E] flex items-center justify-center -translate-y-2">
                    <FaPlus size={11} className="text-white"/>
                </div>
                <BsForkKnife size={12} className="text-[#B7AF9F]"/>
                <LuUser size={13} className="text-[#B7AF9F]"/>
            </div>
        </div>
    )
}

type Sentiment = 1 | 0 | -1

// 실제 리뷰 입력과 같은 3단계. 누른 결과가 가게 평으로 어떻게 굴러가는지 그 자리에서 보여준다.
function ReviewDemo() {
    const [records, setRecords] = useState<Record<string, Sentiment>>({})

    const recorded = DEMO_MENUS.filter((menu) => menu in records)
    const average = recorded.length === 0
        ? 0
        : recorded.reduce((sum, menu) => sum + records[menu], 0) / recorded.length
    // 홈 대시보드가 '믿고 먹는 음식점'을 고르는 기준과 같다 (2회 이상 + 평균 0.6 이상)
    const isTrusted = recorded.length >= 2 && average >= 0.6

    return (
        <div className="rounded-2xl border border-[#E7E0CF] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#F0EBDD]">
                <div className="min-w-0">
                    <p className="text-[15px] font-extrabold text-[#211D17] tracking-tight">우리동네 치킨</p>
                    <p className="text-[12px] text-[#8A8172] mt-0.5">
                        치킨 음식점 · 기록 {recorded.length}건
                    </p>
                </div>
                {recorded.length > 0 && getReviewTextBox(average, "sm")}
            </div>

            <ul className="flex flex-col divide-y divide-[#F0EBDD]">
                {DEMO_MENUS.map((menu) => (
                    <li key={menu} className="flex items-center gap-2 px-4 py-3">
                        <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-[#211D17] truncate">
                            {menu}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                            {SENTIMENTS.map(({point, label, icon: Icon, on, off}) => {
                                const isPicked = records[menu] === point
                                return (
                                    <button
                                        key={label}
                                        onClick={() => setRecords((previous) => ({...previous, [menu]: point}))}
                                        aria-label={`${menu} ${label}`}
                                        aria-pressed={isPicked}
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${isPicked ? on : off}`}
                                    >
                                        <Icon size={19}/>
                                    </button>
                                )
                            })}
                        </div>
                    </li>
                ))}
            </ul>

            <div className="px-4 py-3.5 bg-[#FBFAF6] border-t border-[#F0EBDD]">
                {isTrusted ? (
                    <p className="text-[12.5px] font-bold text-[#24564A] leading-relaxed">
                        🎉 이제 홈에서 &lsquo;믿고 먹는 음식점&rsquo;으로 올라옵니다.
                    </p>
                ) : (
                    <p className="text-[12.5px] text-[#8A8172] font-medium leading-relaxed">
                        두 번 이상 좋게 남긴 곳만 홈의 &lsquo;믿고 먹는 음식점&rsquo;에 올라옵니다.
                        한 번 먹고 만 곳은 올라오지 않아요.
                    </p>
                )}

                {recorded.length > 0 && (
                    <button
                        onClick={() => setRecords({})}
                        className="text-[11.5px] font-bold text-[#B7AF9F] mt-2 cursor-pointer sm:hover:text-[#8A8172] transition-colors"
                    >
                        다시 해보기
                    </button>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------- 데이터

const PREVIEW_STATS = [
    {value: "12", label: "등록한 음식점"},
    {value: "47", label: "작성한 리뷰"},
    {value: "06", label: "이번 달 주문"},
]

const PREVIEW_ROWS = [
    {name: "우리동네 치킨", category: "치킨", avg: 1},
    {name: "미도리 초밥", category: "일식", avg: 0.7},
    {name: "골목 마라탕", category: "중식", avg: 0.4},
]

const DEMO_MENUS = ["간장치킨", "후라이드", "치즈볼"]

const SENTIMENTS = [
    {
        point: 1 as Sentiment,
        label: "만족",
        icon: MdSentimentSatisfiedAlt,
        on: "bg-[#B5E3C4] text-[#24564A]",
        off: "bg-[#F6F3EC] text-[#C4BCA8] sm:hover:bg-[#EDE8DC]",
    },
    {
        point: 0 as Sentiment,
        label: "보통",
        icon: MdSentimentNeutral,
        on: "bg-[#D6D2CC] text-[#5B5548]",
        off: "bg-[#F6F3EC] text-[#C4BCA8] sm:hover:bg-[#EDE8DC]",
    },
    {
        point: -1 as Sentiment,
        label: "별로",
        icon: MdSentimentVeryDissatisfied,
        on: "bg-[#EBB9A2] text-[#C23B1E]",
        off: "bg-[#F6F3EC] text-[#C4BCA8] sm:hover:bg-[#EDE8DC]",
    },
]

const STEPS = [
    {
        title: "장소부터 만듭니다",
        desc: "우리집, 회사, 친구집. 있는 자리에 따라 시킬 수 있는 데가 다르니까 처음부터 나눠둡니다. 한식·치킨·분식 같은 카테고리는 장소를 만들 때 기본으로 깔려요.",
    },
    {
        title: "먹고 나서 한 줄 남깁니다",
        desc: "가게 이름, 먹은 메뉴, 그리고 어땠는지. 같은 집이어도 메뉴마다 따로 남기니까 “여긴 국수는 좋은데 볶음밥은 별로” 같은 것도 그대로 남습니다.",
    },
    {
        title: "다음에 고를 때 꺼내봅니다",
        desc: "쌓인 기록이 알아서 정리해줍니다. 그래도 못 정하겠는 날엔 카드를 섞어 오늘의 카테고리를 뽑고, 그 카테고리의 내 가게 목록으로 바로 넘어갑니다.",
    },
]

const FEATURES = [
    {title: "장소별로 분리", desc: "우리집에서 시킬 수 있는 곳과 회사에서 시킬 수 있는 곳이 섞이지 않습니다."},
    {title: "메뉴별 집계", desc: "간장치킨 만족 3회, 후라이드 무난 2회처럼 메뉴 단위로 모입니다."},
    {title: "이번 달 주문", desc: "이번 달에 몇 번 시켰는지 홈에서 바로 보입니다."},
    {title: "카드 뽑기", desc: "못 정하는 날엔 카드를 섞어 카테고리를 골라줍니다."},
    {title: "홈 화면 앱", desc: "PWA라 홈 화면에 추가하면 주소창 없이 앱처럼 열립니다."},
    {title: "광고 없음", desc: "돈 낸 가게가 위로 올라오지 않습니다. 내 기록만 보입니다."},
]

const INSTALL_NOTES = [
    "설치 스크립트가 시크릿 키·DB 비밀번호를 알아서 만들고, 접속 주소에 맞춰 설정까지 맞춰줍니다.",
    "같은 자리에서 다시 실행하면 기존 데이터를 그대로 둔 채 최신 버전으로 갱신합니다.",
    "설치가 끝나면 그 자리에서 내 계정이 만들어집니다. 가입 절차는 따로 없어요.",
]
