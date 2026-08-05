"use client"

import {Suspense, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {FaArrowLeft} from "react-icons/fa";
import {apiRequest} from "@/lib/api";
import {ZONE_API} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {ZoneType} from "@/types/zone";

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()
    const [zoneName, setZoneName] = useState<string>("")
    const {setZones, setSelectedZone} = useZoneStore.getState();

    useEffect(() => {
        apiRequest[ZONE_API.list.method]<{ results: ZoneType[] }>(ZONE_API.list.endpoint)
            .then((response: { results: ZoneType[] }) => {
                if (response.results) {
                    setZones(response.results.sort((a, b) =>
                        b.id - a.id
                    ))
                    setSelectedZone(response.results[0])
                }
            })
    }, []);

    useEffect(() => {
        if (!token) window.location.href = "/login"
    }, [token])

    const registerZone = () => {
        if (!zoneName.trim()) return

        apiRequest[ZONE_API.add.method]<{ id: number }>(ZONE_API.add.endpoint, {
                body: JSON.stringify(
                    {name: zoneName}
                )
            }
        ).then(() => {
            router.replace("/home")
        })
    }

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="h-[100%] flex flex-col">
                <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-[#E7E0CF]">
                    <button onClick={() => router.back()} className="text-[#211D17] cursor-pointer">
                        <FaArrowLeft size={16}/>
                    </button>
                    <div className="text-[15px] font-bold text-[#211D17]">새 장소 추가</div>
                </div>

                <div className="px-5 pt-10 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-[#E4EEEA] flex items-center justify-center mb-5">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" stroke="#24564A"
                                  strokeWidth="2" strokeLinejoin="round"/>
                            <circle cx="12" cy="9.5" r="2.4" stroke="#24564A" strokeWidth="2"/>
                        </svg>
                    </div>

                    <div className="text-[17px] font-bold text-[#211D17] mb-1.5 text-center">
                        어디를 기록할까요?
                    </div>
                    <div className="text-[13px] text-[#8A8172] mb-8 text-center leading-relaxed">
                        우리집, 회사, 친구집처럼<br/>기록을 나눠서 관리할 공간 이름을 정해주세요
                    </div>

                    <input
                        value={zoneName}
                        onChange={(e) => setZoneName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) registerZone()
                        }}
                        placeholder="예: 우리집, 회사, 친구집"
                        className="w-full text-[15px] border border-[#E7E0CF] rounded-xl px-4 py-3.5 mb-4 outline-none focus:border-[#24564A] transition-colors"
                        autoFocus
                    />

                    <button
                        onClick={registerZone}
                        disabled={!zoneName.trim()}
                        className="w-full py-3.5 rounded-xl bg-[#D2571E] text-white font-bold text-[15px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                        존 만들기
                    </button>
                </div>
            </div>
        </Suspense>
    )
}