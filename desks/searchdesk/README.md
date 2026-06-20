# SearchDesk

> Hosted Search-as-a-Service — 전문 검색(full-text) · 패싯/필터 · ⌘K 커맨드 팔레트를 한 줄로 붙이는 외부 온보딩형 멀티테넌트 SaaS.

SearchDesk 는 [SurveyDesk](../surveydesk) · [NotifyDesk](../notifydesk) · [TermsDesk](../termsdesk) 의 자매
프로젝트로, 같은 형제 앱 생태계 컨벤션(pnpm 워크스페이스 · NestJS + Drizzle · PGlite 폴백)을 따릅니다.

테넌트가 셀프 가입하면 **publishable(`pk_`)** · **secret(`sk_`)** 키쌍을 받습니다.
서버에서 `sk_` 로 문서를 색인하고, 브라우저에서 `pk_` 로 검색을 호출합니다. Elastic 같은 외부
검색엔진 없이 Postgres 전문 검색 + 순수 TypeScript 랭킹/하이라이트만으로 동작합니다.

## 모노레포 구조

```
searchdesk/
├─ apps/
│  └─ api/            # NestJS 11 + Drizzle — 가입·색인·검색·어드민 API
├─ packages/
│  └─ shared/         # Zod 계약(문서·쿼리) + 순수 랭킹/하이라이트 유틸 (tsup)
└─ …                  # apps/web(대시보드)·packages/sdk·widget 은 후속 스테이지
```

## 빠른 시작

```bash
pnpm install
cp .env.example .env          # 기본값으로 PGlite 임베드 DB(설정 불필요) 사용
pnpm run build:libs           # @searchdesk/shared 먼저 빌드
pnpm --filter @searchdesk/api run dev   # API → http://localhost:4093  · docs: /api/docs
```

`DATABASE_URL` 을 비워두면 PGlite 임베드 DB로 즉시 동작합니다(Docker·Postgres 불필요).
Postgres 를 쓰려면 `DATABASE_URL` 을 채우세요 — 이때 전문 검색은 `tsvector`(GIN) 경로를 사용합니다.

## 핵심 흐름 (curl)

```bash
BASE=http://localhost:4093/api

# 1) 가입 → pk_/sk_ 발급 (secret 평문은 이 응답에서만 1회 노출)
curl -s -X POST $BASE/tenants -H 'content-type: application/json' \
  -d '{"name":"Acme Docs","corsOrigins":["*"]}'

# 2) 문서 색인 (sk_) — 단건 또는 배치
curl -s -X POST $BASE/docs -H "authorization: Bearer $SK" -H 'content-type: application/json' \
  -d '{"documents":[{"id":"d1","title":"Getting Started","body":"Install and run.","category":"docs","tags":["intro"]}]}'

# 3) 검색 (pk_ + Origin)
curl -s "$BASE/search?q=install&limit=5" -H "authorization: Bearer $PK" -H 'origin: https://app.example.com'
```

## 인증

| 경로 | 가드 | 인증 |
| --- | --- | --- |
| `GET /api/search` | `PublishableKeyGuard` | `Authorization: Bearer pk_…` + 테넌트 CORS 허용 Origin |
| `POST /api/docs`, `DELETE /api/docs/:id`, `/api/admin/*` | `SecretKeyGuard` | `Authorization: Bearer sk_…` **또는** `X-Admin-Token`(+`?tenantId`) |
| `POST /api/tenants` | 공개 | 무인증(가입) |

## 검증

```bash
pnpm run verify   # typecheck + test + build
```

## 안전

- 로컬 DB 는 PGlite(`DATABASE_URL` 비움) 또는 qa-postgres(`:5433`). neon.tech 금지.
- API 기본 포트 4093 (형제 프로젝트와 겹치지 않도록).
