"use client"

import {useState} from "react"

// 저장된 지점은 id와 리뷰 수가 있고, 등록 화면에서 아직 저장 전인 지점은 이름만 있다
export interface BranchItem {
    id?: number
    name: string
    review_count?: number
}

interface BranchManagerProps<T extends BranchItem> {
    branches: T[]
    onCreate: (name: string) => Promise<unknown>
    onRemove: (branch: T) => Promise<unknown>
}

// 음식점 등록·수정 화면의 지점 목록. 추가와 지우기 (지우면 그 지점 리뷰는 남고 지점만 비워진다).
export function BranchManager<T extends BranchItem>({branches, onCreate, onRemove}: BranchManagerProps<T>) {
    const [name, setName] = useState("")
    const [confirming, setConfirming] = useState<T | null>(null)
    const [busy, setBusy] = useState(false)

    const add = () => {
        if (!name.trim() || busy) return
        setBusy(true)
        onCreate(name.trim())
            .then(() => setName(""))
            .catch(() => null)
            .finally(() => setBusy(false))
    }

    const remove = (branch: T) => {
        if (busy) return
        setBusy(true)
        onRemove(branch)
            .then(() => setConfirming(null))
            .catch(() => null)
            .finally(() => setBusy(false))
    }

    return (
        <div className="flex flex-col gap-2">
            {branches.length > 0 && (
                <ul className="flex flex-col divide-y divide-[#F0EBDD] border border-[#E7E0CF] rounded-lg overflow-hidden">
                    {branches.map((branch) => (
                        <li key={branch.id ?? branch.name} className="flex items-center gap-2 px-3 py-2 bg-white">
                            <span className="flex-1 min-w-0 truncate text-[13.5px] font-semibold text-[#211D17]">{branch.name}</span>
                            {branch.review_count !== undefined && (
                                <span className="shrink-0 text-[11.5px] text-[#B7AF9F] font-semibold">리뷰 {branch.review_count}</span>
                            )}
                            {confirming === branch ? (
                                <>
                                    <button type="button" onClick={() => setConfirming(null)}
                                            className="shrink-0 text-[12px] font-bold text-[#8A8172] px-1.5 py-1 cursor-pointer">취소</button>
                                    <button type="button" onClick={() => remove(branch)} disabled={busy}
                                            className="shrink-0 text-[12px] font-bold text-white bg-[#C23B1E] rounded-md px-2 py-1 cursor-pointer disabled:opacity-50">
                                        지우기
                                    </button>
                                </>
                            ) : (
                                // 리뷰가 달린 지점만 한 번 더 묻는다
                                <button type="button" onClick={() => branch.review_count ? setConfirming(branch) : remove(branch)}
                                        aria-label={`${branch.name} 지점 지우기`}
                                        className="shrink-0 text-[12px] font-bold text-[#C23B1E] px-1.5 py-1 cursor-pointer">지우기</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {confirming !== null && (
                <p className="text-[11.5px] text-[#8A6A5C]">지워도 그 지점 리뷰는 남고, &ldquo;지점 없음&rdquo;으로 바뀌어요.</p>
            )}
            <div className="flex items-center gap-2">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            add()
                        }
                    }}
                    maxLength={100}
                    placeholder="예: 역삼점"
                    aria-label="추가할 지점 이름"
                    className="flex-1 min-w-0 text-[14px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2 outline-none focus:border-[#24564A] placeholder:text-[#B7AF9F]"
                />
                <button type="button" onClick={add} disabled={!name.trim() || busy}
                        className="shrink-0 text-[13px] font-bold text-white bg-[#24564A] rounded-lg px-3 py-2 cursor-pointer disabled:opacity-40">
                    지점 추가
                </button>
            </div>
        </div>
    )
}
