import {SectionBox} from "@/components/section";
import {useState} from "react";
import {apiRequest} from "@/lib/api";
import {useAuthStore} from "@/store/auth";
import {useRouter} from "next/navigation";
import {BsForkKnife} from "react-icons/bs";

export const LoginForm = () => {
    const router = useRouter()
    const [username, setUsername] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [errorMessage, setErrorMessage] = useState<string>("")
    const {token, setAuth} = useAuthStore.getState();

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
        if (e.key === "Enter") {
            handleLogin()
        }
    }
    return (
        <div
            className="border-t border-stone-300 w-full bg-white mx-auto px-3 py-5 mt-25 shadow-sm border-0-x sm:w-[50%] sm:rounded-2xl sm:border ">
            <div className="flex flex-row text-[1.4rem] mb-4">
                <div className="my-auto mr-2"><BsForkKnife size={22}/></div>
                <div className="my-auto">집슐랭 가이드</div>
            </div>

            <SectionBox title="아이디" className="mb-3">
                <div><input type="text"
                            className="border rounded-lg pl-2 py-2 w-full"
                            value={username}
                            onKeyUp={handleKeyup}
                            placeholder="아이디"
                            onChange={(e) => setUsername(e.target.value)}/></div>
            </SectionBox>

            <SectionBox title="비밀번호" className="mb-3">
                <div><input type="password"
                            className="border rounded-lg pl-2 py-2 w-full"
                            value={password}
                            onKeyUp={handleKeyup}
                            placeholder="********"
                            onChange={(e) => setPassword(e.target.value)}/></div>
            </SectionBox>

            <div className="mt-3">{errorMessage}</div>

            <button onClick={handleLogin}
                    className="w-full p-2 bg-stone-200 rounded mt-3 cursor-pointer hover:bg-stone-300">로그인
            </button>
        </div>
    )
}
