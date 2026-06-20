# ReviewDesk

멀티테넌트 **평점·리뷰·후기(testimonials) 수집 SaaS**(또는 셀프호스팅). SurveyDesk/TermsDesk/
ChangelogDesk의 자매 프로젝트로, 같은 형제 앱 생태계 안에서 동작합니다. **외부 서비스가 직접
가입**해 발급받은 키로 리뷰를 모으고, 별점 요약·후기 월(wall)을 자기 사이트에 노출하며,
운영자는 검수(승인/거절/추천/답글)와 집계를 합니다.

> ReviewDesk는 리뷰 **수집·검수·집계·게시**만 담당합니다. 각 테넌트가 자신의 리뷰를 소유합니다.

## 스택

- pnpm 워크스페이스 · Node ≥ 24 · pnpm 11
- **apps/api** — NestJS 11 + Drizzle ORM · nestjs-zod 검증 · helmet · throttler
- **packages/shared** — Zod 스키마 · 도메인 타입 · 집계 유틸 (api·web·widget 공유)
- DB: `DATABASE_URL` 있으면 PostgreSQL, 비어 있으면 **PGlite 임베드 폴백**(Postgres·Docker 불필요)

## 외부 고객 온보딩 (멀티테넌트)

1. 테넌트가 `POST /api/tenants` 로 셀프 가입 → **publishable 키**(`pk_...`, 브라우저 안전:
   제출 + 승인본 읽기)와 **secret 키**(`sk_...`, 검수·CRUD)를 받습니다.
   secret 키는 **가입 시 1회만** 평문 노출되고, 서버에는 SHA-256 해시만 저장됩니다.
2. 테넌트는 자기 사이트 도메인을 `corsOrigins` 허용목록에 등록합니다(`*` 면 전체 허용).
3. 위젯은 publishable 키로 리뷰를 제출하고 승인본·별점 요약을 읽습니다(Origin 검사 통과 시).
4. 무료 플랜은 누적 제출 **소프트 한도**가 있으며, 초과 시 제출이 402로 거절됩니다.

## 도메인 (멀티테넌트 — 테넌트로 격리)

- **Tenant**: `{ id, name, slug, publishableKey, secretKeyHash, corsOrigins[], plan,
  autoApprove, usageCount, createdAt }`.
- **Review**: `{ id, tenantId, subjectId(리뷰 대상 product/page/entity), subjectLabel?,
  rating(1–5), title?, body, authorName, authorEmail?(비공개), status(pending|approved|
  rejected), featured, reply?(운영자 답글), source?, meta{ pageUrl }, createdAt }`.
- **Aggregate**(테넌트×subjectId): `{ count, avgRating, distribution{1..5} }`.

## API

전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 는 프리픽스 제외.

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/tenants` | 테넌트 셀프 가입 → publishable + secret(1회) | 공개 |
| POST | `/api/reviews` | 리뷰 제출(검증·throttled, usage 증가) | publishable + Origin |
| GET | `/api/reviews?subjectId=&limit=` | subject 의 승인본 + 집계 | publishable + Origin |
| GET | `/api/reviews/wall?limit=` | 승인+추천 후기(testimonial wall) | publishable + Origin |
| GET | `/api/reviews/aggregate?subjectId=` | subject 별점 요약(배지용) | publishable + Origin |
| GET | `/api/admin/reviews` | 리뷰 목록(status/subject 필터, 페이지네이션) | secret 또는 ADMIN_TOKEN |
| PATCH | `/api/admin/reviews/:id` | 검수(approve\|reject\|feature\|reply) | secret 또는 ADMIN_TOKEN |
| DELETE | `/api/admin/reviews/:id` | 리뷰 삭제 | secret 또는 ADMIN_TOKEN |
| GET | `/api/admin/tenant` | 테넌트 설정·usage·키(공개 정보) | secret 또는 ADMIN_TOKEN |
| PUT | `/api/admin/tenant` | 설정(name·corsOrigins·autoApprove·plan) 수정 | secret 또는 ADMIN_TOKEN |
| POST | `/api/admin/tenant/rotate-keys` | 키 회전(새 pk/sk, sk 1회 노출) | secret 또는 ADMIN_TOKEN |

## 로컬 실행

```bash
pnpm install
cp .env.example .env       # 기본값으로 PGlite 폴백(추가 설정 불필요)
pnpm run build:libs        # @reviewdesk/shared 빌드(타입 의존)
pnpm dev                   # api 가 PORT(기본 4099)에서 기동
```

self-hosted 모드(기본)는 첫 부팅 시 데모 테넌트(`pk_demo`/`sk_demo`, cors `['*']`)와 두 개
subject 에 걸친 ~15개 샘플 리뷰(별점 혼합, 일부 pending/approved/featured)를 시드하므로
위젯·어드민 화면이 바로 채워집니다.

```bash
# 공개: subject 의 승인본 + 집계 (데모는 cors '*' 라 Origin 무관)
curl 'http://localhost:4099/api/reviews?subjectId=pro-plan' -H 'x-pk: pk_demo'

# 공개: 리뷰 제출
curl -X POST http://localhost:4099/api/reviews \
  -H 'content-type: application/json' -H 'x-pk: pk_demo' \
  -d '{"subjectId":"pro-plan","rating":5,"body":"정말 좋아요","authorName":"홍길동"}'

# 어드민: 리뷰 목록(secret 키)
curl 'http://localhost:4099/api/admin/reviews?status=pending' -H 'x-sk: sk_demo'

# 어드민: 글로벌 토큰으로도 가능(셀프호스트)
curl http://localhost:4099/api/admin/tenant -H "x-admin-token: $ADMIN_TOKEN"
```

## 검증

```bash
pnpm run verify   # typecheck + test + build
```
