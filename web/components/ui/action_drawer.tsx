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

export function ActionDrawer({trigger, items, closeLabel = "취소", extraButton, triggerLabel = "더보기"}: ActionDrawerProps) {
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
                            className="drawer-button cursor-pointer sm:hover:bg-gray-200 rounded-full p-2.5 -m-2.5">
                        <LuEllipsisVertical size={16}/>
                    </button>
                )}
            </Drawer.Trigger>

            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>

                <Drawer.Content
                    className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full md:w-[50vw] bg-white outline-none">
                    {pending?.confirm ? (
                        <div className="flex flex-col gap-3 p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
                            <Drawer.Title className="text-[15px] font-extrabold text-[#211D17]">
                                {pending.confirm.title}
                            </Drawer.Title>
                            {pending.confirm.description && (
                                <Drawer.Description className="text-[13px] text-[#8A8172] leading-relaxed">
                                    {pending.confirm.description}
                                </Drawer.Description>
                            )}
                            <div className="flex gap-2 mt-1">
                                <button
                                    onClick={() => setPending(null)}
                                    className="flex-1 py-3 rounded-lg text-[13.5px] font-bold text-[#5B5548] bg-white border border-[#E7E0CF] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors">
                                    취소
                                </button>
                                <button
                                    onClick={() => run(pending)}
                                    autoFocus
                                    className={`flex-1 py-3 rounded-lg text-[13.5px] font-bold text-white cursor-pointer transition-colors ${
                                        pending.danger ? "bg-[#C23B1E] sm:hover:bg-[#a63118]" : "bg-[#24564A] sm:hover:bg-[#1c443a]"
                                    }`}>
                                    {pending.confirm.confirmLabel ?? pending.label}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
                            <Drawer.Title className="sr-only">메뉴</Drawer.Title>
                            {items.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => item.confirm ? setPending(item) : run(item)}
                                    className={`w-full p-3 text-left hover:bg-[#efefef] cursor-pointer rounded border-b border-[#ededed] ${
                                        item.danger ? "text-red-600" : ""
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                            {closeLabel &&
                                <Drawer.Close className="w-full p-3 hover:bg-[#efefef] rounded cursor-pointer text-left">
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
