"use client"

import {useEffect, useState} from "react"
import {useAppRouter} from "@/components/navigation_progress";
import {FaArrowLeft} from "react-icons/fa";
import {LuChevronRight} from "react-icons/lu";
import toast from "react-hot-toast";
import {GUIDE_PAGE} from "@/constants/routeUrl";
import {toastError} from "@/lib/api";
import {createGuide, fetchGuides, GuideGrade} from "@/lib/guide";
import {GuideType} from "@/types/guide";
import {Skeleton} from "@/components/skeleton";
import {SpoonGradePicker, Spoons} from "@/components/guide/spoon_grade";

// 먹골목: 내가 만든 골목 목록과 새 골목 만들기
export default function Page() {
    const router = useAppRouter()
    const [guides, setGuides] = useState<GuideType[] | null>(null)
    const [title, setTitle] = useState("")
    const [grade, setGrade] = useState<GuideGrade>(0)
    const [isCreating, setIsCreating] = useState(false)

    useEffect(() => {
        fetchGuides().then(setGuides).catch((error) => {
            setGuides([])
            toastError(error, "골목을 불러오지 못했어요.")
        })
    }, [])

    const create = () => {
        const name = title.trim()
        if (isCreating) return
        if (!name) {
            toast.error("골목 이름을 적어주세요.")
            return
        }
        setIsCreating(true)
        createGuide(name, grade)
            .then((guide) => router.push(GUIDE_PAGE.detail(guide.id)))
            .catch((error) => {
                toastError(error, "골목을 만들지 못했어요.")
                setIsCreating(false)
            })
    }

    return (
        <div className="min-h-[100%] pb-6">
            <div className="flex items-center gap-1 h-14 px-2">
                <button onClick={() => router.back()} aria-label="뒤로"
                        className="w-11 h-11 flex items-center justify-center rounded-full text-ink cursor-pointer sm:hover:bg-fill transition-colors">
                    <FaArrowLeft size={16}/>
                </button>
                <div className="text-[17px] font-bold text-ink">먹골목</div>
            </div>

            <p className="px-5 text-[13.5px] text-ink2 leading-relaxed">
                먹어본 집 가운데 몇 곳을 골라 한마디를 붙이고 링크로 건네요. 목록 하나가 골목 하나예요.
            </p>

            <div className="px-5 pt-4">
                <div className="bg-surface rounded-3xl p-4 flex flex-col gap-2.5">
                    <label htmlFor="guide-title" className="text-[12.5px] font-bold text-ink3">새 골목</label>
                    <input
                        id="guide-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) create()
                        }}
                        maxLength={50}
                        placeholder="예: 을지로 점심 골목"
                        autoComplete="off"
                        className="w-full rounded-[14px] px-3.5 py-3 text-[14.5px] text-ink bg-fill outline-none focus:ring-2 focus:ring-strong transition-shadow placeholder:text-ink4"
                    />
                    <div className="text-[12.5px] font-bold text-ink3 mt-1">
                        추천 등급 <span className="font-medium">(나중에 바꿀 수 있어요)</span>
                    </div>
                    <SpoonGradePicker value={grade} onChange={setGrade}/>
                    <button
                        onClick={create}
                        disabled={isCreating}
                        className="w-full h-12 rounded-[16px] bg-accent text-on-accent font-bold text-[15px] cursor-pointer sm:hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating ? "만드는 중…" : "골목 만들기"}
                    </button>
                </div>
            </div>

            <div className="px-5 pt-5">
                <div className="text-[13px] font-semibold text-ink3 mb-2 px-1">내 골목</div>
                <div className="bg-surface rounded-3xl pl-4 pr-2 py-1.5">
                    {guides === null ? (
                        Array.from({length: 3}).map((_, i) => <Skeleton key={i}/>)
                    ) : !guides.length ? (
                        <p className="text-ink3 text-center py-8 pr-2 text-[13.5px]">
                            아직 만든 골목이 없어요. 위에서 이름을 적고 시작해 보세요.
                        </p>
                    ) : guides.map((guide) => (
                        <button
                            key={guide.id}
                            onClick={() => router.push(GUIDE_PAGE.detail(guide.id))}
                            className="w-full flex items-center gap-2 py-3.5 text-left border-b border-line last:border-0 cursor-pointer"
                        >
                            <span className="flex-1 min-w-0">
                                <span className="flex items-center gap-2">
                                    <span className="font-bold text-[16px] text-ink tracking-tight truncate">{guide.title}</span>
                                    <Spoons grade={guide.grade} height={16} className="shrink-0 text-accent-text"/>
                                </span>
                                <span className="block text-[13px] text-ink3 mt-0.5">
                                    {guide.entry_count}곳{guide.edition && ` · ${guide.edition}`}
                                </span>
                            </span>
                            <span className={`shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full ${
                                guide.share_token ? "bg-good-soft text-good" : "bg-fill text-ink3"
                            }`}>
                                {guide.share_token ? "공개 중" : "나만 보기"}
                            </span>
                            <LuChevronRight size={16} className="shrink-0 text-ink3"/>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
