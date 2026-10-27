"use client"

import {Suspense, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import {useAuthStore} from "@/store/auth"
import {LoadingPage} from "@/components/loading";
import {FaArrowLeft} from "react-icons/fa";
import {apiRequest, toastError} from "@/lib/api";
import {ZONE_API} from "@/constants/routeUrl";
import {useZoneStore} from "@/store/zone";
import {authLogout} from "@/lib/auth";
import {ZoneType} from "@/types/zone";
import {useCategoryStore} from "@/store/category";

export default function Page() {
    const router = useRouter()
    const {token} = useAuthStore.getState()
    const [zoneName, setZoneName] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const zones = useZoneStore(state => state.zones)
    const setSelectedZone = useZoneStore((state) => state.setSelectedZone)
    const setCategories = useCategoryStore(state => state.setCategories)

    useEffect(() => {
        if (!token) window.location.href = "/login"
    }, [token])

    const registerZone = () => {
        // 엔터와 버튼 클릭이 겹치거나 연타하면 같은 존이 여러 개 생기던 문제
        if (!zoneName.trim() || isSubmitting) return

        setIsSubmitting(true)
        apiRequest[ZONE_API.add.method]<ZoneType>(ZONE_API.add.endpoint, {
                body: JSON.stringify(
                    {name: zoneName.trim()}
                )
            }
        ).then((zone: ZoneType) => {
            setSelectedZone(zone)
            setCategories(zone.category)
            router.replace("/home")
        }).catch((error) => {
            toastError(error, "장소를 만들지 못했어요.")
            setIsSubmitting(false)
        })
    }

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="min-h-[100%] bg-surface flex flex-col">
                <div className="flex items-center gap-1 h-14 px-2">
                    {zones.length != 0 &&
                        <button onClick={() => router.back()} aria-label="뒤로" className="w-11 h-11 flex items-center justify-center rounded-full text-ink cursor-pointer sm:hover:bg-fill transition-colors">
                            <FaArrowLeft size={16}/>
                        </button>
                    }
                    <div className="text-[17px] font-bold text-ink">새 장소 추가</div>
                </div>

                <div className="px-5 pt-10 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-fill text-ink flex items-center justify-center mb-5">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" stroke="currentColor"
                                  strokeWidth="2" strokeLinejoin="round"/>
                            <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                    </div>

                    <div className="text-[17px] font-bold text-ink mb-1.5 text-center">
                        어디를 기록할까요?
                    </div>
                    <div className="text-[13px] text-ink3 mb-8 text-center leading-relaxed">
                        우리집, 회사, 친구집처럼<br/>기록을 나눠서 관리할 공간 이름을 정해주세요
                    </div>

                    <input
                        value={zoneName}
                        onChange={(e) => setZoneName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) registerZone()
                        }}
                        placeholder="예: 우리집, 회사, 친구집"
                        maxLength={100}
                        className="w-full text-[15px] rounded-[14px] px-4 py-3.5 mb-4 bg-fill outline-none focus:ring-2 focus:ring-strong transition-shadow"
                        autoFocus
                    />

                    <button
                        onClick={registerZone}
                        disabled={!zoneName.trim() || isSubmitting}
                        className="w-full h-14 rounded-[18px] bg-accent text-on-accent font-bold text-[16px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                        존 만들기
                    </button>

                    {zones.length == 0 &&
                        <button
                            onClick={() => authLogout()}
                            className="w-full py-3.5 rounded-xl bg-surface text-ink font-bold text-[15px] cursor-pointer mt-2 transition-colors sm:hover:bg-fill-hover"
                        >
                            로그인으로
                        </button>}
                </div>
            </div>
        </Suspense>
    )
}