# DEVELOPMENT — 개발 가이드

아무 Desk 나 로컬에서 빌드·실행·테스트하는 법, 공유 컨벤션, 템플릿에서 새 Desk 만들기, 그리고
벤더링 접근을 정리합니다.

> 배포는 [DEPLOY.md](./DEPLOY.md), 서비스 라우트는 [SERVICES.md](./SERVICES.md).

---

## 1. 어떤 Desk 든 로컬에서 돌리기

모든 Desk 는 같은 구조라 절차가 동일합니다(예: `surveydesk`).

```bash
cd ~/WebstormProjects/surveydesk

# 1) 설치 (pnpm 11, Node ≥ 24)
pnpm install

# 2) 공유 라이브러리 빌드 (shared/sdk/widget 가 있으면)
pnpm run build:libs      # 레포에 있을 때만

# 3) 개발 서버 — DATABASE_URL 없으면 PGlite 임베드로 자동 동작(외부 DB 불필요)
pnpm dev                 # apps/api(+ apps/web) watch 병렬

# 4) 검증 게이트
pnpm run verify          # = typecheck + test + build
```

- **PGlite 가 기본**: `DATABASE_URL` 을 비워 두면 API 가 PGlite 임베드(`PGLITE_DIR`, 기본
  `.data/pglite`)로 부팅하고, 부팅 마이그레이터 + 데모 시드(`pk_demo`/`sk_demo`)가 자동 적용됩니다.
  로컬 PostgreSQL 을 쓰려면 `DATABASE_URL=postgresql://qa:qa@localhost:5433/<desk>` (qa-postgres).
- **데모로 즉시 호출**: 가입 없이 `pk_demo`/`sk_demo`(또는 SurveyDesk 는 appId `demo`)로 바로 호출
  가능. 어드민은 self-hosted 모드에서 `X-Admin-Token`(= `.env` `ADMIN_TOKEN`).
- **API 포트**: 컨테이너에서는 `PORT=4000` 으로 통일하지만, 로컬 dev 는 각 레포가 자기 하이포트를
  씁니다(예: termsdesk 5270/4070, changelogdesk 5295, reviewdesk 5299, desk-platform API 6090).
  레포의 `.env.example`/README 확인. **저점유 포트(3000·4001·5173 등) 경합 주의** — 형제 앱과
  충돌하면 dev 포트를 바꾸세요.

### WebSocket Desk (realtime / chat) 추가 검증

```bash
node apps/api/scripts/verify-ws.mjs   # chatdesk 등 — 서버가 떠 있어야 함(WS E2E)
```

---

## 2. nest build (not tsx) — 핵심 caveat

**모든 Desk API 는 `nest build`(= nest/tsc)로 빌드합니다. tsx 로 트랜스파일하지 않습니다.**

```jsonc
// apps/api/package.json (모든 Desk 공통)
{
  "scripts": {
    "dev": "nest start --watch", // 개발: NestJS CLI watch
    "build": "nest build", // 빌드: nest/tsc → dist/  (★ tsx 아님)
    "start": "node dist/main.js", // 런타임: 컴파일된 JS 실행
    "verify": "pnpm run typecheck && pnpm run test && pnpm run build",
  },
}
```

왜 중요한가:

- NestJS 는 데코레이터 메타데이터(DI)를 빌드 타임에 emit 해야 합니다. `tsx`/단순 esbuild 로는
  `emitDecoratorMetadata` 가 누락돼 **런타임 DI 가 깨집니다**. 프로덕션은 반드시 `nest build` 산출
  `dist/main.js` 를 실행.
- Dockerfile 도 이 패턴(멀티스테이지: `nest build` → `node dist/main.js`)을 따릅니다 — 번들이
  참조하는 `apps/api/Dockerfile`.
- 관련 함정: `eslint consistent-type-imports` 가 NestJS DI 를 깰 수 있어 일부 레포는 `apps/api` 에서
  해당 룰을 끕니다. import 를 `type` 으로 강제하지 마세요(DI 토큰이 사라짐).

