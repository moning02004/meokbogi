"use client"

import {createContext, TransitionStartFunction, useContext, useEffect, useMemo, useTransition} from "react"
import {useRouter} from "next/navigation"
import {hideNetworkToast, showNetworkToast} from "@/lib/api"

// 화면을 처음 열 때는 그 화면 코드를 받아오느라 한 박자 늦게 넘어간다.
// 버튼을 누른 순간부터 새 화면이 그려질 때까지 맨 위에 가는 줄을 띄워서 눌렸다는 걸 알린다.
// 화면 이동을 이 Transition 안에서 시작하면, Next가 새 화면을 그려 넣을 때까지 isPending 이 true 로 남는다.
const NavigationContext = createContext<TransitionStartFunction | null>(null)

export function NavigationProvider({children}: {children: React.ReactNode}) {
    const [isPending, startTransition] = useTransition()

    return (
        <NavigationContext.Provider value={startTransition}>
            {children}
            {isPending && (
                <div role="progressbar" aria-label="화면 여는 중"
                     className="nav-progress fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden pointer-events-none">
                    <div className="nav-progress-bar h-full bg-chart"/>
                </div>
            )}
            <NetworkWatcher/>
        </NavigationContext.Provider>
    )
}

// useRouter 대신 쓴다. push·replace 를 누르면 위의 줄이 나온다.
export function useAppRouter() {
    const router = useRouter()
    const startTransition = useContext(NavigationContext)

    return useMemo(() => {
        // 오프라인에서 화면 코드를 못 받으면 Next가 페이지를 통째로 새로 불러서 브라우저 오류 화면만 남는다.
        // 그럴 때는 지금 화면에 머물고 토스트로 알린다.
        const go = (navigate: () => void) => {
            if (!navigator.onLine) {
                showNetworkToast(Infinity)
                return
            }
            if (startTransition) startTransition(navigate)
            else navigate()
        }
        return {
            ...router,
            push: (...args: Parameters<typeof router.push>) => go(() => router.push(...args)),
            replace: (...args: Parameters<typeof router.replace>) => go(() => router.replace(...args)),
        }
    }, [router, startTransition])
}

// 기기가 오프라인이 되면 연결이 돌아올 때까지 하단 토스트를 띄워 둔다
function NetworkWatcher() {
    useEffect(() => {
        const onOffline = () => showNetworkToast(Infinity)
        const onOnline = () => hideNetworkToast()
        if (!navigator.onLine) onOffline()
        window.addEventListener("offline", onOffline)
        window.addEventListener("online", onOnline)
        return () => {
            window.removeEventListener("offline", onOffline)
            window.removeEventListener("online", onOnline)
        }
    }, [])
    return null
}
