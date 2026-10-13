import {cache} from "react";
import type {Metadata} from "next";
import {headers} from "next/headers";
import {PublicGuide, PublicGuideInitial} from "@/components/guide/public_guide";

// 서버에서 API를 부를 주소. 컨테이너 안에서 공개 주소로 나갈 수 없으면 API_INTERNAL_HOST에 내부 주소를 넣는다.
const API_HOST = process.env.API_INTERNAL_HOST ?? process.env.NEXT_PUBLIC_API_HOST

// 공유한 링크의 미리보기(제목·소개)가 뜨도록 서버에서 먼저 읽는다.
// 서버가 API에 닿지 못해도 화면은 떠야 하므로 실패하면 null을 넘기고 브라우저가 다시 읽는다.
const loadGuide = cache(async (token: string): Promise<PublicGuideInitial> => {
    try {
        const response = await fetch(`${API_HOST}/public/guides/${encodeURIComponent(token)}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(3000),
        })
        if (response.status === 404) return "missing"
        if (!response.ok) return null
        return await response.json()
    } catch {
        return null
    }
})

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {token} = await params
    const guide = await loadGuide(token)
    const found = guide !== null && guide !== "missing"
    const title = found ? `${guide.title} · 먹골목` : "먹골목"
    // 메신저의 링크 미리보기에 뜨는 한두 줄: 몇 곳인지, 그리고 골목 소개
    const description = found
        ? [`먹어본 집 ${guide.entries.length}곳`, guide.intro.trim()].filter(Boolean).join(" · ")
        : "먹어본 집만 골라 실은 목록"

    // 미리보기 그림은 절대 주소여야 해서 지금 요청이 들어온 주소로 만든다
    const requestHeaders = await headers()
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "https"
    return {
        ...(host && {metadataBase: new URL(`${protocol}://${host}`)}),
        title,
        description,
        openGraph: {title, description, siteName: "먹보기", type: "article", images: ["/icons/icon-512.png"]},
        twitter: {card: "summary", title, description, images: ["/icons/icon-512.png"]},
        // 링크를 받은 사람만 보는 화면이라 검색에 걸리지 않게 한다
        robots: {index: false, follow: false},
    }
}

export default async function Page({params}: Props) {
    const {token} = await params
    return <PublicGuide token={token} initial={await loadGuide(token)}/>
}
