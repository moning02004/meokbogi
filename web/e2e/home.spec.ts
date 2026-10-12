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

    test("홈 카드를 누르면 통계 화면에서 월별 주문과 카테고리 순위를 본다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const chicken = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        const snack = await api.createRestaurant(zone.id, category(zone, "분식").id, "김밥천국")
        await api.createReview(chicken.id, {menu: "허니콤보", ordered_at: daysAgo(0)})
        // 같은 날 같은 가게에서 메뉴를 하나 더 기록해도 방문은 한 번
        await api.createReview(chicken.id, {menu: "레드콤보", ordered_at: daysAgo(0)})
        await api.createReview(chicken.id, {menu: "허니콤보", ordered_at: daysAgo(40)})
        await api.createReview(snack.id, {menu: "김밥", ordered_at: daysAgo(40)})
        await loginUi(page, user)

        await page.getByRole("button", {name: "통계 보기"}).click()
        await expect(page.getByRole("heading", {name: "월별 주문"})).toBeVisible()
        await expect(page.getByText("치킨을 가장 많이 먹었어요")).toBeVisible()

        // 처음에는 이번 달, 막대를 누르면 그 달의 횟수로 바뀐다
        const now = new Date()
        await expect(page.getByRole("button", {name: `${now.getFullYear()}년 ${now.getMonth() + 1}월 1번`})).toHaveAttribute("aria-pressed", "true")
        const before = new Date()
        before.setDate(before.getDate() - 40)
        await page.getByRole("button", {name: `${before.getFullYear()}년 ${before.getMonth() + 1}월 2번`}).click()
        await expect(page.getByText(`${before.getFullYear()}년 ${before.getMonth() + 1}월`, {exact: true})).toBeVisible()

        // 고른 달의 달력에 기록한 날이 표시되고, 아래에 날짜별로 간 곳이 나온다
        const days = page.getByRole("region", {name: `${before.getMonth() + 1}월 기록`})
        await expect(days.getByText(`${before.getMonth() + 1}월에 2번 기록했어요`)).toBeVisible()
        await expect(days.getByText("기록을 남긴 날은 모두 1일이에요.")).toBeVisible()
        await expect(days.getByRole("button", {name: `${before.getMonth() + 1}월 ${before.getDate()}일, 기록 2곳`})).toBeVisible()
        await expect(days.getByRole("button", {name: /교촌치킨.*허니콤보/})).toBeVisible()
        await expect(days.getByRole("button", {name: /김밥천국.*김밥/})).toBeVisible()

        // 음식점을 누르면 그 음식점 상세로 간다
        await days.getByRole("button", {name: /김밥천국/}).click()
        await expect(page.getByRole("heading", {name: "김밥천국"})).toBeVisible()
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
        await page.getByRole("button", {name: "+ 새 카테고리"}).click()
        await page.getByLabel("새 카테고리 이름").fill("샐러드")
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
