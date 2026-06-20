# ── SurveyDesk API (NestJS) ─ 빌드 컨텍스트는 저장소 루트 ──
#   docker build -f apps/api/Dockerfile -t surveydesk-api .
# (TermsDesk apps/api/Dockerfile 패턴 미러 — 멀티스테이지 + slim node:24 런타임)
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
# pnpm 11: 빌드 스크립트 승인은 pnpm-workspace.yaml(allowBuilds)에서 처리됨.
RUN pnpm install --frozen-lockfile
# 공유 라이브러리(@*/shared 등) 먼저 빌드한 뒤 nest build.
RUN pnpm run build:libs && pnpm --filter "@surveydesk/api" run build

FROM node:24-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
# 기본은 PGlite 임베드(외부 DB 불필요). DATABASE_URL 을 주면 PostgreSQL 로 전환.
ENV PORT=4000
ENV PGLITE_DIR=/data/pglite
WORKDIR /app
# 전체 워크스페이스(node_modules 심링크 + 빌드 산출물)를 그대로 복사.
COPY --from=builder /app ./
# PGlite 데이터 디렉터리(볼륨 마운트 지점) — node 사용자가 쓸 수 있게 소유권 부여.
RUN mkdir -p /data/pglite && chown -R node:node /data
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
