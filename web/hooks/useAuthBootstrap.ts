"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useAuthStore} from "@/store/auth";
import {attemptAutoLogin} from "@/lib/auth";

// 인증이 필요한 레이아웃들이 공용으로 쓰는 훅.
// 메모리(zustand, sessionStorage)에 토큰이 없으면 자동로그인(refresh 쿠키)을 한 번 시도하고,
// 그래도 없으면 로그인 페이지로 보낸다.
export function useAuthBootstrap() {
    const router = useRouter()
    const token = useAuthStore((state) => state.token)
    // 이미 메모리에 토큰이 있으면(예: 같은 탭에서 재렌더) 처음부터 부트스트랩을 건너뛴다.
    const [isBootstrapping, setIsBootstrapping] = useState(() => !token)

    useEffect(() => {
        if (token) return
        attemptAutoLogin().finally(() => setIsBootstrapping(false))
    }, [])

    useEffect(() => {
        if (!isBootstrapping && !token) router.replace("/login")
    }, [isBootstrapping, token, router])

    return {isReady: !isBootstrapping && !!token}
}
