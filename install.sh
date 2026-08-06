#!/usr/bin/env bash
#
# 먹보기(meokbogi) 설치 스크립트
#
#   curl -fsSL https://raw.githubusercontent.com/moning02004/meokbogi/main/install.sh | bash
#
# 소스 내려받기 → 설정 파일 생성 → 이미지 빌드 → DB 마이그레이션 → 관리자 계정 생성까지
# 한 번에 처리한다. 이미 설치된 디렉터리에서 다시 실행하면 기존 시크릿/DB를 유지한 채 갱신한다.
#
set -euo pipefail

REPO_SLUG="moning02004/meokbogi"
REPO_URL="${MEOKBOGI_REPO:-https://github.com/${REPO_SLUG}.git}"
BRANCH="${MEOKBOGI_BRANCH:-main}"

INSTALL_DIR="${MEOKBOGI_DIR:-}"
HOST_NAME="${MEOKBOGI_HOST:-}"
WEB_PORT="${MEOKBOGI_WEB_PORT:-}"
API_PORT="${MEOKBOGI_API_PORT:-}"
SCHEME="${MEOKBOGI_SCHEME:-}"
ADMIN_USER="${MEOKBOGI_ADMIN_USER:-}"
ADMIN_PASSWORD="${MEOKBOGI_ADMIN_PASSWORD:-}"
ADMIN_NAME="${MEOKBOGI_ADMIN_NAME:-}"
ASSUME_YES="${MEOKBOGI_YES:-0}"
NO_START="${MEOKBOGI_NO_START:-0}"

COMPOSE=""
TTY_IN=""

# ---------------------------------------------------------------- 출력 유틸

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_GREEN=$'\033[32m'
    C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_OFF=$'\033[0m'
else
    C_BOLD=""; C_DIM=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_OFF=""
fi

step() { printf '\n%s==>%s %s%s%s\n' "$C_GREEN" "$C_OFF" "$C_BOLD" "$*" "$C_OFF"; }
info() { printf '    %s\n' "$*"; }
dim() { printf '    %s%s%s\n' "$C_DIM" "$*" "$C_OFF"; }
warn() { printf '%s[!]%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
die() { printf '%s[x]%s %s\n' "$C_RED" "$C_OFF" "$*" >&2; exit 1; }

usage() {
    cat <<'EOF'
먹보기 설치 스크립트

사용법:
  ./install.sh [옵션]
  curl -fsSL https://raw.githubusercontent.com/moning02004/meokbogi/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/moning02004/meokbogi/main/install.sh | bash -s -- --host 192.168.0.10 --yes

옵션:
  --host <호스트>            브라우저로 접속할 호스트명/IP        (기본: localhost)
  --web-port <포트>          웹 포트                              (기본: 3003)
  --api-port <포트>          API 포트                             (기본: 3004)
  --scheme <http|https>      접속 스킴                            (기본: http)
  --dir <경로>               설치 디렉터리                        (기본: ./meokbogi)
  --admin-user <아이디>      관리자 아이디                        (기본: admin)
  --admin-password <비밀번호> 관리자 비밀번호                     (기본: 자동 생성)
  --admin-name <이름>        앱에 표시되는 이름                   (기본: 관리자)
  --yes, -y                  질문 없이 기본값으로 진행
  --no-start                 설정 파일만 만들고 빌드/실행은 하지 않음
  --help, -h                 이 도움말

환경변수로도 지정할 수 있습니다:
  MEOKBOGI_HOST, MEOKBOGI_WEB_PORT, MEOKBOGI_API_PORT, MEOKBOGI_SCHEME,
  MEOKBOGI_DIR, MEOKBOGI_ADMIN_USER, MEOKBOGI_ADMIN_PASSWORD,
  MEOKBOGI_ADMIN_NAME, MEOKBOGI_YES, MEOKBOGI_NO_START, MEOKBOGI_BRANCH
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --host) HOST_NAME="${2:?--host 값이 필요합니다}"; shift 2 ;;
        --web-port) WEB_PORT="${2:?--web-port 값이 필요합니다}"; shift 2 ;;
        --api-port) API_PORT="${2:?--api-port 값이 필요합니다}"; shift 2 ;;
        --scheme) SCHEME="${2:?--scheme 값이 필요합니다}"; shift 2 ;;
        --dir) INSTALL_DIR="${2:?--dir 값이 필요합니다}"; shift 2 ;;
        --admin-user) ADMIN_USER="${2:?--admin-user 값이 필요합니다}"; shift 2 ;;
        --admin-password) ADMIN_PASSWORD="${2:?--admin-password 값이 필요합니다}"; shift 2 ;;
        --admin-name) ADMIN_NAME="${2:?--admin-name 값이 필요합니다}"; shift 2 ;;
        -y|--yes) ASSUME_YES=1; shift ;;
        --no-start) NO_START=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) die "알 수 없는 옵션: $1  (--help 참고)" ;;
    esac
