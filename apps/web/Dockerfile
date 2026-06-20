# ── TermsDesk Web (Vite SPA → nginx) ─ 빌드 컨텍스트는 저장소 루트 ──
# 빌드:  docker build -f apps/web/Dockerfile -t termsdesk-web .
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# VITE_API_BASE_URL='' → 웹은 동일 출처 /api 로 호출(아래 nginx 가 api 로 프록시)
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter @termsdesk/shared run build \
  && pnpm --filter @termsdesk/sdk run build \
  && pnpm --filter @termsdesk/web run build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
