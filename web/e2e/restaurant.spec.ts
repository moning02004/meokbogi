import {expect, test} from "@playwright/test";
import {Api, category, createUser, daysAgo, loginUi} from "./helpers";

test.describe("음식점과 리뷰", () => {
    test("음식점을 등록하고 리뷰를 남긴 뒤 '또 먹었어요'와 되돌리기", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        await api.createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "음식점등록"}).click()
        await page.getByPlaceholder("카테고리를 선택해주세요").click()
        await page.getByRole("button", {name: "치킨", exact: true}).click()
        await page.getByPlaceholder("예: 미뜨레피자").fill("교촌치킨")
        await page.getByRole("button", {name: "등록", exact: true}).click()
        await expect(page).toHaveURL(/\/restaurant\/\d+$/)
        const restaurantId = Number(page.url().split("/").pop())

        await page.getByPlaceholder("오늘 뭐 드셨어요?").fill("허니콤보")
        await page.getByRole("radio", {name: "만족"}).click()
        await page.getByPlaceholder("한줄평 (선택)").fill("바삭함")
        await page.getByRole("button", {name: "기록", exact: true}).click()
        await expect(page.getByText("기록했어요.")).toBeVisible()
        // 기록하고 나면 메뉴 제안 목록이 닫혀 있어야 한다 (열린 채 한줄평을 가리던 문제)
        await expect(page.getByRole("button", {name: /허니콤보.*리뷰/})).toHaveCount(1)
        await expect(page.getByRole("button", {name: /허니콤보.*리뷰 1/})).toBeVisible()

        await page.getByRole("button", {name: "허니콤보 오늘 또 먹은 걸로 기록"}).click()
        await expect(page.getByRole("button", {name: /허니콤보.*리뷰 2/})).toBeVisible()
        await page.getByRole("button", {name: "되돌리기"}).click()
        await expect(page.getByText("기록을 되돌렸어요.")).toBeVisible()
        await expect(page.getByRole("button", {name: /허니콤보.*리뷰 1/})).toBeVisible()
        expect((await api.reviews(restaurantId)).count).toBe(1)
    })

    test("기록 버튼을 연타해도 리뷰는 하나만 생긴다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByPlaceholder("오늘 뭐 드셨어요?").fill("후라이드")
        await page.getByRole("button", {name: "기록", exact: true}).dblclick()
        await expect(page.getByText("기록했어요.")).toBeVisible()
        expect((await api.reviews(restaurant.id)).count).toBe(1)
    })

    test("리뷰를 고치고, 시트 안에서 확인한 뒤 지운다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await api.createReview(restaurant.id, {menu: "양념", point: 0, content: "그냥 그럼"})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByRole("button", {name: "리뷰 보기"}).click()
        await expect(page.getByText("그냥 그럼")).toBeVisible()

        await page.getByRole("button", {name: "리뷰 메뉴 열기"}).click()
        await page.getByRole("button", {name: "리뷰 수정"}).click()
        await page.getByLabel("한줄평").fill("다시 먹어보니 맛있음")
        await page.getByRole("dialog").getByRole("radio", {name: "만족"}).click()
        await page.getByRole("button", {name: "수정하기"}).click()
        await expect(page.getByText("리뷰를 고쳤어요.")).toBeVisible()
        await expect(page.getByRole("dialog")).toBeHidden()
        await expect(page.getByText("다시 먹어보니 맛있음")).toBeVisible()
        expect((await api.reviews(restaurant.id)).results[0].point).toBe(1)

        await page.getByRole("button", {name: "리뷰 메뉴 열기"}).click()
        await page.getByRole("button", {name: "리뷰 삭제"}).click()
        await expect(page.getByText("이 리뷰를 삭제할까요?")).toBeVisible()
        await page.getByRole("button", {name: "삭제", exact: true}).click()
        await expect(page.getByText("리뷰를 삭제했어요.")).toBeVisible()
        expect((await api.reviews(restaurant.id)).count).toBe(0)
    })

    test("띄어쓰기만 다른 메뉴는 합쳐진다고 알려주고 실제로 합친다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await api.createReview(restaurant.id, {menu: "간장치킨", ordered_at: daysAgo(3)})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByPlaceholder("오늘 뭐 드셨어요?").fill("간장 치킨")
        await expect(page.getByText("‘간장치킨’(으)로 합쳐서 기록돼요.")).toBeVisible()
        await page.getByRole("button", {name: "기록", exact: true}).click()
        await expect(page.getByRole("button", {name: /간장치킨.*리뷰 2/})).toBeVisible()
    })

    test("21번째 이후 음식점도 중복 등록 제안에 나온다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const chicken = category(zone, "치킨").id
        for (let i = 1; i <= 24; i++) await api.createRestaurant(zone.id, chicken, `가게${String(i).padStart(2, "0")}`)
        await api.createRestaurant(zone.id, chicken, "숨은맛집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto("/restaurant/add")
        await page.getByPlaceholder("예: 미뜨레피자").fill("숨은")
        await expect(page.getByText("이미 등록된 음식점이에요", {exact: false})).toBeVisible()
        await expect(page.getByRole("button", {name: /숨은맛집/})).toBeVisible()
    })

    test("목록에서 이름으로 찾고 정렬을 바꾼다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const chicken = category(zone, "치킨").id
        const good = await api.createRestaurant(zone.id, chicken, "가 최고")
        const bad = await api.createRestaurant(zone.id, chicken, "나 별로")
        await api.createReview(good.id, {menu: "후라이드", point: 1, ordered_at: daysAgo(30)})
        await api.createReview(bad.id, {menu: "양념", point: -1, ordered_at: daysAgo(1)})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "음식점", exact: true}).click()
        const names = page.locator("p.font-bold")
        await expect(names).toHaveText(["나 별로", "가 최고"])  // 기본: 최근 방문순

        await page.getByLabel("정렬").selectOption("rating")
        await expect(names).toHaveText(["가 최고", "나 별로"])

        await page.getByLabel("음식점 이름으로 찾기").fill("최고")
        await expect(names).toHaveText(["가 최고"])
        await expect(page.getByText("총 1곳")).toBeVisible()
    })
})
