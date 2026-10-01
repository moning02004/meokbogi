import {expect, test} from "@playwright/test";
import {Api, category, createUser, daysAgo, loginUi} from "./helpers";

test.describe("홈과 설정", () => {
    test("만족했지만 오래 안 간 곳이 '오랜만에 가볼 곳'에 나온다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const chicken = category(zone, "치킨").id
        const forgotten = await api.createRestaurant(zone.id, chicken, "잊은 맛집")
        const recent = await api.createRestaurant(zone.id, chicken, "요즘 맛집")
        await api.createReview(forgotten.id, {menu: "후라이드", point: 1, ordered_at: daysAgo(90)})
        await api.createReview(recent.id, {menu: "양념", point: 1, ordered_at: daysAgo(2)})
        await loginUi(page, user)

        await page.getByRole("button", {name: "오랜만에 가볼 곳"}).click()
        await expect(page.getByText("잊은 맛집")).toBeVisible()
        await expect(page.getByText("마지막 방문 90일 전")).toBeVisible()
        await expect(page.getByText("요즘 맛집")).toHaveCount(0)
    })

    test("장소 이름을 바꾸면 상단바에도 바로 반영된다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "내정보"}).click()
        await page.getByRole("button", {name: /우리집/}).click()
        await page.getByLabel("장소 이름").fill("새 집")
        await page.getByRole("button", {name: "저장", exact: true}).click()
        await expect(page.getByText("장소 이름을 바꿨어요.")).toBeVisible()

        await page.getByRole("button", {name: "닫기"}).click()
        await page.getByRole("button", {name: "홈"}).click()
        await expect(page.getByText("새 집 기록")).toBeVisible()
    })
})
