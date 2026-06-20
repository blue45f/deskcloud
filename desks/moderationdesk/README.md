# ModerationDesk

> 멀티테넌트 **콘텐츠 모더레이션 SaaS**(또는 셀프호스팅). 외부 서비스가 가입 한 번으로
> publishable 키를 받아 텍스트를 검사·신고하고, secret 키로 규칙·신고·로그를 관리한다.
> 규칙 기반(금칙어/정규식)은 항상, Claude(Anthropic) AI 보조는 키가 있으면 선택 적용.

SurveyDesk / ReviewDesk / TermsDesk 와 같은 형제 앱 생태계 컨벤션을 따른다.

## 핵심 개념

- **외부 온보딩**: 테넌트가 `POST /api/tenants` 로 셀프 가입 → **publishable 키(`pk_…`)**
  (브라우저/서버에서 검사·신고)와 **secret 키(`sk_…`)**(서버 전용, 관리)를 발급받는다.
  secret 은 가입 응답에서 **단 한 번만** 평문 노출되고, DB 에는 SHA-256 해시만 저장된다.
- **모더레이션 검사** (`POST /api/moderate`): 금칙 규칙(exact/substring/regex)을 매칭해
  `{ verdict, matchedRules, aiScore? }` 를 반환한다. verdict 우선순위는 `block > flag > allow`.
  `ANTHROPIC_API_KEY` 가 있으면 작고 저렴한 Claude 모델로 독성 점수를 추가 산출하고, 점수가
  높으면 verdict 를 `flag` 로 격상한다. **키가 없으면 규칙 기반만으로 완전 동작**(하드페일 없음).
- **신고**(`POST /api/reports`): 공개 키로 신고 접수 → 어드민이 `open → reviewing →
  resolved | dismissed` 로 전이한다.
- **로그**: 모든 검사가 `moderation_logs` 에 적재되어 어드민이 조회한다.

## 빠른 시작

```bash
pnpm install
pnpm dev          # shared 빌드 후 api(+web) watch. DATABASE_URL 비면 PGlite로 즉시 부팅.
```

self-hosted 모드는 첫 부팅 시 데모 테넌트(`pk_demo`/`sk_demo`)와 금칙 규칙·샘플 신고/로그를
자동 시드한다. API 는 기본 `http://localhost:4092`, Swagger 는 `/api/docs`.

### 빠른 cURL 데모

```bash
# 1) 가입 — pk/sk 발급(sk 는 1회만 노출)
curl -s -XPOST localhost:4092/api/tenants -H 'content-type: application/json' \
  -d '{"name":"Acme","corsOrigins":["*"]}'

# 2) 검사 — 데모 테넌트 pk 로(깨끗한 텍스트는 allow)
curl -s -XPOST localhost:4092/api/moderate -H 'x-pk: pk_demo' \
  -H 'content-type: application/json' -d '{"text":"hello there"}'

# 3) 검사 — 금칙어 포함(block)
curl -s -XPOST localhost:4092/api/moderate -H 'x-pk: pk_demo' \
  -H 'content-type: application/json' -d '{"text":"this is spam, visit example.spam"}'

# 4) 신고 접수(pk + Origin)
curl -s -XPOST localhost:4092/api/reports -H 'x-pk: pk_demo' -H 'origin: https://demo.example' \
  -H 'content-type: application/json' \
  -d '{"subjectType":"comment","subjectId":"c_1","reason":"abuse"}'

# 5) 어드민 신고 목록·전이(sk)
curl -s localhost:4092/api/admin/reports -H 'x-sk: sk_demo'
```

## 아키텍처

| 패키지              | 설명                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `packages/shared`   | Zod 스키마 · 도메인 타입 · 순수 규칙 매칭 유틸(`matchRules`). tsup 빌드. |
| `apps/api`          | NestJS 11 + Drizzle. PGlite 폴백 부팅 마이그레이터 + 시드.            |

DB 는 `DATABASE_URL` 이 있으면 PostgreSQL, 없으면 PGlite 임베드로 폴백한다. 마이그레이션은
`src/db/migrations.ts` 의 문자열 SQL 상수를 `_migrations` 추적으로 양쪽에 동일 적용한다.

## API 개요 (프리픽스 `/api`)

| 메서드 · 경로                         | 인증              | 설명                                            |
| ------------------------------------- | ----------------- | ----------------------------------------------- |
| `POST /tenants`                       | 공개              | 테넌트 셀프 가입(pk + sk 발급)                  |
| `POST /moderate`                      | pk **또는** sk    | 텍스트 검사 → `{verdict, matchedRules, aiScore?}` |
| `POST /reports`                       | pk + Origin       | 신고 접수                                        |
| `GET /admin/reports`                  | sk / 글로벌 토큰  | 신고 목록(필터·페이지네이션)                    |
| `PATCH /admin/reports/:id`            | sk / 글로벌 토큰  | 신고 상태/메모 갱신                             |
| `GET·POST·PATCH·DELETE /admin/rules`  | sk / 글로벌 토큰  | 금칙 규칙 CRUD                                  |
| `GET·PUT /admin/tenant`               | sk / 글로벌 토큰  | 테넌트 설정 조회/수정                          |
| `POST /admin/tenant/rotate-keys`      | sk / 글로벌 토큰  | 키 회전(새 pk/sk, 기존 즉시 무효)              |
| `GET /admin/logs`                     | sk / 글로벌 토큰  | 모더레이션 로그 조회                           |

## 검증 게이트

```bash
pnpm run verify   # typecheck + test + build
```

## 라이선스

UNLICENSED (포트폴리오/데모 용도).
