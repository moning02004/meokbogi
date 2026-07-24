"use client"

import {LuEllipsisVertical} from "react-icons/lu"
import {Drawer} from "vaul"

interface ActionDrawerItem {
    label: string
    onClick?: () => void
    danger?: boolean
}

interface ActionDrawerProps {
    /** 기본값: 케밥(⋮) 아이콘 트리거 */
    trigger?: React.ReactNode
    items: ActionDrawerItem[]
    closeLabel?: string | null
    extraButton?: React.ReactNode
}

export function ActionDrawer({trigger, items, closeLabel = "취소", extraButton}: ActionDrawerProps) {
    return (
        <Drawer.Root>
            <Drawer.Trigger asChild>
                {trigger ?? (
                    <div className="drawer-button">
                        <button className="drawer-menu">
                            <LuEllipsisVertical size={22}/>
                        </button>
                    </div>
                )}
            </Drawer.Trigger>

            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40"/>

                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full md:w-[50vw] bg-white">
                    <div className="flex flex-col p-4">
                        {items.map((item, i) => (
                            <Drawer.Close asChild key={i}>
                                <button
                                    onClick={item.onClick}
                                    className={`w-full p-3 text-left hover:bg-[#efefef] cursor-pointer rounded border-b border-[#ededed] ${
                                        item.danger ? "text-red-600" : ""
                                    }`}
                                >
                                    {item.label}
                                </button>
                            </Drawer.Close>
                        ))}
                        {closeLabel &&
                            <Drawer.Close className="w-full p-3 hover:bg-[#efefef] rounded cursor-pointer text-left">
                                {closeLabel}
                            </Drawer.Close>
                        }
                        {extraButton}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
