"use client"

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {useAppRouter} from "@/components/navigation_progress";
import { menuItems } from "@/constants/menus";

export function Bottombar() {
    const router = useAppRouter();
    const pathname = usePathname();

    // 탭을 누르고 나서야 그 화면 코드를 받으면 휴대폰에서 한 박자 늦게 넘어간다. 미리 받아 둔다.
    useEffect(() => {
        menuItems.forEach((item) => router.prefetch(item.path));
    }, [router]);

    return (
        <div className="shrink-0 grid grid-cols-5 items-center px-2 h-[68px] bg-surface border-t border-line">
            {menuItems.map((item) => {
                const isActive = pathname === item.path;

                // 가운데 + 버튼
                if (item.floating) {
                    return (
                        <button
                            key={item.name}
                            onClick={() => router.push(item.path)}
                            aria-label={item.name}
                            className="justify-self-center flex items-center justify-center
                                       w-12 h-12 rounded-[18px]
                                       bg-accent text-on-accent
                                       transition-transform duration-150
                                       active:scale-90 sm:hover:bg-accent-hover cursor-pointer"
                        >
                            <item.icon size={20} />
                        </button>
                    );
                }

                return (
                    <button
                        key={item.name}
                        onClick={() => router.push(item.path)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex flex-col items-center justify-center gap-1 h-14
                                    transition-colors duration-150 cursor-pointer
                                    ${isActive ? "text-ink" : "text-ink3 sm:hover:text-ink"}`}
                    >
                        <item.icon size={22} />
                        <span className={`text-[11px] ${isActive ? "font-bold" : "font-semibold"}`}>{item.name}</span>
                    </button>
                );
            })}
        </div>
    );
}
