# ── RealtimeDesk API (NestJS + socket.io) ─ 빌드 컨텍스트는 저장소 루트 ──
#   docker build -f apps/api/Dockerfile -t realtimedesk-api .
# (TermsDesk apps/api/Dockerfile 패턴 미러 — 멀티스테이지 + slim node:24 런타임)
# 주: socket.io 는 REALTIME_PATH(기본 /realtime)에 정확 매칭으로 마운트된다.
#     게이트웨이 뒤 서브패스 라우팅 시 compose 에서 REALTIME_PATH 를 서브패스로 맞춘다.
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build:libs && pnpm --filter "@realtimedesk/api" run build

FROM node:24-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
ENV PORT=4000
ENV PGLITE_DIR=/data/pglite
WORKDIR /app
COPY --from=builder /app ./
RUN mkdir -p /data/pglite && chown -R node:node /data
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
