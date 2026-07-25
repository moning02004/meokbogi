"use client"

import { usePathname, useRouter } from "next/navigation";
import { menuItems } from "@/constants/menus";

export function Bottombar() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <div className="flex items-center justify-around px-2 bg-white border-t border-[#E7E0CF] h-[8vh]">
            {menuItems.map((item) => {
                const isActive = pathname === item.path;

                // 가운데 + 버튼
                if (item.floating) {
                    return (
                        <button
                            key={item.name}
                            onClick={() => router.push(item.path)}
                            className="flex items-center justify-center
                                       -translate-y-4
                                       w-13 h-13 rounded-full
                                       bg-[#D2571E] text-white
                                       shadow-lg shadow-[#D2571E]/30
                                       transition-transform duration-150
                                       active:scale-90 sm:hover:bg-[#b84a19] cursor-pointer"
                        >
                            <item.icon size={22} strokeWidth={2.5} />
                        </button>
                    );
                }

                return (
                    <button
                        key={item.name}
                        onClick={() => router.push(item.path)}
                        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full
                                    transition-colors duration-150 cursor-pointer
                                    ${isActive ? "text-[#24564A]" : "text-[#B7AF9F] hover:text-[#24564A]"}`}
                    >
                        <item.icon size={22} />
                        <span className="text-[10px] font-semibold">{item.name}</span>
                    </button>
                );
            })}
        </div>
    );
}