---

## 3. 공유 컨벤션

| 항목         | 규약                                                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 런타임       | Node ≥ 24, pnpm 11, TypeScript 6                                                                                                                                        |
| 백엔드       | NestJS 11 + Drizzle ORM, 전역 프리픽스 `/api`, 헬스 `/health`, Swagger `/api/docs`                                                                                      |
| 미들웨어     | helmet · compression · throttler · 자체 `ZodValidationPipe`(nestjs-zod 계열)                                                                                            |
| DTO/검증     | **nestjs-zod**(class-validator 아님) — Zod 스키마가 단일 소스                                                                                                           |
| DB           | `DATABASE_URL` 있으면 PostgreSQL(node-postgres), 없으면 PGlite 폴백                                                                                                     |
| 마이그레이션 | `apps/api/src/db/migrations.ts` 의 `MIGRATIONS[]`(문자열 SQL, **멱등**, `_migrations` 추적) — 파일시스템 안 읽음. 스키마 변경은 배열 끝에 `IF NOT EXISTS` 로 **append** |
| 시드         | `BootstrapService` → `runSeed`. self-hosted 모드는 데모 테넌트 멱등 시드                                                                                                |
| 키           | publishable `pk_`(평문 저장, CORS allowlist) · secret `sk_`(SHA-256 해시 저장, 1회 노출)                                                                                |
| 프론트       | Vite + React 19, `/design` 리빙 스타일가이드(`apps/web/src/router/index.tsx` 또는 동등)                                                                                 |
| 테스트       | Vitest                                                                                                                                                                  |
| 검증         | `pnpm run verify` = typecheck + test + build                                                                                                                            |
| 안전         | neon.tech URL 금지(로컬은 PGlite 또는 qa-postgres:5433), 띄운 서버는 종료, FREE 하이포트만                                                                              |

`@desk/platform` 은 추가로 `packages/core`(멀티테넌트 프리미티브 + Nest 가드)와 `packages/billing`
(플랜·한도·결제 어댑터)을 별도 패키지로 가집니다([BUSINESS-MODEL.md](./BUSINESS-MODEL.md)).

---

## 4. 템플릿에서 새 Desk 만들기

기존 Desk(예: `surveydesk` 또는 외부 온보딩형이면 `changelogdesk`)를 템플릿으로 복제하는 것이
가장 빠릅니다.

1. **스캐폴드 복제**: 가까운 Desk 를 복사하고 이름을 `<foo>desk`, 스코프를 `@foodesk/*` 로 변경.
   - `packages/shared` — Zod 스키마·도메인 타입·상수(free 캡)
   - `apps/api` — 컨트롤러(`/api/tenants`, 공개 `pk_` 라우트, `/api/admin/*` `sk_` 라우트), 가드,
     `db/migrations.ts`, `db/seed-data.ts`(데모 `pk_demo`/`sk_demo`)
   - `apps/web` — 어드민 콘솔 + `/design` 라우트
   - `packages/widget` — React 컴포넌트 + `src/iife.ts`(전역 객체) + `vite.iife.config.ts`
2. **위젯 IIFE 설정**: `packages/widget/vite.iife.config.ts` 에서 전역 이름 + 파일명 지정:
   ```ts
   build: {
     lib: {
       entry: resolve(import.meta.dirname, 'src/iife.ts'),
       name: 'FooDesk',                      // window.FooDesk
       formats: ['iife'],
       fileName: () => 'foo-widget.js',      // 로더 스크립트명
     },
     rollupOptions: { output: { extend: true, exports: 'named' } },
   }
   ```
3. **인증 패턴 선택**: publishable 키 + CORS(`PublishableKeyGuard`) + secret/Admin
   (`SecretKeyGuard`/`AdminTokenGuard`). 헤더명은 도메인에 맞게(`x-pk`/`x-sk` 또는
   `Authorization: Bearer`).
