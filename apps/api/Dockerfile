# ── TermsDesk API (NestJS) ─ 빌드 컨텍스트는 저장소 루트 ──
# 빌드:  docker build -f apps/api/Dockerfile -t termsdesk-api .
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @termsdesk/shared run build && pnpm --filter @termsdesk/api run build

FROM node:24-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
# 전체 워크스페이스(node_modules 심링크 + 빌드 산출물)를 그대로 복사.
# (이미지 최적화 시 `pnpm deploy` 로 교체 가능 — DEPLOYMENT.md 참고)
COPY --from=builder /app ./
USER node
EXPOSE 4070
CMD ["node", "apps/api/dist/main.js"]
