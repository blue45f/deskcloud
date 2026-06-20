# ARCHITECTURE — TermsDesk

## 개요

pnpm 모노레포. `apps/web`(Vite SPA) + `apps/api`(NestJS) + `packages/shared`(Zod 계약) +
`packages/sdk`(임베드 클라이언트). 같은 코드베이스가 **self-hosted**(싱글테넌트) /
**saas**(멀티테넌트) 두 모드로 동작합니다(`TERMSDESK_MODE`).

## 데이터 모델 (Drizzle / PostgreSQL)

```
organizations ─┬─ users (RBAC: owner/admin/publisher/editor/viewer)
               ├─ api_keys (scopes: read:current / write:consent / read:consent)
               ├─ policies (slug, type, jurisdiction, current_version_id)
               │     └─ policy_versions (immutable once published)
               │           · version_number, version_label, body
               │           · content_hash  ← 게시 시 동결되는 SHA-256
               │           · status(draft/published/archived), requires_reconsent
               ├─ consent_receipts (append-only)
               │     · subject_ref(불투명 식별자, PII 아님)
               │     · policy_version_id + content_hash (무엇에 동의했나)
               │     · decision/method/locale/evidence(jsonb)/created_at
               └─ audit_events (append-only: actor, action, target, metadata)
```

### 핵심 불변식: content_hash

`policy_versions`는 **게시되면 본문·해시가 절대 바뀌지 않습니다**. 게시(`publish`) 시:

1. `computeContentHash(body)` (SHA-256, 줄바꿈만 정규화) 로 해시를 동결.
2. `status=published`, `published_at/by`, `effective_at` 설정.
3. 정책의 `current_version_id`를 이 버전으로 승격, 이전 현재본은 `archived`.

동의 영수증은 이 `content_hash`를 가리키므로 "그 사용자가 정확히 어떤 문안에
동의했는지"를 사후에 증명·재현할 수 있습니다. 게시본이 다르게 렌더되면 증거가
무효가 되므로 — 본문은 변형 없이 그대로 저장/제공합니다.

### append-only

`consent_receipts`·`audit_events`는 INSERT만 합니다. 철회/재동의는 새 행으로 쌓이며
삭제/수정하지 않습니다(규제·소송 대응 증거).

## API (NestJS 11)

- **DB 듀얼 드라이버** (`DatabaseService`): `DATABASE_URL` 있으면 `node-postgres`,
  없으면 `@electric-sql/pglite` 임베드(둘 다 Postgres 16 의미론). 부팅 시
  `src/db/migrations.ts`의 SQL을 멱등 적용.
- **인증**: 대시보드는 JWT 쿠키 세션(`SessionGuard`), 공개 게시/동의 기록은 API 키
  Bearer(`ApiKeyGuard` + scope). 권한은 `@RequirePermission`(역할 매트릭스, `shared`).
- **모듈**: auth · policies(+versions) · public(서빙) · consents · audit · apikeys ·
  members · export(CSV) · health.
- **§6.1 베이스라인**: helmet · compression · cookie-parser · throttler(120/min) ·
  graceful shutdown · pino 로깅 · Swagger(`/api/docs`) · health `/health` `/health/ready`.

### 공개 게시(서빙) 흐름

```
SDK ──GET /api/v1/policies/:slug/current?subjectRef=──▶ ApiKeyGuard(read:current)
    ◀── 현재 published 버전 + content_hash + (subjectRef 시) reconsentRequired
SDK ──POST /api/v1/consents───────────────────────────▶ ApiKeyGuard(write:consent)
    ◀── append-only 영수증(receiptId, contentHash, …)
```

`reconsentRequired` = 이 subject가 현재 해시에 'accepted' 영수증을 가졌는지의 부정.

## SDK (`@termsdesk/sdk`)

의존성 0. `createTermsDeskClient({ baseUrl, apiKey })` + React `<ConsentGate>`.
원본 PII를 받지 않습니다(`subjectRef`는 고객사가 부여하는 불투명 식별자).

## Web (Vite + React)

`createBrowserRouter` · TanStack Query · ky 클라이언트(쿠키 세션) · Radix + cva ·
Tailwind v4(`@theme` 라이트 + `.dark` 오버라이드). a11y 베이스라인(ErrorBoundary ·
스킵링크 · 라우트 포커스/announce · `document.title` · reduced-motion · `useConfirm`).
