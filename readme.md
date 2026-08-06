# 먹보기 — 먹어보고 기록하고

> "저번에 그 집, 뭐가 맛있었더라?"
>
> 배달·외식 이력을 **장소별 / 메뉴별**로 기록하고, 못 정하는 날엔 **뽑기**로 골라주는 개인용 맛집 아카이브 PWA.

<p>
  <img alt="Django" src="https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white">
  <img alt="DRF" src="https://img.shields.io/badge/DRF-3.x-A30000?logo=django&logoColor=white">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white">
</p>

```bash
curl -fsSL https://raw.githubusercontent.com/moning02004/meokbogi/main/install.sh | bash
```

---

## 1. 왜 만들었나

공개 리뷰의 별점은 결국 남의 취향. 4.5점짜리 집이 나에겐 별로일 수 있고, "그 집은 간장치킨만 시켜야 한다"는 정보는 어느 플랫폼에도 안 남음.

원칙은 하나 — **내가 먹어본 것만** 기록.

| 흔한 문제 | 먹보기의 해결 |
| --- | --- |
| 집·회사·본가에서 주문 가능한 가게가 다른데 목록이 섞임 | **장소(Zone)** 단위로 음식점 완전 분리 |
| 가게 단위 평점으로는 무엇을 시켜야 할지 알 수 없음 | 리뷰를 **메뉴 단위**로 남기고 메뉴별 만족도 집계 |
| 별 5개 중 3개? 매번 고민되고 기준도 흔들림 | **좋음 / 보통 / 별로** 3단계로 기록 부담 최소화 |
| 결국 매번 먹던 집만 시킴 | 카테고리 **카드 뽑기**로 메뉴를 정하고, 그 메뉴를 파는 내 가게 목록으로 연결 |

---

## 2. 주요 기능

| 기능 | 설명 |
| --- | --- |
| 장소 관리 | 장소 생성 시 13개 기본 카테고리(치킨/피자/파스타/족발·보쌈/회/찜·탕/중식/분식/돈까스/일식/동남아/카레/햄버거) 자동 생성 |
| 홈 대시보드 | 등록 음식점 수, 총 리뷰 수, **이번 달 방문 횟수**, 만족도 TOP 5, 최근 방문 3곳 |
| 음식점 기록 | 등록·수정·삭제, 카테고리 이동, 방문일·메뉴·한줄평·만족도 기록 |
| 메뉴별 요약 | 같은 가게라도 `간장치킨 최고(3회) / 후라이드 무난(2회)`처럼 메뉴별 집계 |
| 뽑기 | 카드 셔플로 카테고리를 뽑고, 해당 카테고리의 내 음식점 즉시 리스트업 |
| PWA | 홈 화면에 추가하면 주소창 없이 앱처럼 실행, iOS/Android 구분 설치 안내 |
| 모바일 UI | 하단 탭바 + 플로팅 등록 버튼, 노치 영역 대응, 스켈레톤 로딩, 바텀시트 |

데이터는 `장소 → 카테고리 → 음식점 → 리뷰` 4단 구조. 한 번의 방문에서 메뉴별로 여러 건 기록 가능.

---

## 3. 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| Backend | Python 3.13, Django 6, Django REST Framework, SimpleJWT, django-cors-headers |
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Zustand, TanStack Query, react-hot-toast, vaul |
| Database | PostgreSQL 16 (개발용은 SQLite) |
| Infra | Docker / Docker Compose, Gunicorn + Uvicorn Worker, WhiteNoise, GitHub Actions → GHCR |

---

## 4. 설치

### 4-1. 한 줄 설치

```bash
curl -fsSL https://raw.githubusercontent.com/moning02004/meokbogi/main/install.sh | bash
```

필요한 것은 **Docker와 git** 뿐. 스크립트가 아래 순서로 처리.

| 단계 | 하는 일 |
| --- | --- |
| 1 | Docker / Docker Compose 설치·기동 상태 확인 |
| 2 | 소스 내려받기 (`./meokbogi`, 이미 저장소 안이면 그 디렉터리 사용) |
| 3 | 접속 호스트·포트·관리자 계정 질문 (엔터만 눌러도 기본값 진행) |
| 4 | `.env` 생성 — Django 시크릿 키·DB 비밀번호 자동 생성, `ALLOWED_HOSTS` / `CORS` / refresh 쿠키 정책을 입력한 호스트에 맞춰 자동 설정 |
| 5 | `docker-compose.yaml` 생성 — 웹·API·PostgreSQL 3개 서비스 |
| 6 | 이미지 빌드 및 컨테이너 실행 (DB 준비까지 대기) |
| 7 | DB 마이그레이션 |
| 8 | **관리자 계정 생성** 후 접속 주소·계정 정보 출력 |

