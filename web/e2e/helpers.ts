import {APIRequestContext, expect, Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {API_DIR, API_HOST, PYTHON} from "./env";

// 회원가입 API가 없으므로 사용자는 manage.py로 만든다. 테스트마다 새 사용자라 서로 데이터가 섞이지 않는다.
let seq = 0
export function createUser(): { username: string; password: string } {
    const username = `e2e_${Date.now().toString(36)}_${seq++}`
    const password = "e2e-pass-1234"
    execFileSync(PYTHON, ["manage.py", "shell", "-c",
        `from django.contrib.auth.models import User; User.objects.create_user(${JSON.stringify(username)}, password=${JSON.stringify(password)}, first_name="테스터")`,
    ], {
        cwd: API_DIR,
        env: {...process.env, DJANGO_SETTINGS_MODULE: "meokbogi_api.settings.e2e"},
        stdio: "pipe",
    })
    return {username, password}
}

// 화면을 거치지 않고 데이터를 미리 깔아 두기 위한 API 클라이언트
export class Api {
    constructor(private request: APIRequestContext, private token: string) {
    }

    static async login(request: APIRequestContext, user: { username: string; password: string }) {
        const response = await request.post(`${API_HOST}/auth/obtain-token`, {data: user})
        expect(response.ok()).toBeTruthy()
        return new Api(request, (await response.json()).access_token)
    }

    private async call<T>(method: "get" | "post" | "patch", url: string, data?: unknown): Promise<T> {
        const response = await this.request[method](`${API_HOST}${url}`, {
            headers: {Authorization: `Bearer ${this.token}`},
            data,
        })
        expect(response.ok(), `${method.toUpperCase()} ${url} → ${response.status()}`).toBeTruthy()
        return response.json()
    }

    createZone(name: string) {
        return this.call<{ id: number; name: string; category: { id: number; keyword: string }[] }>(
            "post", "/zones", {name})
    }

    createRestaurant(zoneId: number, categoryId: number, name: string) {
        return this.call<{ id: number; name: string }>(
            "post", `/zones/${zoneId}/category/${categoryId}/restaurants`, {name})
    }

    createReview(restaurantId: number, review: { menu: string; point?: number; ordered_at?: string; content?: string }) {
        return this.call<{ id: number }>("post", `/restaurants/${restaurantId}/reviews`, {
            point: 1, ordered_at: daysAgo(0), content: "", ...review,
        })
    }

    reviews(restaurantId: number) {
        return this.call<{ count: number; results: { id: number; menu: string; point: number; ordered_at: string }[] }>(
            "get", `/restaurants/${restaurantId}/reviews`)
    }

    restaurants(zoneId: number) {
        return this.call<{ count: number; results: { id: number; name: string }[] }>(
            "get", `/zones/${zoneId}/restaurants`)
    }
}

export function daysAgo(days: number) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function category(zone: { category: { id: number; keyword: string }[] }, keyword: string) {
    const found = zone.category.find((c) => c.keyword === keyword)
    if (!found) throw new Error(`카테고리 없음: ${keyword}`)
    return found
}

export async function loginUi(page: Page, user: { username: string; password: string }) {
    await page.goto("/login")
    await page.getByLabel("아이디").fill(user.username)
    await page.getByLabel("비밀번호").fill(user.password)
    await page.getByRole("button", {name: "로그인"}).click()
}