done

# ---------------------------------------------------------------- 입력 유틸

# curl | bash 로 실행되면 stdin이 스크립트 본문이므로 질문은 /dev/tty에서 읽는다.
setup_tty() {
    if [ "$ASSUME_YES" = "1" ]; then
        TTY_IN=""
    elif [ -t 0 ]; then
        TTY_IN="/dev/stdin"
    elif [ -e /dev/tty ] && (exec 3<>/dev/tty) 2>/dev/null; then
        TTY_IN="/dev/tty"
    else
        TTY_IN=""
        warn "대화형 입력을 쓸 수 없어 기본값으로 진행합니다."
    fi
}

ask() {  # ask <변수명> <질문> <기본값>
    local var="$1" prompt="$2" default="$3" answer=""
    if [ -n "${!var:-}" ]; then return 0; fi
    if [ -n "$TTY_IN" ]; then
        printf '    %s [%s]: ' "$prompt" "$default" > /dev/tty 2>/dev/null || printf '    %s [%s]: ' "$prompt" "$default"
        IFS= read -r answer < "$TTY_IN" || answer=""
    fi
    printf -v "$var" '%s' "${answer:-$default}" 2>/dev/null || eval "$var=\${answer:-\$default}"
}

ask_secret() {  # ask_secret <변수명> <질문>
    local var="$1" prompt="$2" first="" second=""
    if [ -n "${!var:-}" ]; then return 0; fi
    if [ -z "$TTY_IN" ]; then
        eval "$var=\$(random_string 12)"
        return 0
    fi
    while :; do
        printf '    %s (엔터: 자동 생성): ' "$prompt" > /dev/tty
        IFS= read -rs first < "$TTY_IN"; printf '\n' > /dev/tty
        if [ -z "$first" ]; then
            eval "$var=\$(random_string 12)"
            return 0
        fi
        printf '    한 번 더 입력해주세요: ' > /dev/tty
        IFS= read -rs second < "$TTY_IN"; printf '\n' > /dev/tty
        if [ "$first" = "$second" ]; then
            eval "$var=\$first"
            return 0
        fi
        warn "비밀번호가 일치하지 않습니다. 다시 입력해주세요."
    done
}

random_string() {  # random_string <길이>
    local bytes="${1:-32}" out=""
    if command -v openssl >/dev/null 2>&1; then
        out="$(openssl rand -base64 "$((bytes * 3))" | LC_ALL=C tr -dc 'A-Za-z0-9')"
    else
        out="$(head -c "$((bytes * 8))" /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9')"
    fi
    [ "${#out}" -ge "$bytes" ] || die "난수를 생성하지 못했습니다."
    printf '%s\n' "${out:0:bytes}"
}

env_value() {  # env_value <파일> <키> — 기존 .env에서 값 읽기
    local file="$1" key="$2"
    [ -f "$file" ] || return 0
    awk -v k="$key" 'index($0, k "=") == 1 { print substr($0, length(k) + 2); exit }' "$file"
}

# ---------------------------------------------------------------- 사전 점검

