"use client"

import {Drawer} from "vaul"

interface ModalProps {
    trigger?: React.ReactNode
    title: string
    children: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function Modal({trigger, title, children, open, onOpenChange}: ModalProps) {
    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}

            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>

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
            </Drawer.Portal>
        </Drawer.Root>
    )
}
