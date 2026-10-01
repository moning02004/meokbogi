"use client"

import {useRef, useState} from "react"
import toast from "react-hot-toast"
import {LuDownload, LuUpload} from "react-icons/lu"

import {Modal} from "@/components/ui/modal"
import {errorMessage} from "@/lib/api"
import {downloadArchive, importArchive, ImportSummary} from "@/lib/archive"

interface ArchiveManagerProps {
    // 가져오기가 끝나면 부모가 존 목록·통계를 다시 읽는다
    onImported: () => void
}

// 내 기록 내보내기(JSON·CSV)와 가져오기(JSON).
// 가져오기는 먼저 서버에서 미리 계산해(dry run) 무엇이 늘어나는지 보여준 뒤 확인을 받는다.
export function ArchiveManager({onImported}: ArchiveManagerProps) {
    const fileRef = useRef<HTMLInputElement | null>(null)
    const [busy, setBusy] = useState<"json" | "csv" | "preview" | "import" | null>(null)
    const [pending, setPending] = useState<{ file: File; preview: ImportSummary } | null>(null)

    const download = (type: "json" | "csv") => {
        if (busy) return
        setBusy(type)
        downloadArchive(type)
            .catch((error) => toast.error(errorMessage(error, "내보내지 못했어요.")))
            .finally(() => setBusy(null))
    }

    const pickFile = (file: File | undefined) => {
        // 같은 파일을 다시 골라도 change가 일어나도록 비운다
        if (fileRef.current) fileRef.current.value = ""
        if (!file) return
        setBusy("preview")
        importArchive(file, true)
            .then((preview) => setPending({file, preview}))
            .catch((error) => toast.error(errorMessage(error, "파일을 확인하지 못했어요.")))
            .finally(() => setBusy(null))
    }

    const confirmImport = () => {
        if (!pending || busy) return
        setBusy("import")
        importArchive(pending.file, false)
            .then((result) => {
                setPending(null)
                toast.success(result.reviews_created || result.restaurants_created
                    ? `음식점 ${result.restaurants_created}곳, 리뷰 ${result.reviews_created}개를 가져왔어요.`
                    : "새로 가져올 기록이 없었어요.")
                onImported()
            })
            .catch((error) => toast.error(errorMessage(error, "가져오지 못했어요.")))
            .finally(() => setBusy(null))
    }

    const preview = pending?.preview
    const nothingNew = preview && !preview.zones_created && !preview.categories_created
        && !preview.restaurants_created && !preview.reviews_created

    return (
        <>
            <div className="flex flex-col divide-y divide-[#F0EBDD]">
                <button
                    onClick={() => download("json")}
                    disabled={busy !== null}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors disabled:opacity-50"
                >
                    <LuDownload size={17} className="shrink-0 text-[#24564A]"/>
                    <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-[#211D17]">
                            {busy === "json" ? "만드는 중…" : "백업 파일로 내보내기"}
                        </span>
                        <span className="block text-[12px] text-[#8A8172]">JSON · 다시 가져올 수 있어요</span>
                    </span>
                </button>
                <button
                    onClick={() => download("csv")}
                    disabled={busy !== null}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors disabled:opacity-50"
                >
                    <LuDownload size={17} className="shrink-0 text-[#24564A]"/>
                    <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-[#211D17]">
                            {busy === "csv" ? "만드는 중…" : "엑셀용으로 내보내기"}
                        </span>
                        <span className="block text-[12px] text-[#8A8172]">CSV · 리뷰 한 건이 한 줄</span>
                    </span>
                </button>
                <button
                    onClick={() => fileRef.current?.click()}
                    disabled={busy !== null}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors disabled:opacity-50"
                >
                    <LuUpload size={17} className="shrink-0 text-[#D2571E]"/>
                    <span className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-[#211D17]">
                            {busy === "preview" ? "파일 확인 중…" : "백업 파일 가져오기"}
                        </span>
                        <span className="block text-[12px] text-[#8A8172]">지금 기록에 합쳐요. 지워지는 건 없어요</span>
                    </span>
                </button>
            </div>
            <input
                ref={fileRef}
                id="archive-file"
                type="file"
                accept="application/json,.json"
                aria-label="가져올 백업 파일"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
            />

            <Modal
                title="백업 파일 가져오기"
                open={pending !== null}
                onOpenChange={(open) => {
                    if (!open && busy !== "import") setPending(null)
                }}
            >
                {preview && (
                    <div className="flex flex-col gap-3">
                        <p className="text-[12.5px] text-[#8A8172] truncate">{pending?.file.name}</p>
                        {nothingNew ? (
                            <p className="text-[13.5px] text-[#5B5548] leading-relaxed">
                                이 파일의 기록은 이미 모두 있어요. 가져와도 바뀌는 게 없어요.
                            </p>
                        ) : (
                            <dl className="grid grid-cols-2 gap-2">
                                {[
                                    ["새 장소", preview.zones_created],
                                    ["새 카테고리", preview.categories_created],
                                    ["새 음식점", preview.restaurants_created],
                                    ["새 리뷰", preview.reviews_created],
                                ].map(([label, value]) => (
                                    <div key={label} className="bg-[#FBFAF6] border border-[#E7E0CF] rounded-xl px-3 py-2.5">
                                        <dt className="text-[11.5px] font-semibold text-[#8A8172]">{label}</dt>
                                        <dd className="text-[18px] font-bold text-[#211D17] tabular-nums">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                        {(preview.restaurants_matched > 0 || preview.reviews_skipped > 0) && (
                            <p className="text-[12px] text-[#8A8172] leading-relaxed">
                                이미 있는 음식점 {preview.restaurants_matched}곳은 그대로 두고 리뷰만 합쳐요.
                                똑같은 리뷰 {preview.reviews_skipped}개는 건너뛰어요.
                            </p>
                        )}
                        <button
                            onClick={confirmImport}
                            disabled={busy === "import" || !!nothingNew}
                            className="w-full text-[13.5px] font-bold text-white bg-[#24564A] rounded-lg py-3 mt-1 cursor-pointer sm:hover:bg-[#1c443a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {busy === "import" ? "가져오는 중…" : "가져오기"}
                        </button>
                    </div>
                )}
            </Modal>
        </>
    )
}