check_requirements() {
    step "실행 환경 확인"

    command -v docker >/dev/null 2>&1 || die "docker가 필요합니다. https://docs.docker.com/get-docker/ 를 참고해 먼저 설치해주세요."
    docker info >/dev/null 2>&1 || die "docker 데몬에 연결할 수 없습니다. Docker Desktop 또는 docker 서비스를 먼저 실행해주세요."

    if docker compose version >/dev/null 2>&1; then
        COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE="docker-compose"
    else
        die "docker compose(또는 docker-compose)가 필요합니다."
    fi

    info "docker         $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '확인됨')"
    info "compose        $($COMPOSE version --short 2>/dev/null || echo '확인됨')"
}

# ---------------------------------------------------------------- 소스 준비

fetch_source() {
    step "소스 준비"

    local target="${INSTALL_DIR:-$PWD}"

    # 이미 소스가 있는 디렉터리라면 그대로 쓴다. 로컬 수정이 날아가지 않도록 git으로 건드리지 않는다.
    if [ -d "$target/api" ] && [ -d "$target/web" ] && [ -f "$target/api/manage.py" ]; then
        INSTALL_DIR="$(cd "$target" && pwd)"
        info "기존 소스를 사용합니다: $INSTALL_DIR"
        dim "소스를 최신으로 올리려면 이 디렉터리에서 git pull 후 다시 실행하세요."
        return 0
    fi

    INSTALL_DIR="${INSTALL_DIR:-$PWD/meokbogi}"

    command -v git >/dev/null 2>&1 || die "git이 필요합니다."

    if [ -e "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
        die "$INSTALL_DIR 이 비어있지 않습니다. --dir 로 다른 경로를 지정해주세요."
    fi

    info "내려받는 중: $REPO_URL ($BRANCH)"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" >/dev/null 2>&1 \
        || die "저장소를 내려받지 못했습니다: $REPO_URL"
    INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"

    info "설치 위치     $INSTALL_DIR"
}

# ---------------------------------------------------------------- 설정 수집

collect_settings() {
    step "설정"

    local env_file="$INSTALL_DIR/.env"
    if [ -f "$env_file" ]; then
        dim "기존 .env 값을 기본값으로 사용합니다."
        HOST_NAME="${HOST_NAME:-$(env_value "$env_file" APP_HOST)}"
        WEB_PORT="${WEB_PORT:-$(env_value "$env_file" WEB_PORT)}"
        API_PORT="${API_PORT:-$(env_value "$env_file" API_PORT)}"
        SCHEME="${SCHEME:-$(env_value "$env_file" APP_SCHEME)}"
    fi

    ask HOST_NAME "접속에 사용할 호스트명 또는 IP" "localhost"

    # http://호스트 처럼 스킴까지 입력한 경우를 흔히 실수하므로 알아서 분리한다.
    case "$HOST_NAME" in
        http://*)  SCHEME="http";  HOST_NAME="${HOST_NAME#http://}" ;;
        https://*) SCHEME="https"; HOST_NAME="${HOST_NAME#https://}" ;;
    esac
    HOST_NAME="${HOST_NAME%%/*}"
    HOST_NAME="${HOST_NAME%%:*}"
    [ -n "$HOST_NAME" ] || die "호스트명이 비어 있습니다."

    ask WEB_PORT  "웹 포트" "3003"
    ask API_PORT  "API 포트" "3004"
    SCHEME="${SCHEME:-http}"
    ask ADMIN_USER "관리자 아이디" "admin"
    ask_secret ADMIN_PASSWORD "관리자 비밀번호"
    ask ADMIN_NAME "앱에 표시할 이름" "관리자"

    case "$SCHEME" in
        http|https) ;;
        *) die "--scheme 은 http 또는 https 여야 합니다 (입력: $SCHEME)" ;;
    esac
    case "$WEB_PORT$API_PORT" in
        *[!0-9]*) die "포트는 숫자여야 합니다 (웹: $WEB_PORT, API: $API_PORT)" ;;
    esac
    [ "$WEB_PORT" != "$API_PORT" ] || die "웹 포트와 API 포트가 같습니다."
    [ ${#ADMIN_PASSWORD} -ge 8 ] || die "관리자 비밀번호는 8자 이상이어야 합니다."

    WEB_ORIGIN="${SCHEME}://${HOST_NAME}:${WEB_PORT}"
    API_ORIGIN="${SCHEME}://${HOST_NAME}:${API_PORT}"

    ALLOWED_HOSTS="$HOST_NAME"
    case "$HOST_NAME" in
        localhost|127.0.0.1) ALLOWED_HOSTS="localhost,127.0.0.1" ;;
        *) ALLOWED_HOSTS="${HOST_NAME},localhost,127.0.0.1" ;;
    esac

    # 시크릿과 DB 비밀번호는 최초 1회만 생성하고 이후엔 그대로 유지한다.
    DJANGO_SECRET_KEY="$(env_value "$env_file" DJANGO_SECRET_KEY)"
    DB_PASSWORD="$(env_value "$env_file" DB_PASSWORD)"
    [ -n "$DJANGO_SECRET_KEY" ] || DJANGO_SECRET_KEY="$(random_string 50)"
    [ -n "$DB_PASSWORD" ] || DB_PASSWORD="$(random_string 24)"

    # 사이트가 다르면(=HTTPS 크로스 사이트) refresh 쿠키에 SameSite=None; Secure 가 필요하다.
    if [ "$SCHEME" = "https" ]; then
        COOKIE_SAMESITE="None"; COOKIE_SECURE="true"
    else
        COOKIE_SAMESITE="Lax"; COOKIE_SECURE="false"
    fi

    info "웹            $WEB_ORIGIN"
    info "API           $API_ORIGIN"
    info "관리자        $ADMIN_USER"
}