끝나면 출력된 주소로 접속해 바로 로그인. 환경변수 세팅이나 계정 생성 같은 추가 작업 없음.

### 4-2. 질문 없이 설치 / 옵션 지정

```bash
# 기본값(localhost:3003, 관리자 admin, 비밀번호 자동 생성)으로 즉시 설치
curl -fsSL https://raw.githubusercontent.com/moning02004/meokbogi/main/install.sh | bash -s -- --yes

# 집안 다른 기기(휴대폰)에서도 접속하도록 LAN IP로 설치
curl -fsSL .../install.sh | bash -s -- --host 192.168.0.10 --admin-user moning --yes
```

| 옵션 | 환경변수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `--host` | `MEOKBOGI_HOST` | `localhost` | 브라우저로 접속할 호스트명/IP. `http://`를 붙여 넣어도 알아서 분리 |
| `--web-port` | `MEOKBOGI_WEB_PORT` | `3003` | 웹 포트 |
| `--api-port` | `MEOKBOGI_API_PORT` | `3004` | API 포트 |
| `--scheme` | `MEOKBOGI_SCHEME` | `http` | `https`면 refresh 쿠키를 `SameSite=None; Secure`로 자동 전환 |
| `--network` | `MEOKBOGI_NETWORK` | `meokbogi-net` | 도커 네트워크 이름. 이미 있는 네트워크면 새로 만들지 않고 그 네트워크에 연결 |
| `--project` | `MEOKBOGI_PROJECT` | `meokbogi` | compose 프로젝트 이름 = 컨테이너·볼륨 이름의 접두사. 설치 디렉터리 이름과 무관하게 고정되므로 다른 스택과 볼륨이 섞이지 않음 |
| `--dir` | `MEOKBOGI_DIR` | `./meokbogi` | 설치 디렉터리 |
| `--admin-user` | `MEOKBOGI_ADMIN_USER` | `admin` | 관리자 아이디 |
| `--admin-password` | `MEOKBOGI_ADMIN_PASSWORD` | 자동 생성 | 8자 이상. 컨테이너 환경변수로 전달되어 셸 히스토리에 남지 않음 |
| `--admin-name` | `MEOKBOGI_ADMIN_NAME` | `관리자` | 앱에 표시되는 이름 |
| `--yes` | `MEOKBOGI_YES` | — | 질문 없이 기본값으로 진행 |
| `--no-start` | `MEOKBOGI_NO_START` | — | 설정 파일만 생성, 빌드·실행 생략 |

### 4-3. 설치 후

| 항목 | 주소 |
| --- | --- |
| 웹 (PWA) | `http://<호스트>:3003` |
| API | `http://<호스트>:3004` |
| Django Admin | `http://<호스트>:3004/admin/` |

관리는 설치 디렉터리에서.

| 명령 | 설명 |
| --- | --- |
| `docker compose ps` | 상태 확인 |
| `docker compose logs -f api` | API 로그 |
| `docker compose restart` | 재시작 |
| `docker compose down` | 중지 |
| `docker compose down -v` | 중지 + **DB 볼륨까지 삭제** |
| `docker compose up -d --build` | `.env` 수정 후 재적용 |

- **다른 스택과 충돌 회피** — 이미 도커가 돌고 있는 환경 기준. 웹·API 포트가 다른 컨테이너에 잡혀 있으면 **그 컨테이너 이름과 함께 경고** → `--web-port` / `--api-port`로 변경. 네트워크는 `--network`로 지정하고, 이미 있는 네트워크면 `external`로 연결해 compose가 재생성·삭제하지 않음. 프로젝트 이름(`--project`)이 고정이라 **볼륨도 디렉터리 이름에 휩쓸리지 않고 분리**됨.
- **DB 계정 자동 정합** — postgres 볼륨이 이미 다른 계정으로 초기화돼 있으면 `POSTGRES_USER`/`POSTGRES_PASSWORD`는 무시되어 `password authentication failed for user ...` 로 죽음. 기동 직후 컨테이너 내부 소켓으로 접속해 앱 계정·DB를 만들거나 비밀번호를 `.env`와 맞춤. 접속 가능한 계정을 못 찾으면 `.env` 수정 또는 `down -v` 안내를 출력.
- **재실행 안전** — 같은 디렉터리에서 다시 실행하면 기존 시크릿 키와 DB를 유지한 채 재빌드 (관리자 비밀번호만 입력값으로 갱신). 소스 갱신은 `git pull` 후 재실행.
- **직접 만든 설정 보존** — 스크립트가 만들지 않은 `.env` / `docker-compose.yaml`은 덮어쓰지 않고 `.bak.<시각>`으로 백업.
- **API 주소는 빌드 시점 고정** — 웹 번들에 박히는 구조. 호스트·포트 변경 시 `.env` 수정 후 `--build`로 재빌드 필요.

