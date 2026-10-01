import {defineConfig, devices} from "@playwright/test";
import {API_DIR, API_HOST, API_PORT, PUSH_API_TOKEN, PYTHON, WEB_PORT} from "./e2e/env";

// 실제 Django API(E2E 전용 SQLite)와 Next 프로덕션 빌드를 띄워 놓고 브라우저로 돈다.
//   npm run e2e                 빌드부터
//   E2E_SKIP_BUILD=1 npm run e2e  이미 빌드했으면 건너뛰기

const apiEnv = {DJANGO_SETTINGS_MODULE: "meokbogi_api.settings.e2e", PUSH_API_TOKEN}
const build = process.env.E2E_SKIP_BUILD ? "" : "npm run build && "

export default defineConfig({
    testDir: "./e2e",
    // 같은 SQLite 파일을 쓰므로 한 번에 하나씩 돈다
    workers: 1,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    expect: {timeout: 7_000},
    reporter: process.env.CI ? [["github"], ["html", {open: "never"}]] : "list",
    use: {
        baseURL: `http://localhost:${WEB_PORT}`,
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        // 주 사용 환경이 휴대폰 홈 화면 앱이라 모바일 크기로 돈다
        {name: "mobile-chrome", use: {...devices["Pixel 7"]}},
    ],
    webServer: [
        {
            // 실행마다 빈 DB에서 시작한다
            command: `rm -f e2e.sqlite3 && "${PYTHON}" manage.py migrate --noinput -v0 && "${PYTHON}" manage.py runserver ${API_PORT} --noreload`,
            cwd: API_DIR,
            env: apiEnv,
            url: `${API_HOST}/check`,
            reuseExistingServer: false,
            timeout: 120_000,
        },
        {
            command: `${build}npx next start -p ${WEB_PORT}`,
            env: {NEXT_PUBLIC_API_HOST: API_HOST},
            url: `http://localhost:${WEB_PORT}/login`,
            reuseExistingServer: !process.env.CI,
            timeout: 300_000,
        },
    ],
});
