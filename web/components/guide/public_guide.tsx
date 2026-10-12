"use client"

import {useEffect, useState} from "react"
import {API_HOST} from "@/constants/api";
import {mapSearchUrl} from "@/lib/guide";
import {PublicGuideType} from "@/types/guide";

// 서버에서 읽었으면 그 내용, 주소가 틀렸으면 "missing", 서버가 API에 닿지 못했으면 null (브라우저에서 다시 읽는다)
export type PublicGuideInitial = PublicGuideType | "missing" | null

// "2024-11" → "2024.11"
const monthLabel = (month: string) => month.replace("-", ".")

// 받는 사람이 로그인 없이 보는 골목. 색은 앱과 같은 토큰을 쓰고 기기의 다크 모드를 따른다.
export function PublicGuide({token, initial}: { token: string; initial: PublicGuideInitial }) {
    const [guide, setGuide] = useState<PublicGuideInitial>(initial)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (initial !== null) return
        // 로그인 정보를 싣지 않는다 (apiRequest를 쓰면 401에서 로그인 화면으로 보내 버린다)
        fetch(`${API_HOST}/public/guides/${encodeURIComponent(token)}`)
            .then(async (res) => {
                if (res.status === 404) setGuide("missing")
                else if (!res.ok) setFailed(true)
                else setGuide(await res.json())
            })
            .catch(() => setFailed(true))
    }, [initial, token])

    if (guide === null || guide === "missing") {
        return (
            <main className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center bg-bg">
                <p className="text-[17px] font-extrabold text-ink tracking-tight">
                    {guide === "missing" ? "열 수 없는 골목이에요" : failed ? "골목을 불러오지 못했어요" : "골목을 여는 중이에요"}
                </p>
                <p className="text-[13.5px] text-ink3 leading-relaxed">
                    {guide === "missing"
                        ? "주소가 바뀌었거나 주인이 공개를 껐어요."
                        : failed ? "잠시 후 다시 열어 주세요." : "잠시만 기다려 주세요."}
                </p>
            </main>
        )
    }

    return (
        <main className="w-full max-w-[560px] mx-auto px-4 pt-6 pb-10 flex flex-col gap-3">
            <header className="px-1 flex flex-col gap-2 pb-2">
                <div className="flex items-center justify-between text-[12.5px] font-bold text-ink3">
                    <span><span className="text-accent-text">먹골목</span>{guide.edition && ` · ${guide.edition}`}</span>
                    <span>{guide.entries.length}곳</span>
                </div>
                <h1 className="text-[28px] leading-[1.2] font-extrabold tracking-tight text-ink break-keep">{guide.title}</h1>
                {guide.intro && (
                    <p className="text-[15px] text-ink2 leading-relaxed whitespace-pre-line">{guide.intro}</p>
                )}
            </header>

            {guide.entries.length === 0 && (
                <p className="bg-surface rounded-3xl px-5 py-8 text-center text-[13.5px] text-ink3">
                    아직 실린 집이 없어요.
                </p>
            )}

            {guide.entries.map((entry, index) => (
                <article key={index} className="bg-surface rounded-3xl px-5 py-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            {entry.categories.length > 0 && (
                                <p className="text-[12.5px] font-semibold text-ink3">{entry.categories.join(" · ")}</p>
                            )}
                            <h2 className="text-[19px] font-extrabold tracking-tight text-ink break-keep">
                                {entry.name}
                                {entry.branch && <span className="ml-1.5 text-[14px] font-bold text-ink2">{entry.branch}</span>}
                            </h2>
                        </div>
                        {!!entry.visit_count && (
                            <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-accent-text bg-accent-soft px-2.5 py-1 rounded-full">
                                {entry.visit_count}번 먹음
                            </span>
                        )}
                    </div>

                    {entry.comment && <p className="text-[15px] text-ink leading-relaxed">{entry.comment}</p>}

                    {entry.menus.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5" aria-label="권하는 메뉴">
                            {entry.menus.map((menu) => (
                                <li key={menu} className="text-[13px] font-semibold text-ink2 bg-fill px-2.5 py-1 rounded-full">
                                    {menu}
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 mt-1 text-[12.5px] text-ink3">
                        <span className="min-w-0">
                            {entry.address}
                            {entry.address && entry.first_ordered_month && " · "}
                            {entry.first_ordered_month && `첫 주문 ${monthLabel(entry.first_ordered_month)}`}
                        </span>
                        <a href={mapSearchUrl(entry.name, entry.branch, entry.address)} target="_blank" rel="noreferrer"
                           className="shrink-0 font-bold text-ink2 underline underline-offset-2 p-2 -m-2">
                            지도에서 찾기
                        </a>
                    </div>
                </article>
            ))}

            <p className="text-center text-[12px] text-ink3 pt-3">먹어본 집만 실었습니다 · 먹보기</p>
        </main>
    )
}
