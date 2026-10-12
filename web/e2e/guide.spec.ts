import {expect, test} from "@playwright/test";
import {Api, category, createUser, daysAgo, loginUi} from "./helpers";

test.describe("먹골목", () => {
    test("골목을 만들어 집을 싣고, 링크로 로그인 없이 본다", async ({page, request, browser}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const noodle = await api.createRestaurant(zone.id, category(zone, "한식").id, "진미손칼국수")
        await api.createReview(noodle.id, {menu: "바지락칼국수", ordered_at: daysAgo(3), content: "나만 보는 메모"})
        await api.createReview(noodle.id, {menu: "바지락칼국수", ordered_at: daysAgo(40)})
        await api.createReview(noodle.id, {menu: "손만두", ordered_at: daysAgo(40)})
        await api.createRestaurant(zone.id, category(zone, "분식").id, "산들김밥")

        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        await page.goto("/my-info")
        await page.getByRole("button", {name: /먹골목/}).click()

        await page.getByLabel("새 골목").fill("을지로 점심 골목")
        await page.getByRole("button", {name: "골목 만들기"}).click()
        await expect(page.getByText("골목 꾸미기")).toBeVisible()

        // 많이 간 집이 위에 온다
        await page.getByRole("button", {name: "음식점 고르기"}).click()
        const picker = page.getByRole("dialog")
        await expect(picker.getByRole("button").filter({hasText: "방문"}).first()).toContainText("진미손칼국수")
        await picker.getByRole("button", {name: /산들김밥/}).click()
        await picker.getByRole("button", {name: /진미손칼국수/}).click()
        await expect(picker.getByRole("button", {name: /진미손칼국수/})).toBeDisabled()
        await picker.getByRole("button", {name: "닫기"}).click()
        await expect(picker).toBeHidden()

        // 칼국수를 위로 올리고 한마디와 메뉴를 붙인다
        await page.getByRole("button", {name: "진미손칼국수 위로"}).click()
        await page.getByLabel("한마디").first().fill("바지락이 매번 넉넉해요")
        await page.getByRole("button", {name: /^바지락칼국수 2$/}).click()
        await page.getByLabel(/^주소/).first().fill("을지로12길 3")
        await page.getByLabel("소개").fill("먹어본 집만 골랐어요")

        await page.getByRole("button", {name: "저장하고 링크 만들기"}).click()
        await expect(page.getByText("링크를 만들었어요.")).toBeVisible()
        const url = await page.getByLabel("공개 주소").inputValue()
        expect(url).toContain("/g/")

        // 로그인하지 않은 다른 브라우저
        const visitor = await (await browser.newContext()).newPage()
        await visitor.goto(url)
        await expect(visitor.getByRole("heading", {name: "을지로 점심 골목"})).toBeVisible()
        await expect(visitor.getByText("먹어본 집만 골랐어요")).toBeVisible()
        const cards = visitor.getByRole("article")
        await expect(cards).toHaveCount(2)
        await expect(cards.first()).toContainText("진미손칼국수")
        await expect(cards.first()).toContainText("2번 먹음")
        await expect(cards.first()).toContainText("바지락이 매번 넉넉해요")
        await expect(cards.first()).toContainText("을지로12길 3")
        await expect(cards.first().getByRole("list", {name: "권하는 메뉴"})).toHaveText("바지락칼국수")
        await expect(visitor.getByText("나만 보는 메모")).toHaveCount(0)
        await expect(visitor.getByText("우리집")).toHaveCount(0)

        // 골목에서 적은 주소는 음식점에 저장되어 상세에서도 보인다
        const detail = await page.context().newPage()
        await detail.goto(`/restaurant/${noodle.id}`)
        await expect(detail.getByText("을지로12길 3")).toBeVisible()
        await detail.close()

        // 주문 횟수를 끄고 저장하면 공개 화면에서 사라진다
        await page.getByRole("switch", {name: /주문 횟수/}).click()
        await page.getByRole("button", {name: "저장하기"}).click()
        await expect(page.getByText("골목을 저장했어요.")).toBeVisible()
        await visitor.reload()
        await expect(visitor.getByRole("heading", {name: "을지로 점심 골목"})).toBeVisible()
        await expect(visitor.getByText("번 먹음")).toHaveCount(0)

        // 공개를 끄면 보낸 링크가 닫힌다
        await page.getByRole("button", {name: "공개 끄기"}).click()
        await page.getByRole("dialog").getByRole("button", {name: "공개 끄기"}).click()
        await page.getByRole("dialog").getByRole("button", {name: "끄기", exact: true}).click()
        await expect(page.getByText(/공개를 껐어요/)).toBeVisible()
        await visitor.reload()
        await expect(visitor.getByText("열 수 없는 골목이에요")).toBeVisible()
    })

    test("음식점 상세에서 골목에 담는다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto("/guides")
        await page.getByLabel("새 골목").fill("야식 골목")
        await page.getByRole("button", {name: "골목 만들기"}).click()
        await expect(page.getByText("골목 꾸미기")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByRole("button", {name: "음식점 메뉴 열기"}).click()
        await page.getByRole("button", {name: "골목에 담기"}).click()
        await page.getByRole("dialog").getByRole("button", {name: /야식 골목/}).click()
        await expect(page.getByText("'야식 골목'에 담았어요.")).toBeVisible()

        await page.goto("/guides")
        await expect(page.getByRole("button", {name: /야식 골목/})).toContainText("1곳")
    })
})
