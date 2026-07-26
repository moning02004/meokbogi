import {apiRequest, refreshAccessToken} from "@/lib/api";
import {useAuthStore} from "@/store/auth";
import Cookies from "js-cookie";

export const authLogout = async () => {
    const {logout} = useAuthStore.getState();

    await apiRequest.delete("/auth/token").catch(() => null);
    logout()
    window.location.replace("/login")
}

// 자동로그인: httpOnly refreshtoken 쿠키가 브라우저에 남아있으면(만료 전이면) 그걸로 access 토큰을 새로 받아온다.
// 쿠키는 JS에서 읽을 수 없으므로 존재 여부를 미리 확인하지 않고, 그냥 refresh를 시도해서
// 서버 응답(성공/401)으로만 판단한다.
export const attemptAutoLogin = async (): Promise<boolean> => {
    if (Cookies.get("refreshtoken")) {
        const result = await refreshAccessToken()
        return result !== null
    }
    return false
}
