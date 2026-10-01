"use client"

import {useEffect, useState} from "react"
import toast from "react-hot-toast"
import {LuBellRing, LuCopy, LuRefreshCw} from "react-icons/lu"

import {API_HOST} from "@/constants/api"
import {errorMessage} from "@/lib/api"
import {
    disablePush,
    enablePush,
    fetchPushApiKey,
    fetchPushConfig,
    getCurrentSubscription,
    getPushSupport,
    rotatePushApiKey,
    sendTestPush,
} from "@/lib/push"

const copy = (text: string, label: string) => {
    // http(비보안) 주소에서는 clipboard API가 없다
    if (!navigator.clipboard) {
        toast.error("복사하지 못했어요. 글자를 길게 눌러 복사해주세요.")
        return
    }
    navigator.clipboard.writeText(text)
        .then(() => toast.success(`${label}를 복사했어요.`))
        .catch(() => toast.error("복사하지 못했어요. 글자를 길게 눌러 복사해주세요."))
}

// 내정보 → 알림: 이 기기에서 알림 받기, 시험 알림, 외부 스케줄러(n8n)용 키
export function PushManager() {
    // 내정보 화면은 로그인 확인 뒤 브라우저에서만 그려지므로 window를 바로 읽어도 된다
    const [support] = useState(getPushSupport)
    const [enabled, setEnabled] = useState<boolean | null>(null)
    const [deviceCount, setDeviceCount] = useState<number | null>(null)
    const [busy, setBusy] = useState<"toggle" | "test" | "rotate" | null>(null)
    const [apiKey, setApiKey] = useState<string | null>(null)
    const [showKey, setShowKey] = useState(false)
    const [confirmRotate, setConfirmRotate] = useState(false)

    const refreshCount = () => fetchPushConfig().then((config) => setDeviceCount(config.device_count)).catch(() => null)

    useEffect(() => {
        fetchPushApiKey().then(({key}) => setApiKey(key)).catch(() => null)
        fetchPushConfig().then((config) => setDeviceCount(config.device_count)).catch(() => null)
        if (support !== "supported") return
        getCurrentSubscription()
            .then((subscription) => setEnabled(subscription !== null && Notification.permission === "granted"))
            .catch(() => setEnabled(false))
    }, [support])

    const toggle = () => {
        if (busy || enabled === null) return
        setBusy("toggle")
        const action = enabled ? disablePush() : enablePush()
        action
            .then(() => {
                setEnabled(!enabled)
                toast.success(enabled ? "이 기기의 알림을 껐어요." : "이 기기에서 알림을 받아요.")
                return refreshCount()
            })
            .catch((error) => toast.error(errorMessage(error, "알림을 설정하지 못했어요.")))
            .finally(() => setBusy(null))
    }

    const test = () => {
        if (busy) return
        setBusy("test")
        sendTestPush()
            .then((result) => {
                if (result.sent > 0) toast.success(`기기 ${result.sent}대로 시험 알림을 보냈어요.`)
                else if (result.failed > 0) toast.error("알림 서비스에 보내지 못했어요. 잠시 후 다시 해보세요.")
                else toast.error("알림을 받을 기기가 없어요. 먼저 알림 받기를 켜주세요.")
                return refreshCount()
            })
            .catch((error) => toast.error(errorMessage(error, "시험 알림을 보내지 못했어요.")))
            .finally(() => setBusy(null))
    }

    const rotate = () => {
        if (busy) return
        setBusy("rotate")
        rotatePushApiKey()
            .then(({key}) => {
                setApiKey(key)
                setShowKey(true)
                setConfirmRotate(false)
                toast.success("새 키를 만들었어요. n8n에 새 키로 바꿔 넣어주세요.")
            })
            .catch((error) => toast.error(errorMessage(error, "키를 만들지 못했어요.")))
            .finally(() => setBusy(null))
    }

    const sendUrl = `${API_HOST}/push/send`
    const maskedKey = apiKey ? `${apiKey.slice(0, 8)}••••••••${apiKey.slice(-4)}` : "불러오는 중…"

    return (
        <div className="flex flex-col divide-y divide-[#F0EBDD]">
            {/* ---- 이 기기에서 알림 받기 ---- */}
            <div className="px-4 py-3.5 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <LuBellRing size={17} className="shrink-0 text-[#24564A]"/>
                    <span className="flex-1 min-w-0">
                        <span id="push-toggle-label" className="block text-[14px] font-semibold text-[#211D17]">이 기기에서 알림 받기</span>
                        <span className="block text-[12px] text-[#8A8172]">
                            {deviceCount === null ? "" : `알림 받는 기기 ${deviceCount}대`}
                        </span>
                    </span>
                    {support === "supported" && (
                        <button
                            role="switch"
                            aria-checked={!!enabled}
                            aria-labelledby="push-toggle-label"
                            onClick={toggle}
                            disabled={enabled === null || busy !== null}
                            className={`shrink-0 relative w-12 h-7 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                                enabled ? "bg-[#24564A]" : "bg-[#D6D2CC]"
                            }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                                enabled ? "translate-x-5" : ""
                            }`}/>
                        </button>
                    )}
                </div>
                {support === "ios-needs-install" && (
                    <p className="text-[12.5px] text-[#8A6A5C] bg-[#FDF6F1] border border-[#F6C9B2] rounded-lg px-3 py-2 leading-relaxed">
                        iPhone은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요. Safari 공유 버튼 →
                        &ldquo;홈 화면에 추가&rdquo;로 설치한 뒤, 그 앱의 내정보에서 켜주세요.
                    </p>
                )}
                {support === "unsupported" && (
                    <p className="text-[12.5px] text-[#8A8172]">이 브라우저는 웹 알림을 지원하지 않아요.</p>
                )}
                {enabled && (
                    <button
                        onClick={test}
                        disabled={busy !== null}
                        className="self-start text-[12.5px] font-bold text-[#24564A] bg-[#E4EEEA] rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-50"
                    >
                        {busy === "test" ? "보내는 중…" : "시험 알림 보내기"}
                    </button>
                )}
            </div>

            {/* ---- 외부 스케줄러(n8n)용 키 ---- */}
            <div className="px-4 py-3.5 flex flex-col gap-2.5">
                <div>
                    <div className="text-[14px] font-semibold text-[#211D17]">자동 알림 키</div>
                    <p className="text-[12px] text-[#8A8172] leading-relaxed">
                        n8n 같은 스케줄러가 이 키로 알림을 보내면, 알림 받기를 켠 내 기기들로 와요.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <code aria-label="자동 알림 키"
                          className="flex-1 min-w-0 truncate select-all text-[12.5px] font-mono text-[#211D17] bg-[#FBFAF6] border border-[#E7E0CF] rounded-lg px-3 py-2">
                        {showKey && apiKey ? apiKey : maskedKey}
                    </code>
                    <button onClick={() => setShowKey((prev) => !prev)} disabled={!apiKey}
                            className="shrink-0 text-[12px] font-bold text-[#8A8172] px-2 py-2 cursor-pointer">
                        {showKey ? "숨기기" : "보기"}
                    </button>
                    <button onClick={() => apiKey && copy(apiKey, "키")} disabled={!apiKey} aria-label="키 복사"
                            className="shrink-0 p-2 rounded-lg text-[#24564A] cursor-pointer sm:hover:bg-[#E4EEEA]">
                        <LuCopy size={16}/>
                    </button>
                </div>

                {confirmRotate ? (
                    <div className="rounded-lg border border-[#F1C8B7] bg-[#FDEBE1] px-3 py-2.5 flex flex-col gap-2">
                        <p className="text-[12.5px] text-[#8A6A5C] leading-relaxed">
                            새 키를 만들면 지금 키는 바로 못 쓰게 돼요. n8n에도 새 키를 넣어야 해요.
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmRotate(false)}
                                    className="flex-1 text-[12.5px] font-bold text-[#5B5548] bg-white border border-[#E7E0CF] rounded-lg py-2 cursor-pointer">
                                취소
                            </button>
                            <button onClick={rotate} disabled={busy !== null}
                                    className="flex-1 text-[12.5px] font-bold text-white bg-[#C23B1E] rounded-lg py-2 cursor-pointer disabled:opacity-50">
                                {busy === "rotate" ? "만드는 중…" : "새 키 만들기"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setConfirmRotate(true)}
                            className="self-start inline-flex items-center gap-1.5 text-[12px] font-bold text-[#8A8172] cursor-pointer">
                        <LuRefreshCw size={13}/> 새 키 만들기
                    </button>
                )}

                <details className="text-[12.5px] text-[#5B5548]">
                    <summary className="cursor-pointer font-bold text-[#24564A] py-1">n8n에서 쓰는 법</summary>
                    <ol className="list-decimal pl-5 flex flex-col gap-1.5 mt-1.5 leading-relaxed">
                        <li><b>Schedule Trigger</b>: Cron <code className="font-mono">0 15,20 * * *</code>, 시간대 Asia/Seoul</li>
                        <li><b>HTTP Request</b>: POST
                            <button onClick={() => copy(sendUrl, "주소")}
                                    className="ml-1 font-mono text-[12px] text-[#24564A] underline underline-offset-2 break-all text-left cursor-pointer">
                                {sendUrl}
                            </button>
                        </li>
                        <li>Header <code className="font-mono">Authorization: Bearer 위의 키</code></li>
                        <li>Body(JSON) <code className="font-mono break-all">{`{"title": "점심 뭐 드셨어요?", "content": "먹은 메뉴를 남겨 두세요"}`}</code>
                        </li>
                    </ol>
                </details>
            </div>
        </div>
    )
}