# ---------------------------------------------------------------- 파일 생성

GENERATED_MARKER="# install.sh 가 생성한 파일입니다."

backup_if_handwritten() {  # 사용자가 직접 만든 파일을 덮어쓰지 않는다
    local file="$1" first=""
    [ -f "$file" ] || return 0
    IFS= read -r first < "$file" || true
    case "$first" in *"$GENERATED_MARKER"*) return 0 ;; esac
    local backup="${file}.bak.$(date +%Y%m%d%H%M%S)"
    mv "$file" "$backup"
    warn "$(basename "$file") 은 직접 만든 파일로 보여 백업했습니다: $(basename "$backup")"
}

write_files() {
    step "설정 파일 생성"

    backup_if_handwritten "$INSTALL_DIR/.env"
    backup_if_handwritten "$INSTALL_DIR/docker-compose.yaml"

    umask 077
    cat > "$INSTALL_DIR/.env" <<EOF
# install.sh 가 생성한 파일입니다. 값을 바꾸면 아래 명령으로 다시 적용하세요.
#   docker compose up -d --build
APP_SCHEME=${SCHEME}
APP_HOST=${HOST_NAME}
WEB_PORT=${WEB_PORT}
API_PORT=${API_PORT}

PUBLIC_WEB_ORIGIN=${WEB_ORIGIN}
PUBLIC_API_ORIGIN=${API_ORIGIN}

DJANGO_SETTINGS_MODULE=meokbogi_api.settings.product
DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
DJANGO_ALLOWED_HOSTS=${ALLOWED_HOSTS}
CORS_ALLOWED_ORIGINS=${WEB_ORIGIN}
REFRESH_COOKIE_SAMESITE=${COOKIE_SAMESITE}
REFRESH_COOKIE_SECURE=${COOKIE_SECURE}

DB_NAME=meokbogi
DB_USER=meokbogi
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=postgres
DB_PORT=5432
EOF
    umask 022

    cat > "$INSTALL_DIR/docker-compose.yaml" <<'EOF'
# install.sh 가 생성한 파일입니다. 값은 같은 디렉터리의 .env 에서 읽습니다.
services:
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      args:
        # API 주소는 빌드 시점에 번들로 들어가므로 build args 로 전달한다.
        NEXT_PUBLIC_API_HOST: ${PUBLIC_API_ORIGIN}
    restart: always
    ports:
      - "${WEB_PORT}:3000"
    depends_on:
      - api

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    restart: always
    env_file: .env
    ports:
      - "${API_PORT}:3004"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      TZ: Asia/Seoul
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 3s
      timeout: 5s
      retries: 20

volumes:
  postgres_data:
EOF

    info ".env                  (권한 600, 시크릿 포함)"
    info "docker-compose.yaml"
}