---

## 5. 개발 환경에서 실행 (Docker 없이)

DB 설정 없이 **SQLite**로 바로 실행. 터미널 2개 필요.

```bash
# 터미널 A — API (http://localhost:8000)
cd api
python3 -m venv venv && source venv/bin/activate     # Python 3.13
pip install -r requirements.txt
export CORS_ALLOWED_ORIGINS="http://localhost:3000"
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

```bash
# 터미널 B — 웹 (http://localhost:3000)
cd web
npm install
echo 'NEXT_PUBLIC_API_HOST=http://localhost:8000' > .env.local
npm run dev
```

| 참고 | 내용 |
| --- | --- |
| 기본 설정 | `DJANGO_SETTINGS_MODULE` 미지정 시 SQLite(`api/db.sqlite3`) 사용 |
| PostgreSQL로 개발 | `DJANGO_SETTINGS_MODULE=meokbogi_api.settings.local` + `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` |
| 접속 주소 | 개발 설정의 `ALLOWED_HOSTS` 때문에 `127.0.0.1:8000` 대신 **`localhost:8000`** |
| npm 스크립트 | `dev`(개발 서버) / `build`(프로덕션 빌드) / `start`(빌드 결과 실행) / `lint` |

---

## 6. 설계 노트

| 주제 | 선택과 이유 |
| --- | --- |
| 인증 | refresh 토큰은 **httpOnly 쿠키로만** 오가고, 응답 본문에는 access 토큰만 담음. access 20분 / refresh 15일, 재발급 시 refresh 토큰도 회전. 로그아웃은 access 토큰이 만료된 뒤에도 쿠키를 무효화해야 하므로 인증 없이 허용 |
| 토큰 갱신 | 401이면 재발급 후 **원래 요청을 그대로 재시도** → 만료가 화면에 드러나지 않음. 동시 401이나 StrictMode 이중 실행에도 재발급 호출은 1회만 나가도록 진행 중인 요청 공유 |
| 대시보드 집계 | 홈에 필요한 값을 파이썬 루프 없이 한 번에 집계해 N+1 제거. 방문 횟수는 `(음식점, 방문일)` 유니크 개수로 계산 → 한 방문에 메뉴별 리뷰가 여러 건이어도 정확. 목록·상세가 같은 집계를 공유해 화면 간 수치 불일치 차단 |
| 권한 | 모든 조회를 사용자 기준으로 필터링, 카테고리 이동은 대상이 내 장소 소속인지 검증. 전역 기본 권한은 인증 필수 + Throttling·페이지네이션 |
| 점수 체계 | 입력은 3단계(좋음/보통/별로)로 부담 최소화, 표시는 평균을 `실망·아쉬움·무난·좋음·최고` 5단 라벨로 환산. 가게 평균과 메뉴 평균에 동일 규칙 적용 |
| 구조·운영 | 라우트 그룹으로 레이아웃 분리, 엔드포인트 중앙 관리, 설정 파일 3단(공통/로컬/운영) 분리, standalone 멀티스테이지 빌드, Release 발행 시 GHCR 자동 푸시 |

---

## 7. API

- Base URL: `http://<호스트>:3004`
- 인증: `Authorization: Bearer <access_token>` / refresh는 `refreshtoken` httpOnly 쿠키
- **모든 경로에 trailing slash 없음** (`APPEND_SLASH = False`)
- 목록 응답: DRF 표준 페이지네이션 (`count`, `next`, `previous`, `results`, 페이지당 20건)

### 7-1. 엔드포인트

