"use client"

import {useRouter} from "next/navigation";
import {Suspense, useEffect, useState} from "react";
import {LoadingPage} from "@/components/loading";
import {LoginForm} from "@/components/auth/login_form";
import {apiRequest} from "@/lib/api";
import {CheckAccountExistenceResponse} from "@/types/auth";
import {attemptAutoLogin} from "@/lib/auth";

export default function Page() {
    const router = useRouter()
    const [userExists, setUserExists] = useState(true)
    const [isCheckingAutoLogin, setIsCheckingAutoLogin] = useState(true)

    // refresh 쿠키가 아직 살아있으면 로그인 폼을 보여주지 않고 바로 들여보낸다.
    useEffect(() => {
        attemptAutoLogin().then((success) => {
            if (success) {
                router.replace("/home")
                return
            }
            setIsCheckingAutoLogin(false)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const routeLoginOrSignup = async () => {
            await apiRequest.get<CheckAccountExistenceResponse>("/check")
                .then((response: CheckAccountExistenceResponse) => {
                    setUserExists(response.exists)
                })
        }
        routeLoginOrSignup()
    }, [])

    if (isCheckingAutoLogin) return <LoadingPage/>

    return (
        <Suspense fallback={<LoadingPage/>}>
            <div>
                <LoginForm/>
            </div>
        </Suspense>
    )
}