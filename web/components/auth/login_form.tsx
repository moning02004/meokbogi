import {useState} from "react";
import {apiRequest} from "@/lib/api";
import {useAuthStore} from "@/store/auth";
import {useRouter} from "next/navigation";

export const LoginForm = () => {
    const router = useRouter()
    const [username, setUsername] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [errorMessage, setErrorMessage] = useState<string>("")
    const {setAuth} = useAuthStore.getState();

    const handleLogin = async () => {
        if (!username || !password) {
            setErrorMessage("아이디와 비밀번호를 모두 입력하세요.")
            return;
        }

        await apiRequest.post<{ access_token: string, user_id: string }>("/auth/obtain-token",
            {body: JSON.stringify({username: username, password: password})}
        ).then((response: { access_token: string, user_id: string }) => {
            setAuth(response.access_token, response.user_id)
            router.push("/home")
        }).catch(() => {
            setErrorMessage("계정을 찾을 수 없습니다.")
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
                    placeholder="아이디를 입력하세요"
                    className="w-full text-[15px] border border-[#E7E0CF] rounded-xl px-4 py-3 bg-[#FBFAF6] text-[#211D17] outline-none focus:border-[#24564A] transition-colors placeholder:text-[#C4BCA8]"
                />

                <label className="block text-[12px] font-bold text-[#8A8172] mb-1.5 mt-4">비밀번호</label>
                <input
                    type="password"
                    value={password}
                    onKeyUp={handleKeyup}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-[15px] border border-[#E7E0CF] rounded-xl px-4 py-3 bg-[#FBFAF6] text-[#211D17] outline-none focus:border-[#24564A] transition-colors placeholder:text-[#C4BCA8]"
                />

                {errorMessage && (
                    <div className="mt-3 text-[12.5px] text-[#C23B1E] font-semibold">{errorMessage}</div>
                )}

                <button
                    onClick={handleLogin}
                    className="w-full mt-6 py-3.5 rounded-xl bg-[#D2571E] text-white font-extrabold text-[15px] cursor-pointer sm:hover:bg-[#b84a19] active:scale-[0.99] transition-all"
                >
                    로그인
                </button>
            </div>
        </div>
    )
}