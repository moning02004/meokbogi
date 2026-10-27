"use client"

import {useEffect, useId, useRef, useState} from "react"
import {LuCheck, LuChevronDown} from "react-icons/lu"

interface DropdownOption<T extends string> {
    value: T
    label: string
}

interface DropdownProps<T extends string> {
    value: T
    options: DropdownOption<T>[]
    onChange: (value: T) => void
    /** 스크린리더용 이름 */
    label: string
}

// <select> 대신 쓰는 드롭다운. 기본 select 는 기기마다 모양이 달라서 화면 토큰으로 직접 그린다.
// 키보드: 위·아래로 옮기고 Enter·Space 로 고르고 Esc 로 닫는다.
export function Dropdown<T extends string>({value, options, onChange, label}: DropdownProps<T>) {
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const listId = useId()

    const current = options.find((option) => option.value === value)

    const openList = () => {
        setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)))
        setOpen(true)
    }

    const close = (focusTrigger = true) => {
        setOpen(false)
        if (focusTrigger) triggerRef.current?.focus()
    }

    const choose = (next: T) => {
        if (next !== value) onChange(next)
        close()
    }

    // 바깥을 누르면 닫는다
    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) close(false)
        }
        document.addEventListener("pointerdown", onPointerDown)
        return () => document.removeEventListener("pointerdown", onPointerDown)
    }, [open])

    useEffect(() => {
        if (open) listRef.current?.focus()
    }, [open])

    const onTriggerKeyDown = (event: React.KeyboardEvent) => {
        if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault()
            openList()
        }
    }

    const onListKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((i) => Math.min(options.length - 1, i + 1))
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((i) => Math.max(0, i - 1))
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            choose(options[activeIndex].value)
        } else if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") event.preventDefault()
            close(event.key === "Escape")
        }
    }

    return (
        <div ref={rootRef} className="relative">
            <div
                ref={triggerRef}
                role="combobox"
                tabIndex={0}
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => open ? close() : openList()}
                onKeyDown={onTriggerKeyDown}
                className="flex items-center gap-1 h-9 pl-2 pr-1.5 rounded-lg text-[13px] font-semibold text-ink2 cursor-pointer select-none outline-none sm:hover:bg-fill-hover focus-visible:ring-2 focus-visible:ring-strong transition-colors"
            >
                {current?.label}
                <LuChevronDown size={14} className={`text-ink3 transition-transform ${open ? "rotate-180" : ""}`}/>
            </div>

            {open && (
                <div
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    tabIndex={-1}
                    aria-label={label}
                    aria-activedescendant={`${listId}-${activeIndex}`}
                    onKeyDown={onListKeyDown}
                    className="absolute right-0 top-full mt-1 z-30 min-w-[148px] p-1.5 rounded-2xl bg-surface border border-line shadow-lg outline-none"
                >
                    {options.map((option, i) => {
                        const selected = option.value === value
                        return (
                            <div
                                key={option.value}
                                id={`${listId}-${i}`}
                                role="option"
                                aria-selected={selected}
                                onClick={() => choose(option.value)}
                                onPointerEnter={() => setActiveIndex(i)}
                                className={`flex items-center justify-between gap-3 h-10 px-3 rounded-xl text-[14px] cursor-pointer select-none ${
                                    selected ? "font-bold text-ink" : "font-semibold text-ink2"
                                } ${i === activeIndex ? "bg-fill" : ""}`}
                            >
                                {option.label}
                                {selected && <LuCheck size={15} className="shrink-0 text-ink"/>}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
