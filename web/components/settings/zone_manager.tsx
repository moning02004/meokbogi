"use client"

import {useCallback, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import toast from "react-hot-toast"
import {LuChevronRight, LuPlus} from "react-icons/lu"

import {CategoryManager} from "@/components/settings/category_manager"
import {Modal} from "@/components/ui/modal"
import {ZONE_API, ZONE_PAGE} from "@/constants/routeUrl"
import {apiRequest, errorMessage} from "@/lib/api"
import {syncZones} from "@/lib/zone"
import {fetchZoneRestaurants} from "@/lib/restaurant"
import {ManagedCategoryType, ZoneType} from "@/types/zone"

// 마이페이지에서는 존 목록만 보여주고, 실제 관리(카테고리 추가·삭제, 존 삭제)는 모달 안에서 한다.
export function ZoneManager() {
    const router = useRouter()

    const [zones, setZones] = useState<ZoneType[] | null>(null)
    const [selected, setSelected] = useState<ZoneType | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    // 같은 존을 다시 열었을 때도 모달 안의 목록을 새로 읽도록 여는 횟수를 key에 섞는다
    const [openSeq, setOpenSeq] = useState(0)
    // 모달 안에서 카테고리를 건드렸으면 닫을 때 존 목록(과 전역 상태)을 다시 읽는다
    const [isDirty, setIsDirty] = useState(false)

    // 상단바·카테고리 선택이 지워진 존/카테고리를 계속 들고 있지 않도록 전역 상태도 함께 맞춘다
    const loadZones = useCallback(() => {
        return syncZones().then((rows) => {
            setZones(rows)
            return rows
        })
    }, [])

    useEffect(() => {
        loadZones()
    }, [loadZones])

    const openZone = (zone: ZoneType) => {
        setSelected(zone)
        setOpenSeq((seq) => seq + 1)
        setIsOpen(true)
    }

    const closeModal = () => {
        // selected는 닫히는 애니메이션 동안 내용이 사라지지 않도록 그대로 둔다
        setIsOpen(false)
        if (isDirty) {
            setIsDirty(false)
            loadZones()
        }
    }

    const renameZone = (zone: ZoneType, name: string) => {
        const update = ZONE_API.update
        return apiRequest[update.method]<ZoneType>(update.endpoint({zone: zone.id}), {
            body: JSON.stringify({name})
        }).then((updated) => {
            // 모달 제목과 목록, 상단바가 바로 새 이름을 보여주도록 맞춘다
            setSelected((prev) => prev && prev.id === zone.id ? {...prev, name: updated.name} : prev)
            toast.success("장소 이름을 바꿨어요.")
            return loadZones()
        }).then(() => undefined).catch((error) => {
            toast.error(errorMessage(error, "이름을 바꾸지 못했어요."))
        })
    }

    const deleteZone = (zone: ZoneType) => {
        const remove = ZONE_API.delete
        return apiRequest[remove.method](remove.endpoint({zone: zone.id}))
            .then(() => {
                toast.success(`'${zone.name}'을(를) 삭제했어요.`)
                setIsOpen(false)
                setIsDirty(false)
                return loadZones()
            })
            .then((rows) => {
                // 존이 하나도 없으면 앱에서 할 수 있는 게 없으므로 바로 생성 화면으로 보낸다
                if (rows.length === 0) router.replace(ZONE_PAGE.add)
            })
            .catch((error) => {
                toast.error(errorMessage(error, "존을 삭제하지 못했어요. 잠시 후 다시 시도해주세요."))
            })
    }

    return (
        <>
            {zones === null ? (
                <div className="flex flex-col divide-y divide-[#F0EBDD]">
                    {[0, 1].map((row) => (
                        <div key={row} className="px-4 py-4">
                            <div className="h-[16px] w-28 rounded bg-[#F1EDE2] animate-pulse"/>
                        </div>
                    ))}
                </div>
            ) : (
                <ul className="flex flex-col divide-y divide-[#F0EBDD]">
                    {zones.map((zone) => (
                        <li key={zone.id}>
                            <button
                                onClick={() => openZone(zone)}
                                className="w-full flex items-center gap-2 px-4 py-3.5 text-left cursor-pointer sm:hover:bg-[#F6F3EC] transition-colors"
                            >
                                <span className="flex-1 min-w-0">
                                    <span
                                        className="block text-[14px] font-bold text-[#211D17] truncate">{zone.name}</span>
                                    <span className="block text-[12px] text-[#8A8172] mt-0.5">
                                        카테고리 {zone.category.length}개
                                    </span>
                                </span>
                                <LuChevronRight size={16} className="shrink-0 text-[#B7AF9F]"/>
                            </button>
                        </li>
                    ))}

                    <li>
                        <button
                            onClick={() => router.push(ZONE_PAGE.add)}
                            className="w-full flex items-center gap-1.5 px-4 py-3.5 text-[13.5px] font-bold text-[#D2571E] cursor-pointer sm:hover:bg-[#FDEBE1] transition-colors"
                        >
                            <LuPlus size={15}/>
                            장소 추가
                        </button>
                    </li>
                </ul>
            )}

            <Modal
                fullScreen
                title={selected?.name ?? ""}
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) closeModal()
                }}
            >
                {selected && (
                    <ZoneDetail
                        key={`${selected.id}:${openSeq}`}
                        zone={selected}
                        onCategoriesMutated={() => setIsDirty(true)}
                        onRename={renameZone}
                        onDelete={deleteZone}
                    />
                )}
            </Modal>
        </>
    )
}

