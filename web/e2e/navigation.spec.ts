import {expect, test} from "@playwright/test";
import {Api, createUser, loginUi} from "./helpers";

test.describe("화면 이동·연결 상태", () => {
    test("버튼을 누르면 새 화면이 뜰 때까지 맨 위에 줄이 보인다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        await api.createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        // 처음 여는 화면처럼 먹골목 화면 받아오기를 늦춘다 (미리 받기도 같이 늦어진다)
        await page.route(/\/guides(\?|$)/, async (route) => {
            if (route.request().resourceType() === "document") return route.continue()
            await new Promise((resolve) => setTimeout(resolve, 1500))
            await route.continue()
        })
        await page.goto("/my-info")
        await page.getByRole("button", {name: /먹골목/}).click()

        const bar = page.getByRole("progressbar", {name: "화면 여는 중"})
        await expect(bar).toBeVisible()
        await page.waitForTimeout(600)
        await page.screenshot({path: "test-results/navigation-progress.png", clip: {x: 0, y: 0, width: 393, height: 80}})
        await expect(page.getByLabel("새 골목")).toBeVisible()
        await expect(bar).toBeHidden()
    })

    test("통신이 끊기면 하단 토스트가 하나만 뜨고, 다시 연결되면 사라진다", async ({page, context, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        await api.createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await context.setOffline(true)
        const toast = page.getByText("네트워크 연결이 불안정합니다.")
        await expect(toast).toBeVisible()

        // 끊긴 채로 다른 탭을 눌러도 지금 화면에 머물고(브라우저 오류 화면이 뜨지 않고) 토스트는 하나뿐이다
        await page.getByRole("button", {name: "뽑기"}).click()
        await page.waitForTimeout(500)
        await expect(page).toHaveURL(/\/home$/)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        await expect(toast).toHaveCount(1)
        await page.screenshot({path: "test-results/network-toast.png"})

        await context.setOffline(false)
        await expect(toast).toBeHidden()
    })
})
