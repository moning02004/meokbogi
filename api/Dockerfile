FROM python:3.13-slim

# build-essential·libffi-dev: 휠이 없는 아키텍처에서 패키지를 빌드할 때만 필요하다
# libpango…: 먹골목 팜플렛 PDF(WeasyPrint)가 글자를 그릴 때 쓴다
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 내정보 화면의 "버전 정보". 릴리즈 워크플로가 태그(예: 1.2.2)와 날짜를 넘겨준다.
# 런타임에 같은 이름의 환경변수를 주면 그쪽이 우선한다.
ARG APP_VERSION=dev
ARG APP_LAST_UPDATED_AT=""
ENV APP_VERSION=${APP_VERSION}
ENV APP_LAST_UPDATED_AT=${APP_LAST_UPDATED_AT}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 팜플렛 PDF의 한글 글꼴. 받지 못하면 빌드를 멈춘다 (글꼴 없이 뜨면 PDF 글자가 네모로 나온다)
COPY scripts/fetch_fonts.py scripts/fetch_fonts.py
RUN python scripts/fetch_fonts.py

COPY . .

CMD ["gunicorn", "meokbogi_api.asgi:application", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "2", \
     "-b", "0.0.0.0:3004"]
