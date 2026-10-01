import {apiRequest} from "@/lib/api";
import {PUSH_API} from "@/constants/routeUrl";

export type PushSupport = "supported" | "unsupported" | "ios-needs-install"

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true

// iOS는 16.4부터 "홈 화면에 추가"한 앱에서만 웹 푸시를 받을 수 있다
export function getPushSupport(): PushSupport {
    if (typeof window === "undefined") return "unsupported"
    if (isIOS() && !isStandalone()) return "ios-needs-install"
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return "unsupported"
    }
    return "supported"
}

// 서버가 준 base64url 공개키 → 브라우저 subscribe()가 받는 바이트 배열
function decodeKey(base64url: string) {
    const base64 = (base64url + "=".repeat((4 - base64url.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

// 등록이 아직 안 됐으면(첫 방문 직후 등) 여기서 등록한다. ready만 기다리면 등록 전에는 영원히 기다린다.
async function getRegistration() {
    const existing = await navigator.serviceWorker.getRegistration("/")
    if (!existing) await navigator.serviceWorker.register("/sw.js")
    return navigator.serviceWorker.ready
}

export async function getCurrentSubscription() {
    const registration = await getRegistration()
    return registration.pushManager.getSubscription()
}

export const fetchPushConfig = () =>
    apiRequest[PUSH_API.config.method]<{ public_key: string; device_count: number }>(PUSH_API.config.endpoint)

// 이 기기에서 알림 받기. 알림 권한을 묻는 창은 버튼을 누른 직후에만 띄울 수 있다 (iOS).
export async function enablePush() {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
        throw new Error(permission === "denied"
            ? "알림이 차단되어 있어요. 브라우저(또는 휴대폰) 설정에서 먹보기 알림을 허용해주세요."
            : "알림을 허용해야 받을 수 있어요.")
    }

    const {public_key} = await fetchPushConfig()
    const registration = await getRegistration()
    let subscription = await registration.pushManager.getSubscription()
    // 서버 키가 바뀌었으면 예전 구독으로는 받을 수 없으므로 새로 만든다
    const currentKey = subscription?.options.applicationServerKey
    if (subscription && currentKey && !sameKey(new Uint8Array(currentKey), decodeKey(public_key))) {
        await subscription.unsubscribe()
        subscription = null
    }
    subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(public_key),
    })

    await apiRequest[PUSH_API.subscribe.method](PUSH_API.subscribe.endpoint, {
        body: JSON.stringify(subscription.toJSON()),
    })
}

const sameKey = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((value, i) => value === b[i])

export async function disablePush() {
    const subscription = await getCurrentSubscription()
    if (!subscription) return
    await apiRequest[PUSH_API.unsubscribe.method](PUSH_API.unsubscribe.endpoint, {
        body: JSON.stringify({endpoint: subscription.endpoint}),
    }).catch(() => null)
    await subscription.unsubscribe()
}

export const sendTestPush = () =>
    apiRequest[PUSH_API.test.method]<{ sent: number; removed: number; failed: number }>(PUSH_API.test.endpoint)