interface ZoneDetailProps {
    zone: ZoneType
    onCategoriesMutated: () => void
    onRename: (zone: ZoneType, name: string) => Promise<void>
    onDelete: (zone: ZoneType) => Promise<void>
}

function ZoneDetail({zone, onCategoriesMutated, onRename, onDelete}: ZoneDetailProps) {
    const [categories, setCategories] = useState<ManagedCategoryType[] | null>(null)
    const [nameInput, setNameInput] = useState(zone.name)
    const [isRenaming, setIsRenaming] = useState(false)
    const trimmedName = nameInput.trim()
    const canRename = trimmedName !== "" && trimmedName !== zone.name && !isRenaming

    const rename = () => {
        if (!canRename) return
        setIsRenaming(true)
        onRename(zone, trimmedName).finally(() => setIsRenaming(false))
    }
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // 존을 지우면 음식점·리뷰까지 함께 사라지므로, 무엇이 사라지는지 숫자로 보여준다.
    // 음식점에 카테고리가 여러 개 붙을 수 있어 카테고리별 수를 더하면 겹치므로 장소의 음식점 수를 따로 읽는다.
    const [restaurantCount, setRestaurantCount] = useState<number | null>(null)
    useEffect(() => {
        fetchZoneRestaurants(zone.id).then((response) => setRestaurantCount(response.count)).catch(() => null)
    }, [zone.id])

    return (
        <div className="flex flex-col gap-5">
            <section>
                <label htmlFor="zone-name"
                       className="block text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">
                    장소 이름
                </label>
                <div className="flex gap-2">
                    <input
                        id="zone-name"
                        value={nameInput}
                        onChange={(event) => setNameInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.nativeEvent.isComposing) rename()
                        }}
                        maxLength={100}
                        className="flex-1 min-w-0 text-[13.5px] text-[#211D17] border border-[#E7E0CF] rounded-lg px-3 py-2.5 outline-none focus:border-[#24564A] transition-colors"
                    />
                    <button
                        onClick={rename}
                        disabled={!canRename}
                        className="shrink-0 text-[13px] font-bold text-white bg-[#24564A] rounded-lg px-3.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed sm:hover:bg-[#1c443a] transition-colors"
                    >
                        {isRenaming ? "저장 중…" : "저장"}
                    </button>
                </div>
            </section>

            <section className="border-t border-[#F0EBDD] pt-4">
                <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">
                    카테고리
                </div>
                <CategoryManager
                    zoneId={zone.id}
                    onCategoriesChange={(rows, mutated) => {
                        setCategories(rows)
                        if (mutated) onCategoriesMutated()
                    }}
                />
            </section>

            <section className="border-t border-[#F0EBDD] pt-4">
                <div className="text-[11px] font-bold tracking-[0.1em] text-[#B7AF9F] uppercase mb-2.5">
                    존 삭제
                </div>

                {isConfirmingDelete ? (
                    <div className="rounded-xl border border-[#F1C8B7] bg-[#FDEBE1] px-3.5 py-3">
                        <p className="text-[13px] font-extrabold text-[#C23B1E] mb-1">
                            &lsquo;{zone.name}&rsquo;을(를) 삭제할까요?
                        </p>
                        <p className="text-[12px] text-[#8A6A5C] leading-relaxed mb-3">
                            카테고리 {categories?.length ?? 0}개와 음식점 {restaurantCount ?? "…"}개,
                            그동안 남긴 리뷰가 모두 함께 사라져요. 되돌릴 수 없어요.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsConfirmingDelete(false)}
                                disabled={isDeleting}
                                className="flex-1 text-[13px] font-bold text-[#5B5548] bg-white border border-[#E7E0CF] rounded-lg py-2.5 cursor-pointer disabled:opacity-40 sm:hover:bg-[#F6F3EC] transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    setIsDeleting(true)
                                    onDelete(zone).finally(() => setIsDeleting(false))
                                }}
                                disabled={isDeleting}
                                className="flex-1 text-[13px] font-bold text-white bg-[#C23B1E] rounded-lg py-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed sm:hover:bg-[#a63118] transition-colors"
                            >
                                {isDeleting ? "삭제 중…" : "삭제"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsConfirmingDelete(true)}
                        className="w-full text-[13.5px] font-bold text-[#C23B1E] border border-[#F1C8B7] rounded-lg py-3 cursor-pointer sm:hover:bg-[#FDEBE1] transition-colors"
                    >
                        이 존 삭제하기
                    </button>
                )}
            </section>
        </div>
    )
}
