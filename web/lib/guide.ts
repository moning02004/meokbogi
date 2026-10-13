import {apiRequest} from "@/lib/api";
import {GUIDE_API} from "@/constants/routeUrl";
import {GuideDetailType, GuideType} from "@/types/guide";

// 서버와 같은 한도 (apps/guide/models.py)
export const MAX_GUIDE_ENTRIES = 15
export const MAX_GUIDE_MENUS = 3

// 추천 등급: 숟가락 0~3개. 뜻은 서버(apps/guide/models.py의 GRADE_LABELS)와 같게 둔다.
export type GuideGrade = 0 | 1 | 2 | 3
export const GUIDE_GRADE_LABELS: Record<Exclude<GuideGrade, 0>, string> = {
    1: "근처에 가면 들러 볼 만한 골목",
    2: "일부러 찾아갈 만한 골목",
    3: "이 골목 때문에 그 동네에 갈 만한 골목",
}

// 팜플렛 PDF의 모양. 서버(apps/guide/models.py의 PAMPHLET_LAYOUTS)와 같게 둔다.
export type PamphletLayout = "menu" | "booklet" | "list" | "receipt"
export const PAMPHLET_LAYOUTS: { value: PamphletLayout; label: string; hint: string }[] = [
    {value: "menu", label: "차림표", hint: "A4 가로. 한 장에 여섯 집을 한 줄씩 적어요."},
    {value: "booklet", label: "세로 책자", hint: "A4 세로. 첫 장은 표지, 다음 장부터 한 장에 여섯 칸(가로 2, 세로 3)으로 실어요."},
    {value: "list", label: "한 장 목록", hint: "A4 세로 한 장에 모두. 한마디 없이 이름·주소·대표 메뉴만 적어요."},
    {value: "receipt", label: "영수증", hint: "A4 가로. 영수증 두 장에 세 집씩, 주문 횟수를 수량처럼 적어요."},
]

export interface GuideFields {
    title: string;
    intro: string;
    edition: string;
    grade: GuideGrade;
    pamphlet_layout: PamphletLayout;
    show_address: boolean;
    show_visits: boolean;
}

export interface GuideEntryInput {
    restaurant: number;
    branch: number | null;
    comment: string;
    menus: string[];
    // 보내면 음식점의 주소를 고친다. 빼면 그대로 둔다.
    address?: string;
}

export const fetchGuides = () => apiRequest[GUIDE_API.list.method]<GuideType[]>(GUIDE_API.list.endpoint)

export const createGuide = (title: string, grade: GuideGrade) =>
    apiRequest[GUIDE_API.add.method]<GuideType>(GUIDE_API.add.endpoint, {body: JSON.stringify({title, grade})})

export const fetchGuide = (guide: number) =>
    apiRequest[GUIDE_API.retrieve.method]<GuideDetailType>(GUIDE_API.retrieve.endpoint({guide}))

export const updateGuide = (guide: number, fields: Partial<GuideFields>) =>
    apiRequest[GUIDE_API.update.method]<GuideDetailType>(GUIDE_API.update.endpoint({guide}), {
        body: JSON.stringify(fields),
    })

// 보낸 순서가 곧 실리는 순서
export const saveGuideEntries = (guide: number, entries: GuideEntryInput[]) =>
    apiRequest[GUIDE_API.entries.method]<GuideDetailType>(GUIDE_API.entries.endpoint({guide}), {
        body: JSON.stringify({entries}),
    })

export const deleteGuide = (guide: number) =>
    apiRequest[GUIDE_API.delete.method](GUIDE_API.delete.endpoint({guide}))

export const openGuideShare = (guide: number) =>
    apiRequest[GUIDE_API.share.method]<GuideDetailType>(GUIDE_API.share.endpoint({guide}))

export const closeGuideShare = (guide: number) =>
    apiRequest[GUIDE_API.unshare.method]<GuideDetailType>(GUIDE_API.unshare.endpoint({guide}))

// 서버가 만든 팜플렛 PDF를 파일로 받는다 (인증 헤더가 필요해서 링크로는 못 받는다)
export const fetchGuidePamphlet = async (guide: number, title: string) => {
    const response = await apiRequest[GUIDE_API.pdf.method]<Response>(
        GUIDE_API.pdf.endpoint({guide}), {}, {isDownloadFile: true})
    return new File([await response.blob()], `${title}.pdf`, {type: "application/pdf"})
}

// 골목 끝에 음식점 하나를 싣는다 (음식점 상세의 "골목에 담기"). 이미 실려 있으면 "exists".
// 한마디는 비워 둔다. 꾸미기 화면에서 직접 쓴다.
export const addRestaurantToGuide = async (guide: number, restaurant: number) => {
    const detail = await fetchGuide(guide)
    if (detail.entries.some((entry) => entry.restaurant.id === restaurant)) return "exists" as const
    await saveGuideEntries(guide, [
        ...detail.entries.map((entry) => ({
            restaurant: entry.restaurant.id, branch: entry.branch, comment: entry.comment, menus: entry.menus,
        })),
        {restaurant, branch: null, comment: "", menus: []},
    ])
    return "added" as const
}

// 지도 API 없이 가게 이름과 주소로 지도 검색을 연다
export const mapSearchUrl = (...words: (string | undefined)[]) =>
    `https://map.naver.com/p/search/${encodeURIComponent(words.filter(Boolean).join(" "))}`
