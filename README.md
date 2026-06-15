# @desk/platform — DeskCloud 플랫폼 코어

모든 DeskCloud SaaS(TermsDesk · SurveyDesk · ChangelogDesk · ReviewDesk · NotifyDesk ·
MediaDesk · ModerationDesk · RealtimeDesk · SearchDesk · Community · Chat)가 공유하는
**멀티테넌트 + 빌링/수익화 기반**입니다. SurveyDesk의 형제 컨벤션(pnpm 워크스페이스 ·
packages/* Zod 계약 · NestJS + Drizzle PGlite 폴백 · ZodValidationPipe · AdminTokenGuard ·
helmet/throttler)을 그대로 따릅니다.

> 각 Desk는 자기 도메인을 소유합니다. 플랫폼은 **테넌트·API 키·CORS allowlist·사용량 미터링**과
> **플랜·구독·결제(빌링)**를 제공합니다. Desk는 `tenant.plan`을 읽어 한도를 강제합니다.

## 무엇을 주는가

- **(a) 멀티테넌트 코어** — 테넌트/조직, publishable + secret API 키, CORS allowlist, 사용량 미터링.
- **(b) 빌링/수익화 레이어** — 플랜·어댑터·한도 집행. 모든 Desk를 수익 상품으로 전환.

## 패키지 구성

| 경로 | 이름 | 역할 |
| --- | --- | --- |
| `packages/shared` | `@desk/shared` | 순수 Zod 스키마 · 도메인 타입 · 유틸(키 해시·slug·플랜 한도 맵). 프레임워크 무관. |
| `packages/core` | `@desk/core` | 멀티테넌트 프리미티브(키 발급/검증/회전 · CORS allowlist · UsageMeter) + NestJS 어댑터(가드/프로바이더). |
| `packages/billing` | `@desk/billing` | 플랜 정의 · 결제 어댑터(stub/toss/stripe — TEST/STUB 전용) · 한도 집행 헬퍼. *(Stage 2)* |
| `apps/api` | `@desk/api` | 중앙 계정/빌링 서비스(NestJS + Drizzle, 부팅 마이그레이터 + 시드). |
| `apps/web` | `@desk/web` | 가격(pricing) + 테넌트 빌링 대시보드. *(Stage 2)* |
| `vendor/` | — | npm publish 불가 대비 **벤더 단일파일**(PlanLimit 맵 · `Powered by DeskCloud` 배지). |

## 스택

- pnpm 워크스페이스 · Node ≥ 24 · pnpm 11 · TypeScript 6
- **apps/api** — NestJS 11 + Drizzle ORM · 자체 ZodValidationPipe · helmet · compression · throttler
- DB: `DATABASE_URL` 있으면 PostgreSQL, 비어 있으면 **PGlite 임베드 폴백**(Postgres·Docker 불필요)

## 도메인 (Stage 1)

- **Tenant/Org**: `{ id, name, slug, publishableKey, secretKeyHash, corsOrigins[], plan, createdAt }`.
  publishable 키(`pk_…`)는 공개 안전(프론트 임베드), secret 키(`sk_…`)는 서버 전용(해시 저장).
- **Member/seat**: 유료 티어의 팀 좌석 — `{ tenantId, email, role, createdAt }`.
- **ApiKey**: 발급/검증(해시)/회전. publishable 평문 저장, secret 은 SHA-256(+pepper) 해시만 저장.
- **UsageMeter**: `record(metric, n)` · `getUsage(period)` · `reset()`. 테넌트별·기간별 사용량.

## API (Stage 1)

전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 는 프리픽스 제외.

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/tenants` | 가입(테넌트 생성) — secret 키는 **이때 1회만** 평문 반환 | 공개 |
| GET | `/api/tenant` | 내 테넌트 조회 | `Authorization: Bearer sk_…` |
| PUT | `/api/tenant` | 테넌트 수정(name·corsOrigins) | secret 키 |
| POST | `/api/tenant/rotate-keys` | 키 회전 — 새 secret 키 1회 반환 | secret 키 |
| GET | `/api/usage` | 사용량 조회(기간별) | secret 키 |

## 로컬 실행

```bash
pnpm install
cp .env.example .env       # 기본값으로 PGlite 폴백(추가 설정 불필요)
pnpm run build:libs        # @desk/shared·core·billing 빌드(타입 의존)
pnpm dev                   # api 가 PORT(기본 6090)에서 기동
```

self-hosted 모드(기본)는 첫 부팅 시 데모 테넌트(Free 1 + Pro 1)를 시드합니다.

```bash
# 가입(secret 키는 응답에서 1회만)
curl -X POST http://localhost:6090/api/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","slug":"acme"}'

# 내 테넌트 (위 응답의 secretKey 사용)
curl http://localhost:6090/api/tenant -H "authorization: Bearer sk_..."

# 사용량
curl http://localhost:6090/api/usage -H "authorization: Bearer sk_..."

# 키 회전
curl -X POST http://localhost:6090/api/tenant/rotate-keys -H "authorization: Bearer sk_..."
```

## 검증

```bash
pnpm run verify   # typecheck + test + build
```

## 안전

- 다른 레포 절대 건드리지 않음. **neon.tech URL 금지**(로컬은 PGlite 또는 qa-postgres:5433).
- **실제 Toss/Stripe·시크릿 키 금지** — 빌링 어댑터는 TEST/STUB 모드, 플레이스홀더 env만.
- 포트는 FREE 하이포트만(기본 API 6090). 띄운 서버는 반드시 종료.
