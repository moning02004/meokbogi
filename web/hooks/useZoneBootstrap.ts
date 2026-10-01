"use client";

import {useEffect} from "react";
import {usePathname, useRouter} from "next/navigation";
import {useZoneStore} from "@/store/zone";
import {syncZones} from "@/lib/zone";
import {ZONE_PAGE} from "@/constants/routeUrl";

// 존 정보는 sessionStorage에 있어서 새 탭·공유 링크·PWA 재실행으로 들어오면 비어 있다.
// 그 상태로 음식점 목록/뽑기/등록 화면에 들어가면 selectedZone이 없어 로딩 화면에서 멈췄다.
// 인증이 끝난 뒤 존이 비어 있으면 한 번 불러오고, 존이 하나도 없으면 생성 화면으로 보낸다.
export function useZoneBootstrap(enabled: boolean) {
    const router = useRouter()
    const pathname = usePathname()
    const hasZones = useZoneStore((state) => state.zones.length > 0)

    useEffect(() => {
        if (!enabled || hasZones) return
        syncZones().then((rows) => {
            if (rows.length === 0 && pathname !== ZONE_PAGE.add) router.replace(ZONE_PAGE.add)
        }).catch(() => null)
    }, [enabled, hasZones, pathname, router])
}
