import {useState} from "react";
import {ApiError, apiRequest} from "@/lib/api";
import {useAuthStore} from "@/store/auth";
import {useRouter} from "next/navigation";

export const LoginForm = () => {
    const router = useRouter()
    const [username, setUsername] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [errorMessage, setErrorMessage] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const {setAuth} = useAuthStore.getState();

    const handleLogin = async () => {
        if (isSubmitting) return
        if (!username || !password) {
            setErrorMessage("아이디와 비밀번호를 모두 입력하세요.")
            return;
        }

        setIsSubmitting(true)

        await apiRequest.post<{ access_token: string, user_id: string }>("/auth/obtain-token",
            {body: JSON.stringify({username: username, password: password})}
        ).then((response: { access_token: string, user_id: string }) => {
            setAuth(response.access_token, response.user_id)
            router.push("/home")
        }).catch((error) => {
            // 401만 "계정 정보 틀림"이고, 429(시도 과다)·네트워크 오류는 서버가 준 메시지를 그대로 보여준다
            setErrorMessage(error instanceof ApiError && error.status === 401
                ? "아이디 또는 비밀번호가 올바르지 않아요."
                : (error as Error).message)
            setIsSubmitting(false)
        })
    }

    const handleKeyup = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            handleLogin()
        }
    }

    return (
        <div className="w-full sm:w-[420px] mx-auto bg-white sm:rounded-3xl sm:border sm:border-[#E7E0CF] sm:shadow-sm overflow-hidden">

            {/* 상단 브랜드 */}
            <div className="flex flex-col items-center justify-center px-6 pt-12 pb-7">
                <div className="w-[60px] h-[60px] rounded-full bg-[#E0603A] flex items-center justify-center mb-4">
                    <svg width="29" height="29" viewBox="0 0 120 120">
                        <g transform="translate(60,60)" fill="#fff">
                            <path d="M-22 -28 L-19 -28 L-19 -12 L-17 -8 L-17 28 L-21 28 L-21 -8 L-23 -12 L-23 -28 Z"/>
                            <rect x="-18.5" y="-28" width="2.6" height="15"/>
                            <rect x="-14.5" y="-28" width="2.6" height="15"/>
                            <path d="M13 -28 Q22 -24 22 -12 Q22 -3 15 1 L15 28 L10 28 L10 1 Q6 -1 6 -8 Q6 -20 13 -28 Z"/>
                        </g>
                    </svg>
                </div>
                <div className="text-[23px] font-extrabold text-[#211D17] tracking-tight mb-1">먹보기</div>
                <div className="text-[13px] text-[#B7AF9F] font-semibold">먹어보고 기록하고</div>
            </div>

            {/* 폼 */}
            <div className="px-6 pb-10">
                <label className="block text-[12px] font-bold text-[#8A8172] mb-1.5">아이디</label>
                <input
                    type="text"
                    value={username}
                    onKeyUp={handleKeyup}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="아이디를 입력하세요"
                    className="w-full text-[15px] border border-[#E7E0CF] rounded-xl px-4 py-3 bg-[#FBFAF6] text-[#211D17] outline-none focus:border-[#24564A] transition-colors placeholder:text-[#C4BCA8]"
                />

                <label className="block text-[12px] font-bold text-[#8A8172] mb-1.5 mt-4">비밀번호</label>
                <input
                    type="password"
                    value={password}
                    onKeyUp={handleKeyup}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full text-[15px] border border-[#E7E0CF] rounded-xl px-4 py-3 bg-[#FBFAF6] text-[#211D17] outline-none focus:border-[#24564A] transition-colors placeholder:text-[#C4BCA8]"
                />

                {errorMessage && (
                    <div className="mt-3 text-[12.5px] text-[#C23B1E] font-semibold">{errorMessage}</div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={isSubmitting}
                    className="w-full mt-6 py-3.5 rounded-xl bg-[#D2571E] text-white font-extrabold text-[15px] cursor-pointer sm:hover:bg-[#b84a19] active:scale-[0.99] transition-all disabled:opacity-60"
                >
                    {isSubmitting ? "로그인 중…" : "로그인"}
                </button>
            </div>
        </div>
    )
}