# ---------------------------------------------------------------- 기동

start_services() {
    step "이미지 빌드 및 실행 (처음에는 몇 분 걸립니다)"
    ( cd "$INSTALL_DIR" && $COMPOSE up -d --build --remove-orphans ) \
        || die "컨테이너를 실행하지 못했습니다. '$COMPOSE logs' 로 원인을 확인해주세요."

    step "데이터베이스 마이그레이션"
    local attempt=0
    until ( cd "$INSTALL_DIR" && $COMPOSE exec -T api python manage.py migrate --noinput ) ; do
        attempt=$((attempt + 1))
        if [ "$attempt" -ge 10 ]; then
            warn "API 로그 마지막 30줄:"
            ( cd "$INSTALL_DIR" && $COMPOSE logs --tail 30 api ) || true
            die "마이그레이션에 실패했습니다."
        fi
        dim "API 기동을 기다리는 중... ($attempt/10)"
        sleep 5
    done
}

create_admin() {
    step "관리자 계정 생성"

    # 비밀번호가 프로세스 목록/셸 히스토리에 남지 않도록 컨테이너 환경변수로 전달한다.
    local result
    result="$( cd "$INSTALL_DIR" && $COMPOSE exec -T \
        -e ADMIN_USER="$ADMIN_USER" \
        -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
        -e ADMIN_NAME="$ADMIN_NAME" \
        api python manage.py shell -c '
import os
from django.contrib.auth.models import User

username = os.environ["ADMIN_USER"]
user, created = User.objects.get_or_create(username=username)
user.first_name = os.environ["ADMIN_NAME"]
user.is_staff = True
user.is_superuser = True
user.set_password(os.environ["ADMIN_PASSWORD"])
user.save()
print("created" if created else "updated")
' )" || die "관리자 계정을 만들지 못했습니다."

    case "$result" in
        *created*) info "새 계정을 만들었습니다: $ADMIN_USER" ;;
        *) info "기존 계정의 비밀번호를 갱신했습니다: $ADMIN_USER" ;;
    esac
}

summary() {
    printf '\n%s────────────────────────────────────────────────%s\n' "$C_DIM" "$C_OFF"
    printf '%s 먹보기 설치 완료%s\n' "$C_BOLD" "$C_OFF"
    printf '%s────────────────────────────────────────────────%s\n\n' "$C_DIM" "$C_OFF"
    printf '  웹(PWA)      %s\n' "$WEB_ORIGIN"
    printf '  API          %s\n' "$API_ORIGIN"
    printf '  관리자 페이지 %s/admin/\n' "$API_ORIGIN"
    printf '\n  아이디       %s\n' "$ADMIN_USER"
    printf '  비밀번호     %s\n' "$ADMIN_PASSWORD"
    printf '\n%s  설치 경로: %s%s\n' "$C_DIM" "$INSTALL_DIR" "$C_OFF"
    printf '%s  관리:      cd %s && docker compose {ps,logs -f,down}%s\n\n' "$C_DIM" "$INSTALL_DIR" "$C_OFF"
    warn "비밀번호를 안전한 곳에 옮겨 적은 뒤, 로그인해서 첫 장소(Zone)를 만들어보세요."
}

main() {
    printf '\n%s먹보기 — 먹어보고 기록하고%s\n' "$C_BOLD" "$C_OFF"
    dim "설치 스크립트 (github.com/${REPO_SLUG})"

    setup_tty
    check_requirements
    fetch_source
    collect_settings
    write_files

    if [ "$NO_START" = "1" ]; then
        step "설정 파일만 생성했습니다 (--no-start)"
        info "cd $INSTALL_DIR && $COMPOSE up -d --build"
        exit 0
    fi

    start_services
    create_admin
    summary
}

main "$@"
