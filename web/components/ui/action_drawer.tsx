"use client"

import {useState} from "react"
import {LuEllipsisVertical} from "react-icons/lu"
import {Drawer} from "vaul"

interface ActionConfirm {
    title: string
    description?: string
    confirmLabel?: string
}

interface ActionDrawerItem {
    label: string
    onClick?: () => void
    danger?: boolean
    // 되돌릴 수 없는 동작이면 같은 시트 안에서 한 번 더 묻는다.
    // 브라우저 confirm()은 홈 화면 앱에서 주소가 찍힌 시스템 창으로 떠서 쓰지 않는다.
    confirm?: ActionConfirm
}

interface ActionDrawerProps {
    /** 기본값: 케밥(⋮) 아이콘 트리거 */
    trigger?: React.ReactNode
    items: ActionDrawerItem[]
    closeLabel?: string | null
    extraButton?: React.ReactNode
    /** 기본 트리거의 스크린리더용 이름 */
    triggerLabel?: string
}

export function ActionDrawer({
                                 trigger,
                                 items,
                                 closeLabel = "취소",
                                 extraButton,
                                 triggerLabel = "더보기"
                             }: ActionDrawerProps) {
    const [open, setOpen] = useState(false)
    const [pending, setPending] = useState<ActionDrawerItem | null>(null)

    const onOpenChange = (next: boolean) => {
        setOpen(next)
        // 닫히는 애니메이션 동안 확인 화면이 목록으로 바뀌어 보이지 않도록, 열 때 초기화한다
        if (next) setPending(null)
    }

    const run = (item: ActionDrawerItem) => {
        setOpen(false)
        item.onClick?.()
    }

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Trigger asChild>
                {trigger ?? (
                    <button aria-label={triggerLabel}
                            className="w-11 h-11 flex items-center justify-center rounded-full text-ink cursor-pointer sm:hover:bg-fill-hover transition-colors">
                        <LuEllipsisVertical size={19}/>
                    </button>
                )}
            </Drawer.Trigger>

            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>

                <Drawer.Content
                    className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-[560px] bg-surface outline-none rounded-t-[28px]">
                    <div className="shrink-0 flex flex-col items-center pt-2.5">
                        <div className="w-10 h-1 rounded-full bg-line-strong" aria-hidden/>
                    </div>
                    {pending?.confirm ? (
                        <div className="flex flex-col gap-3 p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
                            <Drawer.Title className="text-[18px] font-extrabold tracking-tight text-ink">
                                {pending.confirm.title}
                            </Drawer.Title>
                            {pending.confirm.description && (
                                <Drawer.Description className="text-[14px] text-ink3 leading-relaxed">
                                    {pending.confirm.description}
                                </Drawer.Description>
                            )}
                            <div className="flex gap-2 mt-1">
                                <button
                                    onClick={() => setPending(null)}
                                    className="flex-1 h-[52px] rounded-2xl text-[15px] font-bold text-ink bg-fill cursor-pointer sm:hover:bg-fill-hover transition-colors">
                                    취소
                                </button>
                                <button
                                    onClick={() => run(pending)}
                                    autoFocus
                                    className={`flex-1 h-[52px] rounded-2xl text-[15px] font-bold text-white cursor-pointer transition-colors ${
                                        pending.danger ? "bg-danger sm:hover:bg-danger-hover" : "bg-strong sm:hover:bg-strong-hover"
                                    }`}>
                                    {pending.confirm.confirmLabel ?? pending.label}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                            <Drawer.Title className="sr-only">메뉴</Drawer.Title>
                            {items.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => item.confirm ? setPending(item) : run(item)}
                                    className={`w-full h-[52px] px-3 text-left text-[16px] font-semibold rounded-xl cursor-pointer sm:hover:bg-fill transition-colors ${
                                        item.danger ? "text-danger-text" : "text-ink"
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                            {closeLabel &&
                                <Drawer.Close
                                    className="w-full h-[52px] px-3 text-left text-[16px] font-semibold text-ink3 rounded-xl cursor-pointer sm:hover:bg-fill transition-colors">
                                    {closeLabel}
                                </Drawer.Close>
                            }
                            {extraButton}
                        </div>
                    )}
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
