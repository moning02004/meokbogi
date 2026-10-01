import {useAuthStore} from "@/store/auth";
import {API_HOST} from "@/constants/api";
import {AuthTokenResponse} from "@/types/auth";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type RequestExtraOptions = {
    isMime?: boolean,
    isDownloadFile?: boolean
}

// 여러 요청이 동시에 401을 맞거나(React StrictMode의 effect 이중 실행 포함) 자동로그인 시도와 겹쳐도
// refresh 네트워크 호출은 한 번만 나가도록 진행 중인 요청을 공유한다.
let refreshPromise: Promise<AuthTokenResponse | null> | null = null;

const postRefresh = () => fetch(`${API_HOST}/auth/refresh-token`, {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type": "application/json"},
})

export function refreshAccessToken(): Promise<AuthTokenResponse | null> {
    if (!refreshPromise) {
        refreshPromise = postRefresh()
            .then(async (res) => {
                // 서버는 쓰고 난 refresh 토큰을 바로 무효화한다. 탭 두 개가 같은 쿠키로 동시에 재발급하면
                // 늦은 쪽이 401을 받는데, 그 사이 먼저 끝난 탭이 새 쿠키를 심어 두었으므로 한 번만 다시 시도한다.
                if (res.status === 401) {
                    await new Promise((resolve) => setTimeout(resolve, 600));
                    res = await postRefresh();
                }
                if (!res.ok) return null;
                const data: AuthTokenResponse = await res.json();
                useAuthStore.getState().setAuth(data.access_token, data.user_id);
                return data;
            })
            .catch(() => null)
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

function forceLogout() {
    useAuthStore.getState().logout();
    window.location.replace("/login");
}

// 서버가 준 에러 메시지를 화면까지 전달하기 위한 에러 타입.
// DRF는 {"detail": "..."} 또는 {"field": ["..."]} 모양으로 내려준다.
export class ApiError extends Error {
    status: number;
    body: unknown;

    constructor(status: number, message: string, body: unknown = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

// catch 블록에서 받은 값을 사용자에게 보여줄 문장으로 바꾼다
export const errorMessage = (error: unknown, fallback = "요청을 처리하지 못했어요.") =>
    error instanceof Error && error.message ? error.message : fallback;

function extractErrorMessage(status: number, body: unknown): string {
    if (status >= 500) return "서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.";
    if (status === 429) return "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
    // Django의 404 detail은 "No Restaurant matches the given query." 같은 영어라 쓰지 않는다
    if (status === 404) return "찾을 수 없어요. 이미 삭제되었을 수 있어요.";
    if (body && typeof body === "object") {
        const first = (body as Record<string, unknown>).detail ?? Object.values(body)[0];
        const message = Array.isArray(first) ? first[0] : first;
        if (typeof message === "string" && message) return message;
    }
    return "요청을 처리하지 못했어요.";
}

// 로그인·토큰 재발급 요청은 401이 "아이디/비밀번호 틀림"이라는 뜻이므로
// refresh를 시도하거나 강제 로그아웃(페이지 새로고침)하면 안 된다.
const isAuthEndpoint = (endPoint: string) => endPoint.startsWith("/auth/");

async function request<T = unknown>(endPoint: string,
                                    method: HttpMethod,
                                    options: RequestInit = {},
                                    extraOptions: RequestExtraOptions = {
                                        isMime: false,
                                        isDownloadFile: false
                                    }): Promise<T> {
    const {token} = useAuthStore.getState();

    const headers = {
        ...(options.headers || {}),
        ...(token && {Authorization: `Bearer ${token}`}),
        ...(!extraOptions.isMime && {"Content-Type": "application/json"}),
    };

    const send = () => fetch(`${API_HOST}${endPoint}`, {
        ...options,
        method,
        headers,
        credentials: "include",
    }).catch(() => {
        throw new ApiError(0, "네트워크 연결을 확인해주세요.");
    });

    let res = await send();

    if (res.status === 401 && !isAuthEndpoint(endPoint)) {
        const refreshed = await refreshAccessToken();

        if (refreshed) {
            headers.Authorization = `Bearer ${refreshed.access_token}`;
            res = await send();
        } else {
            forceLogout();
            throw new ApiError(401, "세션이 만료되었습니다. 다시 로그인해주세요.");
        }
    }

    // 4xx뿐 아니라 5xx도 실패로 처리한다. 예전에는 500이면 null을 돌려줘서 화면이 조용히 깨졌다.
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, extractErrorMessage(res.status, body), body);
    }

    if (!extraOptions.isDownloadFile) return await res.json().catch(() => null) as T
    return res as T;
}

export const apiRequest = {
    get: <T = unknown>(endPoint: string, options?: RequestInit, extraOptions?: RequestExtraOptions) => request<T>(endPoint, "GET", options, extraOptions),
    post: <T = unknown>(endPoint: string, options?: RequestInit, extraOptions?: RequestExtraOptions) => request<T>(endPoint, "POST", options, extraOptions),
    patch: <T = unknown>(endPoint: string, options?: RequestInit, extraOptions?: RequestExtraOptions) => request<T>(endPoint, "PATCH", options, extraOptions),
    delete: <T = unknown>(endPoint: string, options?: RequestInit, extraOptions?: RequestExtraOptions) => request<T>(endPoint, "DELETE", options, extraOptions),
};
