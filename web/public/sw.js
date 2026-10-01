// 먹보기 서비스 워커. 지금은 웹 푸시만 처리한다 (오프라인 캐시는 하지 않는다).

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

// 서버(apps/push/sender.py)가 보내는 내용: {"title", "body", "url"}
self.addEventListener("push", (event) => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch {
        data = {body: event.data ? event.data.text() : ""}
    }

    event.waitUntil(self.registration.showNotification(data.title || "먹보기", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        // 배지는 안드로이드가 알파 채널만 써서 한 가지 색으로 칠한다.
        // 불투명한 앱 아이콘을 주면 하얀 원만 보이므로, 투명 바탕에 포크·숟가락만 있는 그림을 쓴다.
        badge: "/icons/badge-96.png",
        lang: "ko",
        data: {url: data.url || "/home"},
    }))
})

// 알림을 누르면 이미 열린 먹보기 창이 있으면 그 창을, 없으면 새 창을 연다
self.addEventListener("notificationclick", (event) => {
    event.notification.close()
    const target = new URL(event.notification.data?.url || "/home", self.location.origin).href

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true})
        for (const client of windows) {
            if (new URL(client.url).origin === self.location.origin && "focus" in client) {
                await client.focus()
                if ("navigate" in client) await client.navigate(target)
                return
            }
        }
        await self.clients.openWindow(target)
    })())
})
