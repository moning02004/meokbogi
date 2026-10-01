import {expect, Page, test} from "@playwright/test";
import {Api, category, createUser, daysAgo, loginUi} from "./helpers";

// 음식점 등록·수정 화면의 카테고리: 수정 화면처럼 모두 펼쳐 두고 눌러서 여러 개 고른다
const categoryChip = (page: Page, keyword: string) =>
    page.getByRole("group", {name: /^카테고리/}).getByRole("button", {name: keyword, exact: true})

async function pickCategories(page: Page, keywords: string[]) {
    for (const keyword of keywords) {
        await categoryChip(page, keyword).click()
        await expect(categoryChip(page, keyword)).toHaveAttribute("aria-pressed", "true")
    }
}

test.describe("음식점과 리뷰", () => {
    test("음식점을 등록하고, 아래 기록 버튼으로 시트를 열어 리뷰를 남긴다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        await api.createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "음식점등록"}).click()
        await pickCategories(page, ["치킨"])
        await page.getByLabel(/^이름/).fill("교촌치킨")
        await page.getByRole("button", {name: "등록", exact: true}).click()
        await expect(page).toHaveURL(/\/restaurant\/\d+$/)
        const restaurantId = Number(page.url().split("/").pop())

        // 화면 아래 고정 버튼 → 바텀시트
        await page.getByRole("button", {name: "먹은 메뉴 기록하기"}).click()
        const sheet = page.getByRole("dialog", {name: "먹은 메뉴 기록"})
        await expect(sheet).toBeVisible()
        // 저장 버튼은 시트 맨 아래, 화면 안에 있다
        await expect(sheet.getByRole("button", {name: "기록하기"})).toBeInViewport()

        await sheet.getByRole("combobox", {name: /^메뉴/}).fill("허니콤보")
        await sheet.getByRole("radio", {name: "만족"}).click()
        await sheet.getByLabel("한줄평").fill("바삭함")
        await sheet.getByRole("button", {name: "기록하기"}).click()

        await expect(page.getByText("기록했어요.")).toBeVisible()
        await expect(sheet).toBeHidden()
        await expect(page.getByRole("button", {name: /허니콤보.*리뷰 1/})).toBeVisible()
        expect((await api.reviews(restaurantId)).results[0]).toMatchObject({menu: "허니콤보", point: 1})
    })

    test("'또 먹었어요'는 그 메뉴와 지난번 만족도가 선택된 시트를 연다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await api.createReview(restaurant.id, {menu: "레드콤보", point: 0, ordered_at: daysAgo(7)})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByRole("button", {name: "레드콤보 또 먹었어요"}).click()

        const sheet = page.getByRole("dialog", {name: "레드콤보 또 먹었어요"})
        await expect(sheet.getByRole("combobox", {name: /^메뉴/})).toHaveValue("레드콤보")
        await expect(sheet.getByRole("radio", {name: "보통"})).toHaveAttribute("aria-checked", "true")
        await expect(sheet.getByRole("button", {name: /먹은 날 오늘/})).toBeVisible()

        // 이번엔 만족으로 바꿔서 저장
        await sheet.getByRole("radio", {name: "만족"}).click()
        await sheet.getByRole("button", {name: "기록하기"}).click()
        await expect(page.getByRole("button", {name: /레드콤보.*리뷰 2/})).toBeVisible()

        const reviews = (await api.reviews(restaurant.id)).results
        expect(reviews.map((review) => [review.menu, review.point])).toEqual([["레드콤보", 1], ["레드콤보", 0]])
    })

    test("메뉴를 비우고 저장하면 시트 안에서 알려준다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByRole("button", {name: "먹은 메뉴 기록하기"}).click()
        await page.getByRole("dialog").getByRole("button", {name: "기록하기"}).click()
        await expect(page.getByRole("alert")).toHaveText("드신 메뉴를 입력해주세요.")
        expect((await api.reviews(restaurant.id)).count).toBe(0)
    })

    test("기록 버튼을 연타해도 리뷰는 하나만 생긴다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByRole("button", {name: "먹은 메뉴 기록하기"}).click()
        await page.getByRole("dialog").getByRole("combobox", {name: /^메뉴/}).fill("후라이드")
        await page.getByRole("dialog").getByRole("button", {name: "기록하기"}).dblclick()
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
        await page.getByRole("tab", {name: "리뷰 보기"}).click()
        await expect(page.getByText("그냥 그럼")).toBeVisible()

        await page.getByRole("button", {name: "리뷰 메뉴 열기"}).click()
        await page.getByRole("button", {name: "리뷰 수정"}).click()
        const sheet = page.getByRole("dialog", {name: "리뷰 수정"})
        await expect(sheet.getByLabel("한줄평")).toHaveValue("그냥 그럼")
        await sheet.getByLabel("한줄평").fill("다시 먹어보니 맛있음")
        await sheet.getByRole("radio", {name: "만족"}).click()
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
        await page.getByRole("button", {name: "먹은 메뉴 기록하기"}).click()
        const sheet = page.getByRole("dialog")
        // 메뉴가 미리 나열되지는 않고, 메뉴 칸을 눌러야 고를 수 있는 상자가 열린다
        await expect(sheet.getByRole("listbox", {name: "메뉴 고르기"})).toHaveCount(0)
        await sheet.getByRole("combobox", {name: /^메뉴/}).click()
        await expect(sheet.getByRole("option", {name: /간장치킨/})).toBeVisible()
        await sheet.getByRole("combobox", {name: /^메뉴/}).fill("간장 치킨")
        await expect(sheet.getByText("‘간장치킨’(으)로 합쳐서 기록돼요.")).toBeVisible()
        await sheet.getByRole("button", {name: "기록하기"}).click()
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
        // 다른 카테고리를 골라도 이름 검색은 장소 전체에서 한다
        await pickCategories(page, ["피자"])
        await page.getByLabel(/^이름/).fill("숨은")
        await expect(page.getByText("이름이 비슷한 음식점이 이미 있어요", {exact: false})).toBeVisible()
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

    test("메뉴는 상자에서 고르거나 새로 입력하고, 날짜는 달력에서 고른다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        const restaurant = await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await api.createReview(restaurant.id, {menu: "허니콤보", point: 1, ordered_at: daysAgo(5)})
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto(`/restaurant/${restaurant.id}`)
        await page.getByRole("button", {name: "먹은 메뉴 기록하기"}).click()
        const sheet = page.getByRole("dialog")
        const menu = sheet.getByRole("combobox", {name: /^메뉴/})

        // 기존 메뉴 고르기
        await menu.click()
        await sheet.getByRole("option", {name: /허니콤보/}).click()
        await expect(menu).toHaveValue("허니콤보")
        await expect(sheet.getByRole("listbox")).toHaveCount(0)

        // 직접 입력하면 그 메뉴를 쓴다
        await menu.fill("반반콤보")
        await expect(sheet.getByRole("option", {name: /반반콤보.*새 메뉴로 쓰기/})).toBeVisible()
        await sheet.getByRole("option", {name: /반반콤보/}).click()
        await expect(menu).toHaveValue("반반콤보")

        // 날짜는 버튼을 누르면 달력이 바로 열린다. 지난달 15일을 고른다.
        await sheet.getByRole("button", {name: /먹은 날 오늘/}).click()
        await sheet.getByRole("button", {name: "이전 달"}).click()
        await sheet.locator(".react-datepicker__day--015:not(.react-datepicker__day--outside-month)").click()
        const lastMonth = new Date()
        lastMonth.setDate(1)
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        await expect(sheet.getByRole("button", {name: new RegExp(`먹은 날 ${lastMonth.getMonth() + 1}월 15일`)})).toBeVisible()

        await sheet.getByRole("button", {name: "기록하기"}).click()
        await expect(page.getByText("기록했어요.")).toBeVisible()
        const saved = (await api.reviews(restaurant.id)).results.find((review) => review.menu === "반반콤보")
        const pad = (n: number) => String(n).padStart(2, "0")
        expect(saved).toMatchObject({ordered_at: `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}-15`})
    })

    test("카테고리를 여러 개 붙이면 각 카테고리에서 모두 보인다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        await api.createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.getByRole("button", {name: "음식점등록"}).click()
        await pickCategories(page, ["분식", "돈까스"])
        await page.getByLabel(/^이름/).fill("김밥천국")
        await page.getByRole("button", {name: "등록", exact: true}).click()

        await expect(page).toHaveURL(/\/restaurant\/\d+$/)
        await expect(page.getByText("분식 · 돈까스", {exact: false})).toBeVisible()

        await page.goto("/restaurant")
        for (const keyword of ["분식", "돈까스"]) {
            await page.getByRole("button", {name: keyword, exact: true}).click()
            await expect(page.getByText("김밥천국")).toBeVisible()
            await expect(page.getByText("총 1곳")).toBeVisible()
        }
        await page.getByRole("button", {name: "한식", exact: true}).click()
        await expect(page.getByText("총 0곳")).toBeVisible()
    })

    test("이름 칸을 누르면 등록된 음식점이 바로 보이고, 카테고리를 고르면 그 카테고리로 좁혀진다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await api.createRestaurant(zone.id, category(zone, "치킨").id, "BBQ")
        await api.createRestaurant(zone.id, category(zone, "피자").id, "미뜨레피자")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto("/restaurant/add")
        // 카테고리를 고르기 전에도 이름을 쓸 수 있고, 누르면 장소 전체 목록
        const name = page.getByLabel(/^이름/)
        await expect(name).toBeEnabled()
        await name.click()
        await expect(page.getByText("등록된 음식점이에요. 눌러서", {exact: false})).toBeVisible()
        for (const restaurant of ["교촌치킨", "BBQ", "미뜨레피자"]) {
            await expect(page.getByRole("button", {name: new RegExp(restaurant)})).toBeVisible()
        }

        // 카테고리를 고르면 그 카테고리 것만
        await pickCategories(page, ["치킨"])
        await name.click()
        await expect(page.getByText("이 카테고리에 등록된 음식점이에요", {exact: false})).toBeVisible()
        await expect(page.getByRole("button", {name: /교촌치킨/})).toBeVisible()
        await expect(page.getByRole("button", {name: /미뜨레피자/})).toHaveCount(0)

        // 이름을 치면 장소 전체에서 비슷한 이름 (다른 카테고리여도 중복 등록을 막는다)
        await name.fill("미뜨레")
        await expect(page.getByText("이름이 비슷한 음식점이 이미 있어요", {exact: false})).toBeVisible()
        await page.getByRole("button", {name: /미뜨레피자/}).click()
        await expect(page).toHaveURL(/\/restaurant\/\d+$/)
    })

    test("등록 화면에서 없는 카테고리를 바로 만들어 고른다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto("/restaurant/add")
        await page.getByRole("button", {name: "+ 새 카테고리"}).click()
        await page.getByLabel("새 카테고리 이름").fill("샐러드")
        await page.getByRole("button", {name: "추가", exact: true}).click()
        await expect(page.getByText("'샐러드' 카테고리를 만들었어요.")).toBeVisible()
        await expect(categoryChip(page, "샐러드")).toHaveAttribute("aria-pressed", "true")

        // 공백만 다른 이름은 새로 만들지 않고 있는 걸 고른다
        await page.getByRole("button", {name: "+ 새 카테고리"}).click()
        await page.getByLabel("새 카테고리 이름").fill("샐 러드")
        await page.getByRole("button", {name: "추가", exact: true}).click()
        await expect(page.getByRole("group", {name: /^카테고리/}).getByRole("button", {name: /샐\s?러드/})).toHaveCount(1)

        await page.getByLabel(/^이름/).fill("샐러디")
        await page.getByRole("button", {name: "등록", exact: true}).click()
        await expect(page).toHaveURL(/\/restaurant\/\d+$/)
        await expect(page.getByText("샐러드", {exact: true})).toBeVisible()
    })

    test("설명은 여러 줄로 쓰고, 상세에서는 두 줄까지 보이다가 더보기로 펼친다", async ({page, request}) => {
        const user = createUser()
        await (await Api.login(request, user)).createZone("우리집")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto("/restaurant/add")
        await pickCategories(page, ["치킨"])
        await page.getByLabel(/^이름/).fill("교촌치킨")
        const description = page.getByLabel(/^설명/)
        await expect(description).toHaveAttribute("rows", "2")
        await description.fill("양념은 따로\n순살은 역삼점이 더 바삭\n콜라는 큰 걸로\n소스 추가")
        await page.getByRole("button", {name: "등록", exact: true}).click()
        await expect(page).toHaveURL(/\/restaurant\/\d+$/)

        await expect(page.getByText("양념은 따로", {exact: false})).toBeVisible()
        const more = page.getByRole("button", {name: "더보기"})
        await expect(more).toBeVisible()
        await more.click()
        await expect(page.getByRole("button", {name: "접기"})).toBeVisible()
    })

    test("목록에서 바로 음식점을 고치고 저장한다", async ({page, request}) => {
        const user = createUser()
        const api = await Api.login(request, user)
        const zone = await api.createZone("우리집")
        await api.createRestaurant(zone.id, category(zone, "치킨").id, "교촌치킨")
        await loginUi(page, user)
        await expect(page.getByText("우리집 기록")).toBeVisible()

        await page.goto("/restaurant")
        await page.getByRole("button", {name: "교촌치킨 메뉴 열기"}).click()
        await page.getByRole("button", {name: "음식점 수정"}).click()
        const sheet = page.getByRole("dialog", {name: "음식점 수정"})
        await expect(sheet.getByLabel(/^이름/)).toHaveValue("교촌치킨")
        await expect(categoryChip(page, "치킨")).toHaveAttribute("aria-pressed", "true")
        await sheet.getByLabel(/^이름/).fill("교촌")
        await categoryChip(page, "분식").click()
        await sheet.getByRole("button", {name: "저장하기"}).click()

        await expect(page.getByText("음식점 정보를 저장했어요.")).toBeVisible()
        await expect(sheet).toBeHidden()
        await expect(page.getByText("교촌", {exact: true})).toBeVisible()
        await expect(page.getByText("치킨 · 분식 음식점")).toBeVisible()
    })
})
