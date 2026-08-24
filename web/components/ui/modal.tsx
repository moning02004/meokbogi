"use client"

import {Drawer} from "vaul"

interface ModalProps {
    trigger?: React.ReactNode
    title: string
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    // 관리 화면처럼 내용이 긴 경우. 모바일은 전체화면, 데스크톱은 가운데 큰 패널로 띄운다.
    fullScreen?: boolean
}

export function Modal({trigger, title, children, open, onOpenChange, fullScreen = false}: ModalProps) {
    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}

            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>

                {fullScreen ? (
                    // vaul이 열림/닫힘 애니메이션에 transform을 쓰므로 위치는 inset으로만 잡는다
                    <Drawer.Content
                        className="fixed inset-0 z-50 flex flex-col bg-white outline-none md:inset-y-[7vh] md:inset-x-[25vw] md:rounded-2xl md:overflow-hidden">
                        <div
                            className="shrink-0 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+18px)] pb-3.5 border-b border-[#F0EBDD] md:pt-4">
                            <Drawer.Title className="text-[16px] font-extrabold text-[#211D17] truncate pr-3">
                                {title}
                            </Drawer.Title>
                            <Drawer.Close
                                className="shrink-0 text-[12.5px] font-bold text-[#B7AF9F] cursor-pointer sm:hover:text-[#8A8172] transition-colors">
                                닫기
                            </Drawer.Close>
                        </div>
                        <div
                            className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                            {children}
                        </div>
                    </Drawer.Content>
                ) : (
                    <Drawer.Content
                        className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full md:w-[50vw] bg-white rounded-t-2xl outline-none">
                        <div className="px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
                            <div className="flex items-center justify-between mb-4">
                                <Drawer.Title
                                    className="text-[15px] font-extrabold text-[#211D17]">{title}</Drawer.Title>
                                <Drawer.Close
                                    className="text-[12.5px] font-bold text-[#B7AF9F] cursor-pointer sm:hover:text-[#8A8172] transition-colors">
                                    닫기
                                </Drawer.Close>
                            </div>
                            {children}
                        </div>
                    </Drawer.Content>
                )}
            </Drawer.Portal>
        </Drawer.Root>
    )
}
