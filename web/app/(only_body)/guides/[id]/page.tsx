"use client"

import {useEffect, useState} from "react"
import {useParams, useRouter} from "next/navigation"
import {FaArrowLeft} from "react-icons/fa";
import {LuChevronDown, LuChevronUp, LuX} from "react-icons/lu";
import toast from "react-hot-toast";
import {GUIDE_PAGE, RESTAURANT_API} from "@/constants/routeUrl";
import {ApiError, apiRequest, errorMessage} from "@/lib/api";
import {
    closeGuideShare,
    deleteGuide,
    fetchGuide,
    fetchGuidePamphlet,
    GuideEntryInput,
    GuideFields,
    MAX_GUIDE_ENTRIES,
    MAX_GUIDE_MENUS,
    openGuideShare,
    saveGuideEntries,
    updateGuide,
} from "@/lib/guide";
import {GuideDetailType, GuideRestaurantType} from "@/types/guide";
import {RestaurantListItemType, RestaurantType} from "@/types/restaurant";
import {LoadingPage} from "@/components/loading";
import {ActionDrawer} from "@/components/ui/action_drawer";
import {RestaurantPicker} from "@/components/guide/restaurant_picker";
import {SpoonGradePicker} from "@/components/guide/spoon_grade";

// 화면에서 고치는 중인 "실린 집". 저장하기 전까지 서버와 다를 수 있다.
interface EntryDraft {
    restaurant: GuideRestaurantType
    branch: number | null
    comment: string
    menus: string[]
    // 음식점의 주소. 등록할 때는 안 적으니 여기서 적으면 저장할 때 음식점에 함께 저장된다.
    address: string
    // 지점을 바꾸면 주문 횟수가 달라지므로 저장해서 다시 받을 때까지 비운다
    visitCount: number | null
}

const toInput = (entry: EntryDraft): GuideEntryInput => ({
    restaurant: entry.restaurant.id, branch: entry.branch, comment: entry.comment.trim(), menus: entry.menus,
    address: entry.address.trim(),
})

// 저장한 뒤로 바뀐 게 있는지 비교하는 값
const snapshot = (fields: GuideFields, entries: EntryDraft[]) => JSON.stringify([fields, entries.map(toInput)])

const fieldClass = "w-full rounded-[14px] px-3.5 py-3 text-[14.5px] text-ink bg-fill outline-none focus:ring-2 focus:ring-strong transition-shadow placeholder:text-ink4"
const labelClass = "block text-[12.5px] font-bold text-ink3 mb-1.5"
const iconButtonClass = "w-10 h-10 flex items-center justify-center rounded-full text-ink3 cursor-pointer sm:hover:bg-fill transition-colors disabled:opacity-30 disabled:cursor-default"

function Toggle({label, hint, checked, onChange}: {
    label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void
}) {
    return (
        <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
                className="w-full flex items-center justify-between gap-3 py-2.5 text-left cursor-pointer">
            <span>
                <span className="block text-[14px] font-semibold text-ink">{label}</span>
                <span className="block text-[12px] text-ink3">{hint}</span>
            </span>
            <span className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${checked ? "bg-strong" : "bg-line-strong"}`}>
                <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`}/>
            </span>
        </button>
    )
}