| # | Method | Endpoint | 인증 | 설명 |
| --- | --- | --- | --- | --- |
| 1 | `GET` | `/check` | — | 가입된 사용자 존재 여부 (초기 부트스트랩용) |
| 2 | `POST` | `/auth/obtain-token` | — | 로그인. access 토큰 반환 + refresh 쿠키 발급 |
| 3 | `POST` | `/auth/refresh-token` | 쿠키 | access 토큰 재발급 (refresh 토큰도 회전) |
| 4 | `DELETE` | `/auth/token` | — | 로그아웃. refresh 쿠키 삭제 (`204`) |
| 5 | `GET` | `/users/me` | ✅ | 내 정보 + 누적 통계 + 앱 버전 |
| 6 | `PATCH` | `/users/me` | ✅ | 표시 이름 수정 |
| 7 | `PATCH` | `/users/me/password` | ✅ | 비밀번호 변경 (`204`) |
| 8 | `GET` | `/zones` | ✅ | 내 장소 목록 (최근 방문 순) |
| 9 | `POST` | `/zones` | ✅ | 장소 생성 + 기본 카테고리 13개 자동 생성 |
| 10 | `DELETE` | `/zones/{zone_pk}` | ✅ | 장소 삭제 (하위 전체 삭제, `204`) |
| 11 | `GET` | `/zones/{zone_pk}/dashboard` | ✅ | 홈 대시보드 집계 |
| 12 | `GET` | `/zones/{zone_pk}/category` | ✅ | 카테고리 목록 |
| 13 | `POST` | `/zones/{zone_pk}/category` | ✅ | 카테고리 추가 |
| 14 | `GET` | `/zones/{zone_pk}/restaurants` | ✅ | 장소 전체 음식점 목록 (카테고리 필터 가능) |
| 15 | `GET` | `/zones/{zone_pk}/category/{category_pk}/restaurants` | ✅ | 특정 카테고리 음식점 목록 |
| 16 | `POST` | `/zones/{zone_pk}/category/{category_pk}/restaurants` | ✅ | 음식점 등록 |
| 17 | `GET` | `/restaurants/{restaurant_pk}` | ✅ | 음식점 상세 (메뉴별 만족도 포함) |
| 18 | `PATCH` | `/restaurants/{restaurant_pk}` | ✅ | 음식점 수정 (카테고리 이동 포함) |
| 19 | `DELETE` | `/restaurants/{restaurant_pk}` | ✅ | 음식점 삭제 (`204`) |
| 20 | `GET` | `/restaurants/{restaurant_pk}/reviews` | ✅ | 리뷰 목록 (메뉴 필터 가능) |
| 21 | `POST` | `/restaurants/{restaurant_pk}/reviews` | ✅ | 리뷰 등록 |
| 22 | `DELETE` | `/restaurants/{restaurant_pk}/reviews/{review_pk}` | ✅ | 리뷰 삭제 (`204`) |

### 7-2. 인증 / 사용자

| Endpoint | 파라미터 | 위치 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/obtain-token` | `username` | body | string | ✅ | 아이디 |
| | `password` | body | string | ✅ | 비밀번호. 응답은 `access_token`, `user_id` |
| `POST /auth/refresh-token` | `refreshtoken` | cookie | string | ✅ | 없으면 `400` (`refresh 토큰이 없습니다.`) |
| `PATCH /users/me` | `first_name` | body | string | ✅ | 앱에 표시되는 이름 |
| `PATCH /users/me/password` | `current_password` | body | string | ✅ | 틀리면 `400` |
| | `new_password` | body | string | ✅ | Django 비밀번호 검증 규칙 적용 |
| | `new_password_confirm` | body | string | ✅ | `new_password`와 일치 필요 |

`GET /users/me` 응답 필드: `username`, `first_name`, `zone_count`, `restaurant_count`, `review_count`, `version`, `release_date`, `last_updated_at`

### 7-3. 장소 / 카테고리

| Endpoint | 파라미터 | 위치 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `GET /zones` | `page` | query | int | — | 기본 `1` |
| `POST /zones` | `name` | body | string(100) | ✅ | 장소 이름 (예: `우리집`) |
| `DELETE /zones/{zone_pk}` | `zone_pk` | path | int | ✅ | 내 소유 장소만 삭제 가능 |
| `GET /zones/{zone_pk}/dashboard` | `zone_pk` | path | int | ✅ | 아래 응답 필드 참고 |
| `POST /zones/{zone_pk}/category` | `keyword` | body | string(100) | ✅ | 카테고리 이름 (예: `카레`) |

`GET /zones/{zone_pk}/dashboard` 응답 필드

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id`, `name` | int, string | 장소 |
| `category` | array | 카테고리 목록 (`id`, `keyword`) |
| `restaurant_count` | int | 등록 음식점 수 |
| `review_count` | int | 리뷰 총 건수 |
| `monthly_visited_count` | int | 이번 달 방문 횟수 (같은 날 여러 리뷰는 1회) |
| `delicious_restaurants` | array | 만족도 평균 상위 5곳 |
| `recent_restaurants` | array | 최근 방문 3곳 |

### 7-4. 음식점

