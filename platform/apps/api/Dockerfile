# ── @desk/platform API (NestJS) ─ 빌드 컨텍스트는 저장소 루트 ──
#   docker build -f apps/api/Dockerfile -t deskplatform-api .
# (TermsDesk apps/api/Dockerfile 패턴 미러 — 멀티스테이지 + slim node:24 런타임)
# 주: build:libs 가 @desk/shared·@desk/core·@desk/billing 셋을 빌드한다.
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build:libs && pnpm --filter "@desk/api" run build

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
