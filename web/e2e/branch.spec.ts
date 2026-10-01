import {expect, Page, test} from "@playwright/test";
import {Api, category, createUser, loginUi} from "./helpers";

async function record(page: Page, {branch, newBranch, menu, point}: {
    branch?: string; newBranch?: string; menu: string; point: "만족" | "보통" | "실망"
}) {
    await page.getByRole("button", {name: "먹은 메뉴 기록하기"}).click()
    const sheet = page.getByRole("dialog")
    if (newBranch) {
        await sheet.getByRole("button", {name: "+ 지점 추가"}).click()
        await sheet.getByLabel("새 지점 이름").fill(newBranch)
        await sheet.getByRole("button", {name: "추가", exact: true}).click()
        await expect(sheet.getByRole("radio", {name: newBranch})).toHaveAttribute("aria-checked", "true")
    } else if (branch) {
        await sheet.getByRole("radio", {name: branch}).click()
    }
    await sheet.getByRole("combobox", {name: /^메뉴/}).fill(menu)
    await sheet.getByRole("radio", {name: point}).click()
    await sheet.getByRole("button", {name: "기록하기"}).click()
    await expect(sheet).toBeHidden()
}

test.describe("지점", () => {
    test("같은 메뉴를 지점별로 평가하고, 지점으로 걸러 본다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        await page.goto(`/restaurant/${restaurant.id}`)

        // 지점이 없을 때는 지점 거르기가 보이지 않는다
        await expect(page.getByRole("radiogroup", {name: "지점"})).toHaveCount(0)

        await record(page, {newBranch: "역삼점", menu: "허니콤보", point: "만족"})
        await expect(page.getByText("'역삼점' 지점을 추가했어요.")).toBeVisible()
        await record(page, {newBranch: "본점", menu: "허니콤보", point: "실망"})

        // 메뉴는 브랜드에 하나
        await expect(page.getByRole("button", {name: /허니콤보.*리뷰 2/})).toBeVisible()

        const filter = page.getByRole("radiogroup", {name: "지점"})
        await filter.getByRole("radio", {name: "역삼점"}).click()
        await expect(page.getByRole("button", {name: /허니콤보 만족 리뷰 1/})).toBeVisible()
        await filter.getByRole("radio", {name: "본점"}).click()
        await expect(page.getByRole("button", {name: /허니콤보 실망 리뷰 1/})).toBeVisible()

        // 본점을 보고 있을 때 또 먹었어요 → 본점이 골라진 시트
        await page.getByRole("button", {name: "허니콤보 또 먹었어요"}).click()
        await expect(page.getByRole("dialog").getByRole("radio", {name: "본점"})).toHaveAttribute("aria-checked", "true")
        await page.getByRole("dialog").getByRole("button", {name: "닫기"}).click()

        // 리뷰 목록에도 지점이 보인다
        await filter.getByRole("radio", {name: "모든 지점"}).click()
        await page.getByRole("button", {name: "리뷰 보기"}).click()
        await expect(page.getByText("역삼점", {exact: true}).last()).toBeVisible()

        expect((await api.reviews(restaurant.id)).count).toBe(2)
    })

    test("지점을 지워도 리뷰는 남는다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        await page.goto(`/restaurant/${restaurant.id}`)
        await record(page, {newBranch: "역삼점", menu: "허니콤보", point: "만족"})

        await page.getByRole("button", {name: "음식점 메뉴 열기"}).click()
        await page.getByRole("button", {name: "음식점 수정"}).click()
        await page.getByRole("button", {name: "역삼점 지점 지우기"}).click()
        await page.getByRole("button", {name: "지우기", exact: true}).click()
        await expect(page.getByText("'역삼점' 지점을 지웠어요.")).toBeVisible()

        const reviews = await api.reviews(restaurant.id)
        expect(reviews.count).toBe(1)
        expect(reviews.results[0]).toMatchObject({branch: null})
    })
})
