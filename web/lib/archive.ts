import {apiRequest} from "@/lib/api";
import {USER_API} from "@/constants/routeUrl";

export interface ImportSummary {
    zones_created: number;
    categories_created: number;
    restaurants_created: number;
    restaurants_matched: number;
    reviews_created: number;
    reviews_skipped: number;
    dry_run: boolean;
}

// 서버가 만든 파일을 받아 브라우저 다운로드로 넘긴다 (인증 헤더가 필요해서 링크로는 못 받는다)
export const downloadArchive = async (type: "json" | "csv") => {
    const exportApi = USER_API.export
    const response = await apiRequest[exportApi.method]<Response>(
        `${exportApi.endpoint}${type === "csv" ? "?type=csv" : ""}`, {}, {isDownloadFile: true})
    const blob = await response.blob()
    const disposition = response.headers.get("Content-Disposition") ?? ""
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `meokbogi.${type}`

    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// dryRun이면 서버가 실제로 바꾸지 않고 무엇이 생길지만 센다
export const importArchive = (file: File, dryRun: boolean) => {
    const form = new FormData()
    form.append("file", file)
    const importApi = USER_API.import
    // multipart 경계값은 브라우저가 정하므로 Content-Type을 직접 넣지 않는다 (isMime)
    return apiRequest[importApi.method]<ImportSummary>(
        `${importApi.endpoint}${dryRun ? "?dry_run=1" : ""}`, {body: form}, {isMime: true})
}