4. **free 캡 정의**: `packages/shared/src/constants.ts` 에 `FREE_PLAN_*` 상수 + env 오버라이드.
5. **Dockerfile**: `apps/api/Dockerfile` + `.dockerignore`(번들 패턴 — 멀티스테이지 `nest build` →
   `node dist/main.js`, `PORT=4000`, `PGLITE_DIR=/data/pglite`)를 복사.
6. **배포 번들에 합류**: [DEPLOY.md](./DEPLOY.md) §10 (docker-compose 블록 + Caddyfile 라우팅 +
   `<FOO>_ADMIN_TOKEN`).
7. **검증**: `pnpm run verify` 그린 확인.

---

## 5. 벤더링 접근 (npm publish 막힘 → apps-vendor 단일파일)

npm 발행이 토큰 401 로 막혀 있어, 위젯/SDK 를 npm 으로 배포하는 대신 **단일파일 벤더 산출물**로
배포합니다. 소비자(형제 앱)는 이를 복붙해 의존성 없이 씁니다.

### 두 가지 벤더링 형태

- **`apps-vendor/<Widget>.tsx`** — zero-dep 단일파일 React 컴포넌트. `packages/widget` 의 복사본.
  형제 앱이 `src/components/feedback/FeedbackWidget.tsx` 처럼 복붙해 마운트. 보유 Desk:
  surveydesk(`FeedbackWidget.tsx`), changelogdesk(`ChangelogWidget.tsx`),
  reviewdesk(`ReviewWidgets.tsx` + `vanilla-embed.html`), mediadesk(`MediaWidgets.tsx`),
  moderationdesk(`ReportButton.tsx`), realtimedesk(`PresenceBar.tsx`),
  searchdesk(`SearchPalette.tsx`), communitydesk(`CommunityBoard.tsx`), chatdesk(`ChatWidget.tsx`).
- **`vendor/<name>.ts`**(@desk/platform) — 플랜 한도 맵·"Powered by DeskCloud" 배지의 단일파일
  벤더. 각 Desk 가 복사해 써서 **드리프트 방지용 단일 소스**(`PLAN_LIMITS`).

### 바닐라 IIFE 로더

벤더 컴포넌트와 별개로, 게이트웨이가 IIFE 번들(`<host>/<desk>/<widget>.js`)을 서빙합니다. 정적
HTML 사이트는 `<script>` 한 줄로 전역 객체(`SurveyDesk`/`ChangelogDesk`/…)를 얻습니다
([SERVICES.md](./SERVICES.md) 의 Desk별 스니펫).

### 벤더링 운영 원칙

- 벤더 단일파일은 **소스(`packages/widget`/`packages/shared`)에서 파생**됩니다. 위젯 로직을 고치면
  벤더 파일도 다시 생성·복사해 드리프트를 막으세요.
- 형제 앱은 env-gated(`VITE_SURVEYDESK_URL`)로 마운트 — env 미설정 시 비활성이라 안전
  ([ECOSYSTEM.md](./ECOSYSTEM.md) §1).
- npm 발행이 다시 가능해지면 `@<desk>/widget`·`@<desk>/sdk` 로 전환하고 벤더 단일파일은 폴백으로
  남길 수 있습니다.

---

## 6. 자주 쓰는 명령 모음

```bash
pnpm install                 # 의존성
pnpm run build:libs          # 공유 라이브러리(있을 때)
pnpm dev                     # API(+web) watch
pnpm run typecheck           # 타입 체크
pnpm run test                # Vitest
pnpm run build               # nest build → dist (★ tsx 아님)
pnpm run verify              # typecheck + test + build (검증 게이트)

# DB
DATABASE_URL=postgresql://qa:qa@localhost:5433/<desk> pnpm dev   # 로컬 PG 사용
#  (DATABASE_URL 비우면 PGlite 임베드 자동)
```

> 막히면: WS 가 안 붙으면 socket.io `path` 확인([DEPLOY.md](./DEPLOY.md) §8). DI 가 깨지면
> `nest build` 로 빌드했는지·`type` import 강제 안 했는지 확인(§2).
