import {BrowserContext, expect, test} from "@playwright/test";
import {createECDH, randomBytes} from "node:crypto";
import {Api, createUser, loginUi} from "./helpers";
import {API_HOST, PUSH_API_TOKEN} from "./env";

const b64url = (buffer: Buffer) => buffer.toString("base64url")

// 헤드리스 Chromium은 실제 푸시 서비스(FCM)에 구독할 수 없어서 브라우저의 PushManager만 가짜로 바꾼다.
// 키는 진짜 P-256 공개키라 서버가 암호화까지 하고, 존재하지 않는 주소(push.invalid)로 보내다 실패한다.
async function stubPushManager(context: BrowserContext) {
    const ecdh = createECDH("prime256v1")
    ecdh.generateKeys()
    const keys = {p256dh: b64url(ecdh.getPublicKey()), auth: b64url(randomBytes(16))}
    await context.grantPermissions(["notifications"])
    await context.addInitScript((subscriptionKeys) => {
        let current: unknown = null
        const proto = (window as unknown as { PushManager: { prototype: Record<string, unknown> } }).PushManager.prototype
        proto.getSubscription = async () => current
        proto.subscribe = async (options: unknown) => {
            current = {
                endpoint: `https://push.invalid/e2e/${Math.random().toString(36).slice(2)}`,
                options,
                toJSON() {
                    return {endpoint: (this as { endpoint: string }).endpoint, keys: subscriptionKeys}
                },
                unsubscribe: async () => {
                    current = null
                    return true
                },
            }
            return current
        }
    }, keys)
}

test.describe("알림", () => {
    test("이 기기에서 알림을 켜고, 서버 토큰으로 n8n처럼 보낸다", async ({page, context, request}) => {
        await stubPushManager(context)
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        await page.getByRole("button", {name: "내정보"}).click()

        const toggle = page.getByRole("switch", {name: "이 기기에서 알림 받기"})
        await expect(toggle).toHaveAttribute("aria-checked", "false")
        await expect(page.getByText("알림 받는 기기 0대")).toBeVisible()

        await toggle.click()
        await expect(page.getByText("이 기기에서 알림을 받아요.")).toBeVisible()
        await expect(toggle).toHaveAttribute("aria-checked", "true")
        await expect(page.getByText("알림 받는 기기 1대")).toBeVisible()

        // 시험 알림: 서버가 암호화해 보내지만 가짜 주소라 전달은 실패한다 → 실패 안내
        await page.getByRole("button", {name: "시험 알림 보내기"}).click()
        await expect(page.getByText("알림 서비스에 보내지 못했어요", {exact: false})).toBeVisible()

        // n8n이 하는 일: 로그인 없이 서버 토큰으로 보낸다
        const sent = await request.post(`${API_HOST}/push/send`, {
            headers: {Authorization: `Bearer ${PUSH_API_TOKEN}`},
            data: {title: "점심 뭐 드셨어요?", content: "먹은 메뉴를 남겨 두세요"},
        })
        expect(sent.status()).toBe(200)
        expect(await sent.json()).toEqual({sent: 0, removed: 0, failed: 1})

        // 끄면 서버에서도 지워진다
        await toggle.click()
        await expect(page.getByText("이 기기의 알림을 껐어요.")).toBeVisible()
        await expect(page.getByText("알림 받는 기기 0대")).toBeVisible()
    })

    test("토큰이 틀리면 보낼 수 없다", async ({request}) => {
        const response = await request.post(`${API_HOST}/push/send`, {
            headers: {Authorization: "Bearer wrong-token"}, data: {title: "제목"},
        })
        expect(response.status()).toBe(401)
    })

    test("서비스 워커가 등록된다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
        expect(new URL(scope).pathname).toBe("/")
    })
})

test.describe("iPhone Safari", () => {
    test.use({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    })

    test("홈 화면 앱이 아니면 설치 방법을 안내한다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        await page.getByRole("button", {name: "내정보"}).click()

        await expect(page.getByText("홈 화면에 추가한 앱에서만 알림을 받을 수 있어요", {exact: false})).toBeVisible()
        await expect(page.getByRole("switch", {name: "이 기기에서 알림 받기"})).toHaveCount(0)
    })
})
