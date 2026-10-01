"use client"

import {useEffect} from "react"

// 앱 전체에서 한 번 서비스 워커를 등록한다 (웹 푸시 수신용)
export function ServiceWorkerRegistrar() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return
        navigator.serviceWorker.register("/sw.js").catch(() => null)
    }, [])
    return null
}
