import {cache} from "react";
import type {Metadata} from "next";
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
    const description = found && guide.intro ? guide.intro : "먹어본 집만 골라 실은 목록"
    return {
        title,
        description,
        openGraph: {title, description},
        // 링크를 받은 사람만 보는 화면이라 검색에 걸리지 않게 한다
        robots: {index: false, follow: false},
    }
}

export default async function Page({params}: Props) {
    const {token} = await params
    return <PublicGuide token={token} initial={await loadGuide(token)}/>
}
