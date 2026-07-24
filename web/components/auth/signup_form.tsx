import {SectionBox} from "@/components/section";
import {useState} from "react";
import {apiRequest} from "@/lib/api";
import {useAuthStore} from "@/store/auth";
import { useRouter } from "next/navigation";

export const SignupForm = () => {
    const router = useRouter()
    const [username, setUsername] = useState<string>("")
    const [password1, setPassword1] = useState<string>("")
    const [password2, setPassword2] = useState<string>("")
    const [name, setName] = useState<string>("")
    const [zone, setZone] = useState<string>("")

    const [errorMessage, setErrorMessage] = useState<string>("")

    const handleSignup = async () => {
        if (!username || !password1 || !password2 || !name || !zone) {
            setErrorMessage("모두 입력하세요.")
            return;
        }
        if (password1 !== password2) {
            setErrorMessage("비밀번호를 확인해주세요.")
            return;
        }

        await apiRequest.post("/users",
            {body: JSON.stringify({
                    username: username,
                    password1: password1,
                    password2: password2,
                    name: name,
                    zone: zone,
            })}
        ).then(() => {
            router.replace("/")
        }).catch(() => {
            setErrorMessage("서버를 확인해주세요.")
        })
    }

    return (
        <div
            className="w-full bg-white mx-auto px-3 py-5 mt-25 shadow-sm border-0-x sm:w-[50%] sm:rounded-2xl sm:border ">
            <div className="text-[1.4rem] mb-4">집슐랭 가이드</div>

            <SectionBox title="아이디">
                <div><input type="text"
                            className="border rounded-lg pl-2 py-2 w-full"
                            value={username}
                            placeholder="아이디"
                            onChange={(e) => setUsername(e.target.value)}/></div>
            </SectionBox>

            <SectionBox title="비밀번호">
                <div><input type="password"
                            className="border rounded-lg pl-2 py-2 w-full"
                            value={password1}
                            placeholder="********"
                            onChange={(e) => setPassword1(e.target.value)}/></div>
            </SectionBox>

            <SectionBox title="비밀번호 확인">
                <div><input type="password"
                            className="border rounded-lg pl-2 py-2 w-full"
                            value={password2}
                            placeholder="********"
                            onChange={(e) => setPassword2(e.target.value)}/></div>
            </SectionBox>

            <SectionBox title="이름">
                <div><input type="text"
                            className="border rounded-lg pl-2 py-2 w-full"
                            value={name}
                            placeholder="********"
                            onChange={(e) => setName(e.target.value)}/></div>
            </SectionBox>

            <SectionBox title="장소" isLast={true}>
                <div><input type="text"
                            className="border rounded-lg pl-2 py-2 w-full"
                            value={zone}
                            placeholder="********"
                            onChange={(e) => setZone(e.target.value)}/></div>
            </SectionBox>

            <div className="mt-3">{errorMessage}</div>

            <button onClick={handleSignup}
                    className="w-full p-2 bg-stone-200 rounded mt-3 cursor-pointer hover:bg-stone-300">로그인
            </button>
        </div>
    )
}
