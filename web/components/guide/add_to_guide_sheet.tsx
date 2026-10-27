"use client"

import {useEffect, useState} from "react"
import {useAppRouter} from "@/components/navigation_progress";
import {Drawer} from "vaul"
import toast from "react-hot-toast"
import {GUIDE_PAGE} from "@/constants/routeUrl"
import {toastError} from "@/lib/api"
import {addRestaurantToGuide, fetchGuides, MAX_GUIDE_ENTRIES} from "@/lib/guide"
import {GuideType} from "@/types/guide"

interface AddToGuideSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    restaurant: { id: number; name: string }
}

// 음식점 상세의 "골목에 담기". 골목을 하나 고르면 그 끝에 싣는다. 한마디와 메뉴는 꾸미기 화면에서 붙인다.
export function AddToGuideSheet({open, onOpenChange, restaurant}: AddToGuideSheetProps) {
    const router = useAppRouter()
    const [guides, setGuides] = useState<GuideType[] | null>(null)
    const [busyId, setBusyId] = useState<number | null>(null)

    useEffect(() => {
        if (!open) return
        fetchGuides().then(setGuides).catch((error) => {
            setGuides([])
            toastError(error, "골목을 불러오지 못했어요.")
        })
    }, [open])

    const add = (guide: GuideType) => {
        if (busyId !== null) return
        setBusyId(guide.id)
        addRestaurantToGuide(guide.id, restaurant.id)
            .then((result) => {
                onOpenChange(false)
                toast.success(result === "exists"
                    ? `이미 '${guide.title}'에 실려 있어요.`
                    : `'${guide.title}'에 담았어요.`)
            })
            .catch((error) => toastError(error, "골목에 담지 못했어요."))
            .finally(() => setBusyId(null))
    }

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>
                <Drawer.Content
                    aria-describedby={undefined}
                    className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-[560px] max-h-[80dvh] flex flex-col bg-surface outline-none rounded-t-[28px]">
                    <div className="shrink-0 flex flex-col items-center pt-2.5">
                        <div className="w-10 h-1 rounded-full bg-line-strong" aria-hidden/>
                    </div>
                    <Drawer.Title className="shrink-0 px-5 pt-3 pb-1 text-[16px] font-extrabold text-ink">
                        어느 골목에 담을까요?
                    </Drawer.Title>
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-1 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                        {guides === null ? (
                            <p className="text-ink3 text-center py-6 text-[13.5px]">불러오는 중…</p>
                        ) : guides.map((guide) => {
                            const full = guide.entry_count >= MAX_GUIDE_ENTRIES
                            return (
                                <button
                                    key={guide.id}
                                    onClick={() => add(guide)}
                                    disabled={full || busyId !== null}
                                    className="w-full h-[56px] px-3 flex items-center justify-between gap-3 text-left rounded-xl cursor-pointer sm:hover:bg-fill transition-colors disabled:opacity-50 disabled:cursor-default"
                                >
                                    <span className="text-[16px] font-semibold text-ink truncate">{guide.title}</span>
                                    <span className="shrink-0 text-[12.5px] font-semibold text-ink3 tabular-nums">
                                        {full ? "가득 참" : `${guide.entry_count}곳`}
                                    </span>
                                </button>
                            )
                        })}
                        {guides?.length === 0 && (
                            <p className="text-ink3 text-center py-4 text-[13.5px]">아직 만든 골목이 없어요.</p>
                        )}
                        <button
                            onClick={() => router.push(GUIDE_PAGE.list)}
                            className="w-full h-12 mt-1 rounded-xl text-center bg-fill sm:hover:bg-fill-hover cursor-pointer text-ink font-bold text-[14.5px] transition-colors">
                            새 골목 만들기
                        </button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
