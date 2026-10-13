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
        // 다른 장소의 음식점도 고를 수 있어야 한다
        const office = await api.createZone("회사")
        await api.createRestaurant(office.id, category(office, "한식").id, "회사앞백반")

        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()
        await page.goto("/my-info")
        await page.getByRole("button", {name: /먹골목/}).click()

        await page.getByLabel("새 골목").fill("을지로 점심 골목")
        await page.getByRole("radio", {name: "숟가락 2개"}).click()
        await expect(page.getByText("일부러 찾아갈 만한 골목")).toBeVisible()
        await page.getByRole("button", {name: "골목 만들기"}).click()
        await expect(page.getByText("골목 꾸미기")).toBeVisible()

        // 만들 때 준 등급이 들어와 있고, 꾸미면서 바꿀 수 있다
        await expect(page.getByRole("radio", {name: "숟가락 2개"})).toHaveAttribute("aria-checked", "true")
        await page.getByRole("radio", {name: "숟가락 3개"}).click()

        // 많이 간 집이 위에 온다
        await page.getByRole("button", {name: "음식점 고르기"}).click()
        const picker = page.getByRole("dialog")
        await expect(picker.getByRole("button").filter({hasText: "방문"}).first()).toContainText("진미손칼국수")
        // 처음에는 좋음 이상인 집만. 리뷰가 없는 집은 "전체"를 눌러야 나온다
        await expect(picker.getByRole("radio", {name: "좋음 이상"})).toHaveAttribute("aria-checked", "true")
        await expect(picker.getByRole("button", {name: /산들김밥/})).toHaveCount(0)
        await picker.getByRole("radio", {name: "전체"}).click()
        await expect(picker.getByRole("button", {name: /회사앞백반/})).toContainText("회사 · 한식")
        await expect(picker.getByRole("button", {name: /진미손칼국수/})).toContainText("만족")
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
        await expect(visitor.getByRole("img", {name: "숟가락 3개"})).toBeVisible()
        await expect(visitor.getByText("이 골목 때문에 그 동네에 갈 만한 골목")).toBeVisible()
        const cards = visitor.getByRole("article")
        await expect(cards).toHaveCount(2)
        await expect(cards.first()).toContainText("진미손칼국수")
        await expect(cards.first()).toContainText("2번 먹음")
        await expect(cards.first()).toContainText("바지락이 매번 넉넉해요")
        await expect(cards.first()).toContainText("을지로12길 3")
        await expect(cards.first().getByRole("list", {name: "권하는 메뉴"})).toHaveText("바지락칼국수")
        await expect(visitor.getByText("나만 보는 메모")).toHaveCount(0)
        // 로그인하지 않은 사람에게는 앱으로 돌아가는 버튼이 없다
        await expect(visitor.getByRole("button", {name: "뒤로"})).toHaveCount(0)
        // 링크 미리보기에 제목과 한 줄 소개가 뜬다
        await expect(visitor.locator('meta[property="og:title"]')).toHaveAttribute("content", "을지로 점심 골목 · 먹골목")
        await expect(visitor.locator('meta[property="og:description"]')).toHaveAttribute("content", "먹어본 집 2곳 · 먹어본 집만 골랐어요")
        await expect(visitor.locator('meta[property="og:image"]')).toHaveAttribute("content", /^http.*\/icons\/icon-512\.png$/)

        // 주인이 앱에서 "열어 보기"로 들어가면 뒤로가기가 있고, 누르면 꾸미기 화면으로 돌아온다
        await page.getByRole("button", {name: "열어 보기"}).click()
        await expect(page.getByRole("heading", {name: "을지로 점심 골목"})).toBeVisible()
        await page.getByRole("button", {name: "뒤로"}).click()
        await expect(page.getByText("골목 꾸미기")).toBeVisible()
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

    test("공개하지 않은 골목도 팜플렛 PDF로 받는다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await api.createReview(restaurant.id, {menu: "허니콤보"})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto("/guides")
        await page.getByLabel("새 골목").fill("야식 골목")
        await page.getByRole("button", {name: "골목 만들기"}).click()
        await expect(page.getByText("골목 꾸미기")).toBeVisible()

        // PDF를 만드는 라이브러리(pango)가 없는 개발 환경에서는 서버가 503을 준다. 그때는 화면 흐름만 본다.
        await page.route("**/guides/*/pdf", async (route) => {
            const response = await route.fetch()
            if (response.status() !== 503) return route.fulfill({response})
            return route.fulfill({status: 200, contentType: "application/pdf", body: "%PDF-1.4\n%%EOF"})
        })

        await page.getByRole("button", {name: "음식점 고르기"}).click()
        await page.getByRole("dialog").getByRole("button", {name: /교촌치킨/}).click()
        await page.getByRole("dialog").getByRole("button", {name: "닫기"}).click()

        // 고친 게 있으면 저장부터 한다
        await page.getByRole("button", {name: "저장하고 PDF 만들기"}).click()
        const downloading = page.waitForEvent("download")
        await page.getByRole("button", {name: "PDF 저장"}).click()
        const download = await downloading
        expect(download.suggestedFilename()).toBe("야식 골목.pdf")
        await expect(page.getByRole("button", {name: "저장됨"})).toBeVisible()

        // 다시 고치면 예전 PDF는 내밀지 않는다
        await page.getByLabel("한마디").fill("바삭해요")
        await expect(page.getByRole("button", {name: "저장하고 PDF 만들기"})).toBeVisible()
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