// 골목 꾸미기: 제목·소개, 실린 집의 순서·한마디·권하는 메뉴, 공유
export default function Page() {
    const router = useRouter()
    const {id} = useParams<{ id: string }>()
    const guideId = Number(id)

    const [guide, setGuide] = useState<GuideDetailType | null>(null)
    const [fields, setFields] = useState<GuideFields>({
        title: "", intro: "", edition: "", grade: 0, show_address: true, show_visits: true,
    })
    const [entries, setEntries] = useState<EntryDraft[]>([])
    const [saved, setSaved] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isSharing, setIsSharing] = useState(false)
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    // 만들어 둔 팜플렛 PDF. 만들기와 보내기를 나눈 것은, 휴대폰의 공유 창은 누른 직후에만 열 수 있어서
    // 서버에서 파일을 받은 뒤에는 한 번 더 눌러야 하기 때문이다.
    const [pamphlet, setPamphlet] = useState<File | null>(null)
    const [isMakingPamphlet, setIsMakingPamphlet] = useState(false)

    const apply = (detail: GuideDetailType) => {
        const nextFields = {
            title: detail.title, intro: detail.intro, edition: detail.edition, grade: detail.grade,
            show_address: detail.show_address, show_visits: detail.show_visits,
        }
        const nextEntries = detail.entries.map((entry) => ({
            restaurant: entry.restaurant, branch: entry.branch, comment: entry.comment, menus: entry.menus,
            address: entry.restaurant.address,
            visitCount: entry.visit_count,
        }))
        setGuide(detail)
        setFields(nextFields)
        setEntries(nextEntries)
        setSaved(snapshot(nextFields, nextEntries))
        // 저장하면 내용이 달라졌으니 만들어 둔 PDF는 버린다
        setPamphlet(null)
    }

    useEffect(() => {
        let ignore = false
        fetchGuide(guideId)
            .then((detail) => {
                if (!ignore) apply(detail)
            })
            .catch((error) => {
                if (ignore) return
                toast.error(errorMessage(error, "골목을 불러오지 못했어요."))
                if (error instanceof ApiError && error.status === 404) router.replace(GUIDE_PAGE.list)
            })
        return () => {
            ignore = true
        }
    }, [guideId, router])

    if (!guide) return <LoadingPage/>

    const isDirty = snapshot(fields, entries) !== saved
    const isFull = entries.length >= MAX_GUIDE_ENTRIES
    const setField = <K extends keyof GuideFields>(key: K, value: GuideFields[K]) =>
        setFields((prev) => ({...prev, [key]: value}))
    const patchEntry = (index: number, patch: Partial<EntryDraft>) =>
        setEntries((prev) => prev.map((entry, i) => i === index ? {...entry, ...patch} : entry))

    const move = (index: number, step: -1 | 1) => setEntries((prev) => {
        const next = [...prev]
        const [entry] = next.splice(index, 1)
        next.splice(index + step, 0, entry)
        return next
    })

    const toggleMenu = (index: number, menu: string) => {
        const entry = entries[index]
        if (entry.menus.includes(menu)) {
            patchEntry(index, {menus: entry.menus.filter((name) => name !== menu)})
        } else if (entry.menus.length >= MAX_GUIDE_MENUS) {
            toast.error(`권하는 메뉴는 ${MAX_GUIDE_MENUS}개까지 고를 수 있어요.`)
        } else {
            patchEntry(index, {menus: [...entry.menus, menu]})
        }
    }

    // 고르기 시트에는 메뉴·지점이 없어서 상세를 받아서 싣는다. 한마디는 음식점 설명으로 시작한다.
    const pick = (item: RestaurantListItemType, zoneName: string) => {
        if (isFull) {
            toast.error(`한 골목에는 ${MAX_GUIDE_ENTRIES}곳까지 실을 수 있어요.`)
            return
        }
        const retrieve = RESTAURANT_API.retrieve
        apiRequest[retrieve.method]<RestaurantType>(retrieve.endpoint({restaurant: item.id}))
            .then((restaurant) => setEntries((prev) => prev.some((entry) => entry.restaurant.id === restaurant.id) ? prev : [
                ...prev,
                {
                    restaurant: {
                        id: restaurant.id,
                        name: restaurant.name,
                        zone: zoneName,
                        description: restaurant.description,
                        address: restaurant.address,
                        categories: restaurant.categories.map((category) => category.keyword),
                        branches: restaurant.branches.map(({id, name}) => ({id, name})),
                        menus: restaurant.menus,
                    },
                    branch: null,
                    comment: restaurant.description ?? "",
                    menus: [],
                    address: restaurant.address ?? "",
                    visitCount: restaurant.ordered_count,
                },
            ]))
            .catch((error) => toast.error(errorMessage(error, "음식점 정보를 불러오지 못했어요.")))
    }

    // 성공하면 true. 공유하기 전에 먼저 저장할 때도 쓴다.
    const save = async () => {
        if (isSaving) return false
        if (!fields.title.trim()) {
            toast.error("골목 이름을 적어주세요.")
            return false
        }
        setIsSaving(true)
        try {
            await updateGuide(guideId, {...fields, title: fields.title.trim(), intro: fields.intro.trim(),
                edition: fields.edition.trim()})
            apply(await saveGuideEntries(guideId, entries.map(toInput)))
            return true
        } catch (error) {
            toast.error(errorMessage(error, "저장하지 못했어요. 잠시 후 다시 시도해주세요."))
            return false
        } finally {
            setIsSaving(false)
        }
    }

    const saveAndNotify = async () => {
        if (await save()) toast.success("골목을 저장했어요.")
    }

    // 공개 화면은 저장된 내용을 보여주므로 고친 게 있으면 먼저 저장한다
    const share = async () => {
        if (isSharing) return
        setIsSharing(true)
        try {
            if (isDirty && !(await save())) return
            const detail = await openGuideShare(guideId)
            setGuide((prev) => prev && {...prev, share_token: detail.share_token})
            toast.success("링크를 만들었어요.")
        } catch (error) {
            toast.error(errorMessage(error, "링크를 만들지 못했어요."))
        } finally {
            setIsSharing(false)
        }
    }

    const unshare = () => {
        closeGuideShare(guideId)
            .then(() => {
                setGuide((prev) => prev && {...prev, share_token: null})
                toast.success("공개를 껐어요. 보낸 링크는 더 이상 열리지 않아요.")
            })
            .catch((error) => toast.error(errorMessage(error, "공개를 끄지 못했어요.")))
    }

    const remove = () => {
        deleteGuide(guideId)
            .then(() => {
                toast.success("골목을 지웠어요.")
                router.replace(GUIDE_PAGE.list)
            })
            .catch((error) => toast.error(errorMessage(error, "골목을 지우지 못했어요.")))
    }

    // PDF도 저장된 내용으로 만들어지므로 고친 게 있으면 먼저 저장한다
    const makePamphlet = async () => {
        if (isMakingPamphlet) return
        setIsMakingPamphlet(true)
        try {
            if (isDirty && !(await save())) return
            setPamphlet(await fetchGuidePamphlet(guideId, fields.title.trim()))
        } catch (error) {
            toast.error(error instanceof ApiError && error.status === 503
                ? "이 서버에는 PDF를 만드는 도구가 설치되어 있지 않아요."
                : errorMessage(error, "PDF를 만들지 못했어요."))
        } finally {
            setIsMakingPamphlet(false)
        }
    }

    const savePamphlet = (file: File) => {
        const url = URL.createObjectURL(file)
        const link = document.createElement("a")
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    const sendPamphlet = (file: File) => {
        navigator.share({files: [file], title: guide.title}).catch(() => null)
    }

    // 고친 뒤에는 예전 내용의 PDF를 내밀지 않는다
    const readyPamphlet = isDirty ? null : pamphlet
    const canSendFile = !!readyPamphlet && typeof navigator.canShare === "function"
        && navigator.canShare({files: [readyPamphlet]})

    const shareUrl = guide.share_token ? `${window.location.origin}${GUIDE_PAGE.public(guide.share_token)}` : ""

    const copyLink = () => {
        navigator.clipboard.writeText(shareUrl)
            .then(() => toast.success("링크를 복사했어요."))
            .catch(() => toast.error("복사하지 못했어요. 주소를 길게 눌러 복사해 주세요."))
    }

    // 휴대폰에서는 카톡 등으로 바로 넘기는 공유 창을 띄운다. 창을 그냥 닫은 것은 오류가 아니다.
    const sendLink = () => {
        navigator.share({title: guide.title, url: shareUrl}).catch(() => null)
    }

    return (
        <div className="min-h-[100%] flex flex-col">
            <div className="flex items-center gap-1 h-14 px-2">
                <button onClick={() => router.back()} aria-label="뒤로"
                        className="w-11 h-11 flex items-center justify-center rounded-full text-ink cursor-pointer sm:hover:bg-fill transition-colors">
                    <FaArrowLeft size={16}/>
                </button>
                <div className="flex-1 text-[17px] font-bold text-ink">골목 꾸미기</div>
                <ActionDrawer
                    triggerLabel="골목 메뉴 열기"
                    items={[{
                        label: "골목 지우기",
                        danger: true,
                        onClick: remove,
                        confirm: {
                            title: `'${guide.title}'을(를) 지울까요?`,
                            description: "보낸 링크도 함께 닫히고 되돌릴 수 없어요. 음식점과 리뷰는 그대로 남아요.",
                            confirmLabel: "지우기",
                        },
                    }]}
                />
            </div>

            <div className="flex-1 px-4 pb-4 flex flex-col gap-3">
                <div className="bg-surface rounded-3xl p-4 flex flex-col gap-3.5">
                    <div>
                        <label htmlFor="guide-title" className={labelClass}>골목 이름</label>
                        <input id="guide-title" value={fields.title} maxLength={50} autoComplete="off"
                               onChange={(e) => setField("title", e.target.value)}
                               placeholder="예: 을지로 점심 골목" className={fieldClass}/>
                    </div>
                    <div>
                        <label htmlFor="guide-intro" className={labelClass}>
                            소개 <span className="font-medium">(선택)</span>
                        </label>
                        <textarea id="guide-intro" value={fields.intro} maxLength={200} rows={3}
                                  onChange={(e) => setField("intro", e.target.value)}
                                  placeholder="어떤 집들을 골랐는지 두세 줄"
                                  className={`${fieldClass} resize-none leading-relaxed`}/>
                    </div>
                    <div>
                        <label htmlFor="guide-edition" className={labelClass}>
                            판 <span className="font-medium">(선택)</span>
                        </label>
                        <input id="guide-edition" value={fields.edition} maxLength={20} autoComplete="off"
                               onChange={(e) => setField("edition", e.target.value)}
                               placeholder="예: 2026 가을" className={fieldClass}/>
                    </div>
                    <div>
                        <div className={labelClass}>추천 등급</div>
                        <SpoonGradePicker value={fields.grade} onChange={(grade) => setField("grade", grade)}/>
                    </div>
                </div>

                <div className="flex items-center justify-between px-1 pt-2">
                    <div className="text-[13px] font-semibold text-ink3">실린 집</div>
                    <div className="text-[13px] font-semibold text-ink3 tabular-nums">{entries.length} / {MAX_GUIDE_ENTRIES}</div>
                </div>

                {entries.length === 0 && (
                    <p className="bg-surface rounded-3xl px-5 py-8 text-center text-[13.5px] text-ink3 leading-relaxed">
                        아직 실린 집이 없어요.<br/>아래에서 음식점을 골라 담아 보세요.
                    </p>
                )}

                {entries.map((entry, index) => {
                    const {restaurant} = entry
                    return (
                        <div key={restaurant.id} className="bg-surface rounded-3xl p-4 flex flex-col gap-3">
                            <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0 pt-1">
                                    <p className="font-extrabold text-[16.5px] text-ink tracking-tight truncate">{restaurant.name}</p>
                                    <p className="text-[12.5px] text-ink3 mt-0.5 truncate">
                                        {[restaurant.zone, restaurant.categories.join(" · "),
                                            entry.visitCount !== null && `${entry.visitCount}번 먹음`].filter(Boolean).join(" · ")}
                                    </p>
                                </div>
                                <button onClick={() => move(index, -1)} disabled={index === 0}
                                        aria-label={`${restaurant.name} 위로`} className={iconButtonClass}>
                                    <LuChevronUp size={18}/>
                                </button>
                                <button onClick={() => move(index, 1)} disabled={index === entries.length - 1}
                                        aria-label={`${restaurant.name} 아래로`} className={iconButtonClass}>
                                    <LuChevronDown size={18}/>
                                </button>
                                <button onClick={() => setEntries((prev) => prev.filter((_, i) => i !== index))}
                                        aria-label={`${restaurant.name} 빼기`} className={iconButtonClass}>
                                    <LuX size={17}/>
                                </button>
                            </div>

                            <div>
                                <label htmlFor={`entry-comment-${restaurant.id}`} className={labelClass}>한마디</label>
                                <input id={`entry-comment-${restaurant.id}`} value={entry.comment} maxLength={100}
                                       autoComplete="off"
                                       onChange={(e) => patchEntry(index, {comment: e.target.value})}
                                       placeholder="이 집을 왜 권하는지 한 줄" className={fieldClass}/>
                            </div>

                            <div>
                                <label htmlFor={`entry-address-${restaurant.id}`} className={labelClass}>
                                    주소 <span className="font-medium">(선택) 음식점 정보에도 저장돼요</span>
                                </label>
                                <input id={`entry-address-${restaurant.id}`} value={entry.address} maxLength={255}
                                       autoComplete="off"
                                       onChange={(e) => patchEntry(index, {address: e.target.value})}
                                       placeholder="예: 을지로12길 3" className={fieldClass}/>
                            </div>

                            {restaurant.menus.length > 0 && (
                                <div>
                                    <div className={labelClass}>
                                        권하는 메뉴 <span className="font-medium">(최대 {MAX_GUIDE_MENUS}개, 숫자는 주문한 횟수)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {restaurant.menus.map(({menu, review_count}) => {
                                            const active = entry.menus.includes(menu)
                                            return (
                                                <button key={menu} type="button" aria-pressed={active}
                                                        onClick={() => toggleMenu(index, menu)}
                                                        className={`h-9 px-3.5 rounded-full text-[13.5px] cursor-pointer transition-colors ${
                                                            active ? "bg-strong text-white font-bold" : "bg-fill text-ink2 font-semibold sm:hover:bg-fill-hover"
                                                        }`}>
                                                    {menu} <span className="tabular-nums opacity-70">{review_count}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {restaurant.branches.length > 0 && (
                                <div>
                                    <div className={labelClass}>권하는 지점</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[{id: null, name: "지점 구분 없이"}, ...restaurant.branches].map((branch) => {
                                            const active = entry.branch === branch.id
                                            return (
                                                <button key={branch.id ?? "none"} type="button" aria-pressed={active}
                                                        onClick={() => patchEntry(index, {branch: branch.id, visitCount: null})}
                                                        className={`h-9 px-3.5 rounded-full text-[13.5px] cursor-pointer transition-colors ${
                                                            active ? "bg-strong text-white font-bold" : "bg-fill text-ink2 font-semibold sm:hover:bg-fill-hover"
                                                        }`}>
                                                    {branch.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}

                <button
                    onClick={() => setIsPickerOpen(true)}
                    disabled={isFull}
                    className="w-full py-3.5 rounded-[18px] bg-surface text-ink font-bold text-[15px] cursor-pointer sm:hover:bg-fill-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isFull ? `${MAX_GUIDE_ENTRIES}곳을 모두 채웠어요` : "음식점 고르기"}
                </button>

                <div className="text-[13px] font-semibold text-ink3 px-1 pt-2">받는 사람에게 보이는 것</div>
                <div className="bg-surface rounded-3xl px-4 py-1.5">
                    <Toggle label="주문 횟수" hint="몇 번 먹었는지와 처음 주문한 달"
                            checked={fields.show_visits} onChange={(value) => setField("show_visits", value)}/>
                    <div className="border-t border-line"/>
                    <Toggle label="주소" hint="집마다 적어 둔 주소"
                            checked={fields.show_address} onChange={(value) => setField("show_address", value)}/>
                </div>
                <p className="text-[11.5px] text-ink3 px-1 leading-relaxed">
                    리뷰에 쓴 글과 만족도, 장소 이름은 어떤 경우에도 나가지 않아요.
                </p>

                <div className="text-[13px] font-semibold text-ink3 px-1 pt-2">공유</div>
                <div className="bg-surface rounded-3xl p-4 flex flex-col gap-3">
                    {guide.share_token ? (
                        <>
                            <p className="text-[13px] text-ink2 leading-relaxed">
                                이 주소를 아는 사람은 로그인 없이 볼 수 있어요. 저장한 내용이 바로 반영돼요.
                            </p>
                            <input readOnly value={shareUrl} aria-label="공개 주소"
                                   onFocus={(e) => e.target.select()}
                                   className="w-full rounded-[14px] px-3.5 py-3 text-[13px] text-ink2 bg-fill outline-none"/>
                            <div className="flex gap-2">
                                <button onClick={copyLink}
                                        className="flex-1 h-12 rounded-[16px] bg-strong text-white font-bold text-[14.5px] cursor-pointer sm:hover:bg-strong-hover transition-colors">
                                    링크 복사
                                </button>
                                {typeof navigator.share === "function" && (
                                    <button onClick={sendLink}
                                            className="flex-1 h-12 rounded-[16px] bg-fill text-ink font-bold text-[14.5px] cursor-pointer sm:hover:bg-fill-hover transition-colors">
                                        보내기
                                    </button>
                                )}
                                <a href={shareUrl} target="_blank" rel="noreferrer"
                                   className="flex-1 h-12 rounded-[16px] bg-fill text-ink font-bold text-[14.5px] flex items-center justify-center sm:hover:bg-fill-hover transition-colors">
                                    열어 보기
                                </a>
                            </div>
                            <ActionDrawer
                                trigger={
                                    <button className="self-start text-[13px] font-bold text-danger-text cursor-pointer p-2 -m-2">
                                        공개 끄기
                                    </button>
                                }
                                closeLabel={null}
                                items={[{
                                    label: "공개 끄기",
                                    danger: true,
                                    onClick: unshare,
                                    confirm: {
                                        title: "공개를 끌까요?",
                                        description: "이미 보낸 링크가 열리지 않게 돼요. 다시 공개하면 새 주소가 만들어져요.",
                                        confirmLabel: "끄기",
                                    },
                                }]}
                            />
                        </>
                    ) : (
                        <>
                            <p className="text-[13px] text-ink2 leading-relaxed">
                                지금은 나만 볼 수 있어요. 링크를 만들면 그 주소를 아는 사람이 로그인 없이 볼 수 있어요.
                            </p>
                            <button onClick={share} disabled={isSharing}
                                    className="w-full h-12 rounded-[16px] bg-strong text-white font-bold text-[14.5px] cursor-pointer sm:hover:bg-strong-hover transition-colors disabled:opacity-50">
                                {isSharing ? "만드는 중…" : isDirty ? "저장하고 링크 만들기" : "링크 만들기"}
                            </button>
                        </>
                    )}
                </div>
            </div>

                <div className="mx-4 mb-4 bg-surface rounded-3xl p-4 flex flex-col gap-3">
                    <div>
                        <p className="text-[14px] font-semibold text-ink">팜플렛 PDF</p>
                        <p className="text-[13px] text-ink2 leading-relaxed mt-0.5">
                            A4 가로 3단으로 접는 모양이에요. 공개하지 않은 골목도 만들 수 있어요.
                        </p>
                    </div>
                    {readyPamphlet ? (
                        <div className="flex gap-2">
                            {canSendFile && (
                                <button onClick={() => sendPamphlet(readyPamphlet)}
                                        className="flex-1 h-12 rounded-[16px] bg-strong text-white font-bold text-[14.5px] cursor-pointer sm:hover:bg-strong-hover transition-colors">
                                    PDF 보내기
                                </button>
                            )}
                            <button onClick={() => savePamphlet(readyPamphlet)}
                                    className={`flex-1 h-12 rounded-[16px] font-bold text-[14.5px] cursor-pointer transition-colors ${
                                        canSendFile ? "bg-fill text-ink sm:hover:bg-fill-hover" : "bg-strong text-white sm:hover:bg-strong-hover"
                                    }`}>
                                PDF 저장
                            </button>
                        </div>
                    ) : (
                        <button onClick={makePamphlet} disabled={isMakingPamphlet}
                                className="w-full h-12 rounded-[16px] bg-fill text-ink font-bold text-[14.5px] cursor-pointer sm:hover:bg-fill-hover transition-colors disabled:opacity-50">
                            {isMakingPamphlet ? "만드는 중…" : isDirty ? "저장하고 PDF 만들기" : "PDF 만들기"}
                        </button>
                    )}
                </div>

            {/* 저장 버튼은 스크롤해도 화면 아래에 붙어 있다 */}
            <div className="sticky bottom-0 bg-bg px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                <button
                    onClick={saveAndNotify}
                    disabled={isSaving || !isDirty}
                    className="w-full h-14 rounded-[18px] bg-accent text-on-accent font-bold text-[16px] cursor-pointer sm:hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? "저장 중…" : isDirty ? "저장하기" : "저장됨"}
                </button>
            </div>

            <RestaurantPicker
                open={isPickerOpen}
                onOpenChange={setIsPickerOpen}
                pickedIds={entries.map((entry) => entry.restaurant.id)}
                onPick={pick}
            />
        </div>
    )
}