| Endpoint | 파라미터 | 위치 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `GET /zones/{zone_pk}/restaurants` | `category` | query | int | — | 카테고리 ID로 필터 |
| | `page` | query | int | — | 기본 `1` |
| `POST .../category/{category_pk}/restaurants` | `name` | body | string(100) | ✅ | 가게 이름 |
| | `description` | body | string(100) | — | 한 줄 메모 |
| | `address` | body | string(255) | — | 주소 |
| `PATCH /restaurants/{restaurant_pk}` | `name` | body | string(100) | — | 부분 수정 |
| | `description` | body | string(100) | — | |
| | `address` | body | string(255) | — | |
| | `category` | body | int | — | 카테고리 이동. **내 장소의 카테고리만** 허용 |

음식점 응답 필드

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `name`, `description`, `address` | string | 기본 정보 |
| `category_name` | string | 카테고리 이름 |
| `review_avg` | float | 만족도 평균 (`-1.0 ~ 1.0`) → 화면에서 `실망~최고`로 환산 |
| `review_count` | int | 리뷰 총 건수 |
| `ordered_count` | int | 서로 다른 방문일 수 |
| `latest_ordered_at` | date | 최근 방문일 |
| `menu_summaries` | array | **상세에만 포함**. 메뉴별 `menu`, `review_avg`, `review_count` |

### 7-5. 리뷰

| Endpoint | 파라미터 | 위치 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- | --- | --- |
| `GET /restaurants/{restaurant_pk}/reviews` | `menu` | query | string | — | 메뉴명 완전일치 필터 |
| | `page` | query | int | — | 기본 `1` |
| `POST /restaurants/{restaurant_pk}/reviews` | `ordered_at` | body | date(`YYYY-MM-DD`) | ✅ | 방문/주문일 |
| | `point` | body | int | ✅ | `1`(좋음) / `0`(보통) / `-1`(별로) |
| | `menu` | body | string(255) | — | 메뉴명 |
| | `content` | body | string(255) | — | 한줄평 |
| `DELETE .../reviews/{review_pk}` | `review_pk` | path | int | ✅ | — |

---

## 8. 환경 변수

install.sh가 `.env`에 자동으로 채움. 직접 배포할 때 참고.

### API

| 변수 | 기본값 | 필수 | 설명 |
| --- | --- | --- | --- |
| `DJANGO_SETTINGS_MODULE` | 공통 설정(SQLite) | — | `meokbogi_api.settings.local`(Postgres) / `.product`(운영) |
| `DJANGO_SECRET_KEY` | — | 운영 ✅ | 운영 시크릿 키 |
| `DJANGO_ALLOWED_HOSTS` | — | 운영 ✅ | 콤마 구분 **호스트명** 목록 (스킴 없음) |
| `CORS_ALLOWED_ORIGINS` | (빈 값) | 사실상 ✅ | 콤마 구분 프론트 **오리진** (스킴 포함) |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | — | Postgres ✅ | DB 접속 정보 |
| `DB_HOST` / `DB_PORT` | — | — | 예: `postgres` / `5432` |
| `REFRESH_COOKIE_SAMESITE` | `Lax` | — | 크로스 사이트면 `None` |
| `REFRESH_COOKIE_SECURE` | `false` | — | HTTPS면 `true` |
| `APP_VERSION` / `APP_RELEASE_DATE` / `APP_LAST_UPDATED_AT` | 코드 기본값 | — | `/users/me`가 반환하는 버전 표기 |

### Web

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_HOST` | ✅ | API 베이스 URL. **빌드 시점**에 번들로 주입 |

---

## 9. 프로젝트 구조

```
.
├── install.sh                          # 한 줄 설치 스크립트
├── api/                                # Django REST Framework
│   ├── meokbogi_api/settings/          # 공통 / 로컬 / 운영 분리
│   └── apps/
│       ├── auth/                       # 토큰 발급·회전·로그아웃, 내 정보, 비밀번호 변경
│       ├── zone/                       # 장소·카테고리·대시보드 집계
│       ├── restaurant/                 # 음식점·리뷰·메뉴별 요약
│       └── urls.py                     # 전체 라우팅 집약
├── web/                                # Next.js 16 App Router
│   ├── app/                            # 라우트 그룹별 레이아웃 + 페이지, PWA manifest
│   ├── components/                     # 바텀시트·모달·탭바·뽑기 카드 등
│   ├── constants/routeUrl.ts           # 엔드포인트 중앙 관리
│   ├── hooks/useAuthBootstrap.ts       # 자동 로그인 + 미인증 리다이렉트
│   ├── lib/api.ts                      # fetch 래퍼 (토큰 자동 갱신 & 재시도)
│   └── store/                          # 클라이언트 상태 (세션 단위 유지)
└── .github/workflows/deploy.yaml       # Release → GHCR 이미지 푸시
```

---
