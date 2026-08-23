"use client"

import {useSyncExternalStore} from "react"

// navigator는 서버에 없으므로 SSR 스냅샷은 false를 주고 클라이언트에서만 실제 값을 읽는다.
// useEffect + setState로 하면 하이드레이션 직후 한 번 더 렌더링된다.
const subscribe = () => () => {}
const getIsIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
const getIsIOSOnServer = () => false

export function InstallAppSection() {
    const isIOS = useSyncExternalStore(subscribe, getIsIOS, getIsIOSOnServer)

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
