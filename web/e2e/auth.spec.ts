import {expect, test} from "@playwright/test";
import {Api, createUser, loginUi} from "./helpers";

test.describe("로그인", () => {
    test("비밀번호를 틀려도 페이지가 새로고침되지 않고 입력이 남는다", async ({page}) => {
        const user = createUser()
        await page.goto("/login")
        // 새로고침되면 이 표시가 사라진다
        await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true))

        await page.getByLabel("아이디").fill(user.username)
        await page.getByLabel("비밀번호").fill("wrong-password")
        await page.getByRole("button", {name: "로그인"}).click()

        await expect(page.getByText("아이디 또는 비밀번호가 올바르지 않아요.")).toBeVisible()
        await expect(page.getByLabel("아이디")).toHaveValue(user.username)
        expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true)
    })

    test("장소가 없으면 장소 만들기로 가고, 만들면 홈 대시보드가 뜬다", async ({page}) => {
        const user = createUser()
        await loginUi(page, user)

        await expect(page).toHaveURL(/\/zone\/add$/)
        await page.getByPlaceholder("예: 우리집, 회사, 친구집").fill("우리집")
        await page.getByRole("button", {name: "존 만들기"}).click()

        await expect(page).toHaveURL(/\/home$/)
        await expect(page.getByText("우리집 기록")).toBeVisible()
    })

    test("새로고침해도 로그인이 유지되고, 로그아웃하면 다시 로그인 화면으로 간다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.reload()
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "내정보"}).click()
        await page.getByRole("button", {name: "로그아웃"}).click()
        await expect(page).toHaveURL(/\/login$/)

        // 로그아웃한 refresh 쿠키로는 자동로그인되지 않는다
        await page.goto("/home")
        await expect(page).toHaveURL(/\/login$/)
        await expect(page.getByLabel("아이디")).toBeVisible()
    })
})
