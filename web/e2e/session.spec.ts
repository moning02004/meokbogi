import {expect, test} from "@playwright/test";
import {Api, category, createUser, loginUi} from "./helpers";

test.describe("새 탭·링크로 들어오기", () => {
    test("새 탭에서 음식점 목록을 바로 열어도 로딩에서 멈추지 않는다", async ({page, context, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")

        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        // 새 탭은 sessionStorage가 비어 있다 (예전에는 여기서 무한 로딩)
        const tab = await context.newPage()
        await tab.goto("/restaurant")
        await expect(tab.getByText("교촌치킨")).toBeVisible()
        await expect(tab.getByText("총 1곳")).toBeVisible()
    })

    test("음식점 상세 링크를 새 탭으로 열 수 있고, 없는 음식점은 안내가 뜬다", async ({page, context, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "피자").id, "미뜨레피자")

        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        const tab = await context.newPage()
        await tab.goto(`/restaurant/${restaurant.id}`)
        await expect(tab.getByText("미뜨레피자")).toBeVisible()

        await tab.goto("/restaurant/999999")
        await expect(tab.getByText("음식점을 찾을 수 없어요", {exact: false})).toBeVisible()
        await tab.getByRole("button", {name: "음식점 목록으로"}).click()
        await expect(tab).toHaveURL(/\/restaurant$/)
    })

    test("장소를 바꾸면 카테고리 필터가 전체로 돌아간다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const home = await api.createZone("우리집")
        const office = await api.createZone("회사")
        await api.createRestaurant(home.id, category(home, "치킨").id, "교촌치킨")
        await api.createRestaurant(office.id, category(office, "한식").id, "회사 앞 백반")

        await loginUi(page, user)
        await page.getByRole("button", {name: "음식점", exact: true}).click()

        // 지금 선택된 장소가 어디든 그 장소의 "치킨"으로 거른 뒤 다른 장소로 바꾼다
        await page.getByRole("button", {name: "치킨", exact: true}).click()
        const current = await page.locator("text=ZONE").locator("xpath=following-sibling::div").innerText()
        const other = current === "우리집" ? "회사" : "우리집"

        await page.getByRole("button", {name: "장소 바꾸기"}).click()
        await page.getByRole("button", {name: other, exact: true}).click()

        // 예전에는 이전 장소의 카테고리 id로 조회해서 "총 0곳"이 나왔다
        await expect(page.getByText("총 1곳")).toBeVisible()
        await expect(page.getByText(other === "회사" ? "회사 앞 백반" : "교촌치킨")).toBeVisible()
    })
})
