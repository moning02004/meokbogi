# 먹보기 (Meokbogi)

> 먹어보고 기록하고 — 장소(zone)별로 다녀온 식당과 메뉴를 기록하고, 오늘 뭐 먹을지 못 정하겠는 날엔 뽑기로 골라주는 개인용 기록 앱

## 주요 기능

- 장소(zone) · 카테고리별로 식당을 나눠서 관리
- 식당에 방문 리뷰 작성 (만족/보통/별로 3단계 + 한줄평), 메뉴별 요약과 평균이 자동 집계됨
- 같은 메뉴 이름은 입력 시 자동완성으로 제안 (오타로 인한 메뉴 분산 방지)
- 못 정하겠는 날을 위한 메뉴 뽑기 페이지
- PWA 지원 — 모바일 브라우저에서 홈 화면에 추가하면 앱처럼 실행됨

## 기술 스택

### Backend (`api/`)

- Django 6 + Django REST Framework
- SimpleJWT 기반 인증 (access token + httponly refresh 쿠키)
- SQLite(로컬 기본값) / PostgreSQL(운영)
- Gunicorn + Uvicorn(ASGI)로 서빙

### Frontend (`web/`)

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript + Tailwind CSS 4
- Zustand (세션 스토리지 기반 상태 저장)

## 프로젝트 구조

```
zibslin/
├── api/                       # Django REST API
│   ├── apps/
│   │   ├── auth/              # 로그인/토큰 발급
│   │   ├── zone/              # 장소, 카테고리
│   │   └── restaurant/        # 식당, 리뷰
│   ├── meokbogi_api/settings/
│   │   ├── base.py            # 기본값 (SQLite, DEBUG=True)
│   │   ├── local.py           # 로컬 Postgres 개발용
│   │   └── product.py         # 운영 배포용
│   └── requirements.txt
└── web/                       # Next.js 프런트엔드
    ├── app/                   # 라우트 (App Router)
    ├── components/
    ├── store/                 # Zustand 스토어
    └── constants/routeUrl.ts  # API 엔드포인트 정의
```

## 요구 사항

- Python 3.13+
- Node.js 22+
- PostgreSQL 16 (운영 권장. 로컬에서는 SQLite로 바로 시작 가능)

## 로컬에서 바로 실행하기 (Docker 없이)

### 1. API

```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 기본 설정(SQLite, DEBUG=True)으로 바로 동작합니다.
python manage.py migrate
python manage.py createsuperuser   # 로그인용 계정 생성 — 별도 회원가입 화면은 없습니다.
python manage.py runserver 0.0.0.0:8000
```

Postgres로 개발하고 싶다면 아래 환경 변수를 지정하고 설정 모듈을 `local`로 바꿔주세요.

```bash
export DJANGO_SETTINGS_MODULE=meokbogi_api.settings.local
export DB_NAME=meokbogi
export DB_USER=meokbogi
export DB_PASSWORD=meokbogi
export DB_HOST=localhost
export DB_PORT=5432
```

### 2. Web

```bash
cd web
npm install
```

`web/.env.local` 파일을 만들어 API 주소를 지정합니다.

```
NEXT_PUBLIC_API_HOST=http://localhost:8000
```

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## Docker Compose로 실행하기

리포지토리에는 `docker-compose.yaml`을 커밋하지 않습니다(`.gitignore` 참고) — 비밀번호 같은 민감한 값이 그대로 들어가기 때문입니다. 아래 예시를 그대로 복사해서 리포지토리 루트에 `docker-compose.yaml`로 저장한 뒤, 표시된 값들을 직접 채워서 사용하세요.

```yaml
services:
  db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_DB: meokbogi
      POSTGRES_USER: meokbogi
      POSTGRES_PASSWORD: change-me
    volumes:
      - db_data:/var/lib/postgresql/data

  api:
    build:
      context: ./api
    restart: always
    environment:
      DJANGO_SETTINGS_MODULE: meokbogi_api.settings.product
      DJANGO_SECRET_KEY: change-me-to-a-long-random-value
      DJANGO_ALLOWED_HOSTS: localhost,127.0.0.1
      CORS_ALLOWED_ORIGINS: http://localhost:3003
      DB_NAME: meokbogi
      DB_USER: meokbogi
      DB_PASSWORD: change-me
      DB_HOST: db
      DB_PORT: 5432
    ports:
      - "3004:3004"
    depends_on:
      - db

  web:
    build:
      context: ./web
      args:
        # 브라우저가 직접 호출하는 주소입니다. 도커 내부 네트워크 이름(http://api:3004)이 아니라
        # 실제로 접속할 호스트/도메인 기준으로 지정하세요.
        NEXT_PUBLIC_API_HOST: http://localhost:3004
    restart: always
    environment:
      PORT: 3003
    ports:
      - "3003:3003"
    depends_on:
      - api

volumes:
  db_data:
```

첫 실행 후 마이그레이션과 관리자 계정 생성이 필요합니다.

```bash
docker compose up -d --build
docker compose exec api python manage.py migrate
docker compose exec api python manage.py createsuperuser
```

브라우저에서 http://localhost:3003 접속.

> `web`의 `NEXT_PUBLIC_API_HOST`는 Next.js 빌드 시점에 클라이언트 번들에 그대로 박히는 값이라, 값을 바꾸면 `web` 이미지를 다시 빌드해야 반영됩니다.

## 배포

`.github/workflows/deploy.yaml`이 GitHub Release가 publish될 때 `api`, `web` 이미지를 각각 빌드해 `ghcr.io/<owner>/meokbogi-api`, `ghcr.io/<owner>/meokbogi-web`로 푸시합니다. 서버에서는 위 compose 예시의 `build:` 항목을 `image: ghcr.io/<owner>/meokbogi-api:latest` 형태로 바꿔서 pull 후 재기동하면 됩니다.

## PWA

`web/app/manifest.ts`에 앱 매니페스트가 정의되어 있어, 모바일 브라우저에서 홈 화면에 추가하면 주소창 없이 앱처럼 실행됩니다. `/` 페이지 하단에 설치 방법 안내가 포함되어 있습니다.
