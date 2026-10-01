import {expect, test} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {Api, category, createUser, daysAgo, loginUi} from "./helpers";

test.describe("내 기록 내보내기·가져오기", () => {
    test("백업 파일로 내보낸 뒤 다른 계정에서 가져온다", async ({page, request, browser}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await api.createReview(restaurant.id, {menu: "허니콤보", point: 1, ordered_at: daysAgo(3)})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "내정보"}).click()
        const downloading = page.waitForEvent("download")
        await page.getByRole("button", {name: /백업 파일로 내보내기/}).click()
        const download = await downloading
        expect(download.suggestedFilename()).toMatch(/^meokbogi-\d{8}\.json$/)
        const file = await download.path()
        const archive = JSON.parse(await readFile(file, "utf-8"))
        expect(archive.version).toBe(3)
        expect(archive.zones[0].restaurants[0]).toMatchObject({name: "교촌치킨", categories: ["치킨"]})

        // 새 계정(장소 하나만 있는)으로 가져오기
        const other = createUser()
        await (await Api.login(request, other)).createZone("회사")
        const context = await browser.newContext({...test.info().project.use})
        const otherPage = await context.newPage()
        await loginUi(otherPage, other)
        await expect(otherPage.getByText("회사 기록")).toBeVisible()
        await otherPage.getByRole("button", {name: "내정보"}).click()

        await otherPage.getByLabel("가져올 백업 파일").setInputFiles(file)
        const dialog = otherPage.getByRole("dialog", {name: "백업 파일 가져오기"})
        await expect(dialog.getByText("새 리뷰")).toBeVisible()
        await expect(dialog.locator("dd").nth(3)).toHaveText("1")
        await dialog.getByRole("button", {name: "가져오기"}).click()
        await expect(otherPage.getByText("음식점 1곳, 리뷰 1개를 가져왔어요.")).toBeVisible()

        // 같은 파일을 다시 고르면 늘어날 게 없다고 알려준다
        await otherPage.getByLabel("가져올 백업 파일").setInputFiles(file)
        await expect(otherPage.getByText("이미 모두 있어요", {exact: false})).toBeVisible()
        await expect(otherPage.getByRole("dialog").getByRole("button", {name: "가져오기"})).toBeDisabled()
        await context.close()
    })

    test("엑셀용 CSV로 내보낸다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "피자").id, "미뜨레피자")
        await api.createReview(restaurant.id, {menu: "마르게리타", point: -1, ordered_at: daysAgo(1)})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "내정보"}).click()
        const downloading = page.waitForEvent("download")
        await page.getByRole("button", {name: /엑셀용으로 내보내기/}).click()
        const csv = await readFile(await (await downloading).path(), "utf-8")
        expect(csv).toContain("미뜨레피자")
        expect(csv).toContain("마르게리타,실망")
    })

    test("먹보기 파일이 아니면 이유를 알려준다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "내정보"}).click()
        await page.getByLabel("가져올 백업 파일").setInputFiles({
            name: "notes.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({hello: "world"})),
        })
        await expect(page.getByText("먹보기에서 내보낸 백업 파일이 아니에요.")).toBeVisible()
    })
})
