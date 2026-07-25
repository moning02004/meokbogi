"use client"

import {useEffect, useState} from "react"

export function InstallAppSection() {
    const [isIOS, setIsIOS] = useState(false)

    useEffect(() => {
        setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent))
    }, [])

    return (
        <div className="mx-5 mb-8 bg-[#FBFAF6] border border-[#E7E0CF] rounded-2xl px-5 py-5">
            <div className="text-[14.5px] font-extrabold text-[#211D17] mb-1.5">앱처럼 설치해서 써보세요</div>
            <p className="text-[12.5px] text-[#8A8172] font-medium leading-relaxed mb-3.5">
                모바일에서 홈 화면에 추가하면 브라우저 주소창 없이 앱처럼 바로 열려요.
            </p>
            <div className="text-[12.5px] text-[#5B5548] font-semibold leading-relaxed bg-white border border-[#E7E0CF] rounded-xl px-3.5 py-3">
                {isIOS ? (
                    <>
                        공유 버튼<span className="mx-1">⬆️</span>을 누른 뒤{" "}
                        <span className="text-[#24564A] font-extrabold">&ldquo;홈 화면에 추가&rdquo;</span>를 선택해주세요.
                    </>
                ) : (
                    <>
                        브라우저 메뉴(⋮)를 누른 뒤{" "}
                        <span className="text-[#24564A] font-extrabold">&ldquo;홈 화면에 추가&rdquo;</span> 또는{" "}
                        <span className="text-[#24564A] font-extrabold">&ldquo;앱 설치&rdquo;</span>를 선택해주세요.
                    </>
                )}
            </div>
        </div>
    )
}
