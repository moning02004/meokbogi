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

    test("카테고리는 장소와 상관없이 한 벌이고, 내정보에서 카테고리별로 장소·음식점을 본다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const home = await api.createZone("우리집")
        const office = await api.createZone("회사")
        // 두 번째 장소를 만들어도 기본 카테고리가 복제되지 않는다
        expect(office.category.map((c) => c.id)).toEqual(home.category.map((c) => c.id))
        const chicken = category(home, "치킨").id
        await api.createRestaurant(home.id, chicken, "교촌치킨")
        await api.createRestaurant(home.id, chicken, "BBQ")
        const bhc = await api.createRestaurant(office.id, chicken, "회사 앞 BHC")

        await loginUi(page, user)
        await expect(page.getByText(/기록$/).first()).toBeVisible()

        // 음식점 등록 화면에서 만든 카테고리는 다른 장소에서도 보인다
        await page.goto("/restaurant/add")
        await page.getByRole("button", {name: /^카테고리/}).click()
        await page.getByLabel("새 카테고리").fill("샐러드")
        await page.getByRole("button", {name: "추가", exact: true}).click()
        await expect(page.getByText("'샐러드' 카테고리를 만들었어요.")).toBeVisible()

        await page.goto("/my-info")
        // 내정보에는 한 줄만 있고 별도 페이지로 간다
        await page.getByRole("button", {name: /카테고리별 음식점/}).click()
        await expect(page).toHaveURL(/\/categories$/)
        // 카테고리를 추가하지 않는다 (찾기만)
        await expect(page.getByPlaceholder(/카테고리 찾기 · 추가/)).toHaveCount(0)
        await page.getByLabel("카테고리 찾기").fill("치킨")
        const row = page.getByRole("button", {name: /치킨.*우리집 2 · 회사 1/})
        await expect(row).toBeVisible()
        await row.click()
        await expect(page.getByRole("button", {name: /회사 앞 BHC/})).toBeVisible()
        await expect(page.getByRole("button", {name: /교촌치킨/})).toBeVisible()

        // 다른 장소의 음식점을 누르면 그 장소로 바뀌고 상세로 간다
        await page.getByRole("button", {name: /회사 앞 BHC/}).click()
        await expect(page).toHaveURL(new RegExp(`/restaurant/${bhc.id}$`))
        await page.goto("/home")
        await expect(page.getByText("회사 기록")).toBeVisible()

        await page.goto("/categories")
        await page.getByLabel("카테고리 찾기").fill("샐러드")
        await expect(page.getByRole("button", {name: /샐러드.*등록한 음식점 없음/})).toBeVisible()
    })
})
