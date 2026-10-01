import {expect, Page, test} from "@playwright/test";
import {Api, category, createUser, daysAgo, loginUi} from "./helpers";

// 카드 뽑기는 무작위라, 한 카테고리만 남기고 모두 빼서 결과를 고정한다
async function keepOnly(page: Page, keep: string) {
    await page.getByRole("button", {name: "카테고리 고르기"}).click()
    const chips = page.locator("button[aria-pressed]")
    for (const chip of await chips.all()) {
        const label = (await chip.innerText()).trim()
        if (label !== keep) await chip.click()
    }
    await expect(page.getByText("1개로 섞어요", {exact: false})).toBeVisible()
}

async function shuffle(page: Page) {
    await page.getByRole("button", {name: "섞기", exact: true}).click()
    await expect(page.getByRole("button", {name: "다시 섞기"})).toBeVisible({timeout: 10_000})
}

test.describe("뽑기", () => {
    test("기록이 없는 카테고리가 나오면 도전을 권한다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "뽑기"}).click()
        // 음식점이 없어도 모든 카테고리가 판에 올라온다
        await expect(page.getByText("14개 중 14개로 섞어요")).toBeVisible()

        await keepOnly(page, "인도")
        await shuffle(page)
        await expect(page.getByText("오늘은 인도 도전!")).toBeVisible()
        await expect(page.getByRole("button", {name: "한 곳 뽑기"})).toHaveCount(0)
        await page.getByRole("button", {name: "인도 음식점 등록하기"}).click()
        await expect(page).toHaveURL(/\/restaurant\/add$/)
    })

    test("음식점이 있는 카테고리에서는 한 곳을 뽑고, 실망한 곳은 기본으로 빠진다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const pizza = category(zone, "피자").id
        const good = await api.createRestaurant(zone.id, pizza, "미뜨레피자")
        const bad = await api.createRestaurant(zone.id, pizza, "실망피자")
        await api.createReview(good.id, {menu: "마르게리타", point: 1, ordered_at: daysAgo(40)})
        await api.createReview(bad.id, {menu: "페퍼로니", point: -1, ordered_at: daysAgo(40)})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "뽑기"}).click()
        await keepOnly(page, "피자")
        await shuffle(page)

        for (let i = 0; i < 4; i++) {
            await page.getByRole("button", {name: i === 0 ? "한 곳 뽑기" : "다시 뽑기"}).click()
            await expect(page.getByRole("button", {name: /미뜨레피자.*마지막 방문 40일 전/})).toBeVisible()
        }
    })
})
