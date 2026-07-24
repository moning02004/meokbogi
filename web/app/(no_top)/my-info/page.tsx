"use client"

import {Suspense, useEffect, useState} from "react"
import {LoadingPage} from "@/components/loading";
import {BsForkKnife} from "react-icons/bs";
import {USER_API} from "@/constants/routeUrl";
import {apiRequest} from "@/lib/api";

interface UserType {
    username: string;
    first_name: string;
    zone_count: number;
    restaurant_count: number;
    review_count: number;
    version: string;
}

export default function Page() {
    const [user, setUser] = useState<UserType | null>(null)

    useEffect(() => {
        const fetchUserInfo = async () => {
            const userRetrieveAPI = USER_API.retrieve
            await apiRequest[userRetrieveAPI.method]<UserType>(userRetrieveAPI.endpoint).then((response: UserType) => {
                setUser(response)
            })
        }

        fetchUserInfo()
    }, []);

    if (!user) return <LoadingPage/>
    return (
        <Suspense fallback={<LoadingPage/>}>
            <div className="min-h-screen pb-6">

                {/* ---- 프로필 헤더 ---- */}
                <div className="bg-white px-5 py-6 border-b border-[#E7E0CF] flex items-center gap-3.5">
                    <div
                        className="w-14 h-14 rounded-full bg-[#24564A] text-white flex items-center justify-center text-xl font-extrabold shrink-0">
                        <BsForkKnife size={22}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div
                            className="text-[17px] font-extrabold text-[#211D17] tracking-tight truncate">{user.first_name || "이름 없음"}</div>
                        <div className="text-[12.5px] text-[#8A8172] mt-0.5 truncate">{user.username}</div>
                    </div>
                    {/*<button*/}
                    {/*    className="text-[12px] font-bold text-[#24564A] border border-[#24564A] rounded-full px-3 py-1.5 shrink-0 whitespace-nowrap cursor-pointer sm:hover:bg-[#E4EEEA] transition-colors">*/}
                    {/*    프로필 수정*/}
                    {/*</button>*/}
                </div>

                {/* ---- 전체 기록 (계기판) ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">전체 기록</div>
                    <div
                        className="rounded-[20px] bg-[#17372F] px-4.5 pt-4.5 pb-4 text-[#EFF4F1] relative overflow-hidden">
                        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#B9CFC8] mb-4">
                            <BsForkKnife size={12}/>
                            지금까지의 기록
                        </div>
                        <div className="flex">
                            <div className="flex-1 text-center">
                                <div
                                    className="mx-1.5 font-mono text-[24px] font-semibold rounded-[10px] py-2 bg-white/[0.06] border border-white/[0.12]">
                                    {user.zone_count}
                                </div>
                                <p className="text-[10.5px] font-medium text-[#9FB6AE] mt-2">존</p>
                            </div>
                            <div className="flex-1 text-center">
                                <div
                                    className="mx-1.5 font-mono text-[24px] font-semibold rounded-[10px] py-2 bg-white/[0.06] border border-white/[0.12]">
                                    {user.restaurant_count}
                                </div>
                                <p className="text-[10.5px] font-medium text-[#9FB6AE] mt-2">등록한 식당</p>
                            </div>
                            <div className="flex-1 text-center">
                                <div
                                    className="mx-1.5 font-mono text-[24px] font-semibold rounded-[10px] py-2 bg-white/[0.06] border border-white/[0.12]">
                                    {user.review_count}
                                </div>
                                <p className="text-[10.5px] font-medium text-[#9FB6AE] mt-2">작성한 리뷰</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---- (추가 섹션 자리) : 즐겨찾기 / 타임라인 / 배지 등 추후 결정 ---- */}
                {/*
                <div className="px-5 pt-5">
                    <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">여기에 섹션 제목</div>
                    ...
                </div>
                */}

                {/* ---- 설정 ---- */}
                <div className="px-5 pt-5">
                    <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">설정</div>
                    <div className="bg-white border border-[#E7E0CF] rounded-2xl overflow-hidden">
                        {/*<button*/}
                        {/*    className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#F0EBDD] text-[14px] font-semibold text-[#211D17] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors">*/}
                        {/*    알림 설정*/}
                        {/*    <span className="text-[#B7AF9F]">›</span>*/}
                        {/*</button>*/}
                        {/*<button*/}
                        {/*    className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#F0EBDD] text-[14px] font-semibold text-[#211D17] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors">*/}
                        {/*    계정 정보*/}
                        {/*    <span className="text-[#B7AF9F]">›</span>*/}
                        {/*</button>*/}
                        {/*<button*/}
                        {/*    className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#F0EBDD] text-[14px] font-semibold text-[#211D17] cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors">*/}
                        {/*    문의하기*/}
                        {/*    <span className="text-[#B7AF9F]">›</span>*/}
                        {/*</button>*/}
                        <div
                            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-[#F0EBDD] text-[14px] font-semibold text-[#211D17]">
                            버전 정보
                            <span className="text-[12px] text-[#B7AF9F] font-medium">{user.version}</span>
                        </div>
                        <button
                            className="w-full text-left px-4 py-3.5 text-[14px] font-semibold text-[#C23B1E] cursor-pointer sm:hover:bg-[#FDEBE1] transition-colors">
                            로그아웃
                        </button>
                    </div>
                </div>
            </div>
        </Suspense>
    )
}