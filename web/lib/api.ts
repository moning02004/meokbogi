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

export function refreshAccessToken(): Promise<AuthTokenResponse | null> {
    if (!refreshPromise) {
        refreshPromise = fetch(`${API_HOST}/auth/refresh-token`, {
            method: "POST",
            credentials: "include",
            headers: {"Content-Type": "application/json"},
        })
            .then(async (res) => {
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

    let res = await fetch(`${API_HOST}${endPoint}`, {
        ...options,
        method,
        headers,
        credentials: "include",
    });

    if (res.status === 401) {
        const refreshed = await refreshAccessToken();

        if (refreshed) {
            headers.Authorization = `Bearer ${refreshed.access_token}`;
            res = await fetch(`${API_HOST}${endPoint}`, {
                ...options,
                method,
                headers,
                credentials: "include",
            });
        } else {
            forceLogout();
            throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
        }
    } else if (res.status.toString().startsWith("4")) {
        throw new Error("에러가 발생했습니다.")
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
