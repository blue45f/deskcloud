# ECOSYSTEM — 형제 앱 생태계

DeskCloud 의 첫 고객은 형제 앱 13개입니다. 이들은 전부 **SurveyDesk FeedbackWidget** 을
env-gated(`VITE_SURVEYDESK_URL`)로 통합했고, 대부분 `/design` 리빙 스타일가이드와 시드된 샘플
DB + 테스트 계정을 갖췄습니다. 이 문서는 각 앱이 DeskCloud 를 어떻게 소비하는지, 그리고 배포된
Desk 로 앱을 가리키는 법을 정리합니다.

> 위젯/라우트 상세는 [SERVICES.md](./SERVICES.md), 배포는 [DEPLOY.md](./DEPLOY.md).

---

## 1. env-gated 위젯 소비 패턴 (표준)

13개 앱 전부가 동일 패턴을 씁니다 — 환경변수가 없으면 위젯이 렌더되지 않아 앱에 무해합니다.

```tsx
// 형제 앱의 layout/App 어딘가
import { FeedbackWidget } from "./components/feedback/FeedbackWidget";

{
  import.meta.env.VITE_SURVEYDESK_URL && (
    <FeedbackWidget
      appId="<앱별 고유 id>"
      endpoint={import.meta.env.VITE_SURVEYDESK_URL}
    />
  );
}
```

- `FeedbackWidget` 은 SurveyDesk 의 단일파일 벤더 컴포넌트(`apps-vendor/FeedbackWidget.tsx`)를
  각 앱이 복붙한 것(npm publish 가 막혀 있어 벤더링 — [DEVELOPMENT.md](./DEVELOPMENT.md) §벤더링).
- 내부 호출: `GET {endpoint}/api/surveys/{appId}/active`(설문 스키마),
  `POST {endpoint}/api/surveys/{appId}/responses`(응답 제출).
- `appId` 는 앱마다 고유(아래 표). SurveyDesk 어드민이 `appId` 별로 설문을 만들고 집계를 봅니다.
- Next.js/비-Vite 앱은 `NEXT_PUBLIC_SURVEYDESK_URL` 또는 콘솔/어드민 SPA 에서 동일 패턴.

배포된 Desk 로 가리키려면 빌드 환경변수만 채우면 됩니다:

```bash
VITE_SURVEYDESK_URL=https://desk.example.com/survey   # 게이트웨이 서브패스
```

---

## 2. 앱별 요약 표

| 앱                              | 무엇                            | `/design` | FeedbackWidget appId      | 로컬 DB                      |
| ------------------------------- | ------------------------------- | :-------: | ------------------------- | ---------------------------- |
| **offhours**                    | 비영업시간 공간 대여 마켓       |    ✅     | `offhours`                | PostgreSQL(Docker/Neon)      |
| **PromptMarket**                | LLM 프롬프트/스킬/에이전트 마켓 |     ✗     | `promptmarket`            | PostgreSQL(Docker/Neon)      |
| **rotifolk**                    | 로테이션 매칭 시음 소셜         |    ✅     | `rotifolk`                | PostgreSQL(Neon/Docker)      |
| **pettography**                 | 희귀 반려동물 라이프사이클      |    ✅     | `pettography`             | PostgreSQL(qa-postgres:5433) |
| **resume**(이력서공방)          | AI 이력서/자소서 관리           |    ✅     | `resume`                  | PostgreSQL(Neon/Docker)      |
| **quote-match**                 | 견적 매칭(요청→예산 베이스라인) |    ✅     | `quotematch`              | 인메모리 시드(데모)          |
| **webtoon-index**(ToonSpectrum) | 웹툰/웹소설 통합 디스커버리     |    ✅     | (FeedbackWidget 통합)     | PostgreSQL(OCI)              |
| **proto-live**                  | 초기 프로토타입 투자 매칭       |     ✗     | `protolive`               | JSON 파일 스토어             |
| **remote-devtools**             | 원격 CDP 디버깅 플랫폼          |    ✅     | `remotedevtools`          | PostgreSQL(Docker/embedded)  |
| **spa-seo-gateway**             | 동적 렌더링 게이트웨이          |     ✗     | `spaseo`(admin SPA)       | 없음(스테이트리스)           |
| **family-care-platform**        | 돌봄 운영 플랫폼                |     ✗     | `familycare`              | Neon PostgreSQL              |
| **heejun-platform**             | 형제앱 공통 플랫폼 코어         |     ✗     | `heejun-console`(console) | Neon PostgreSQL              |
| **termsdesk**                   | 약관 버전관리(Desk이자 형제앱)  |    ✅     | (SurveyDesk 위젯 대상)    | PostgreSQL/PGlite            |

> `/design`: 8/13 보유(offhours·rotifolk·pettography·resume·quote-match·webtoon-index·
> remote-devtools·termsdesk). 다른 Desk 소비(changelog/review/notify/search 등)는 현재
> 형제 앱에서 발견되지 않음 — **SurveyDesk 통합이 1차 도입선**입니다.

---

## 3. 앱별 상세 (소비 + 테스트 계정)

각 앱의 대표 테스트 로그인 몇 개를 시드/README 에서 그대로 옮깁니다.

### offhours — 비영업시간 공간 대여 마켓

- **위젯**: `apps/web/src/components/layout/AppLayout.tsx` — `<FeedbackWidget appId="offhours" …>`.
- **`/design`**: `apps/web/src/router/index.tsx`(DesignSystemPage).
- **테스트 계정**(`apps/api/prisma/seed.ts`): `admin@offhours.kr` / `admin1234`(SUPERADMIN),
  `guest@offhours.kr` / `guest1234`(USER), `host1@offhours.kr`…`host15@offhours.kr` / `host1234`(HOST).
- **스택/실행**: React19+Vite8+NestJS11+Prisma+PostgreSQL. `pnpm dev`(web 5173/api 3000), 시드 `pnpm seed`.

### PromptMarket — LLM 프롬프트/스킬/에이전트 마켓

- **위젯**: `apps/web/src/app/AppProviders.tsx` — `<FeedbackWidget appId="promptmarket" …>`.
- **`/design`**: 없음.
- **테스트 계정**(`apps/api/prisma/seed.ts`): `alice@example.com` / `password`(ADMIN, 셀러),
  `bob@example.com` / `password`(바이어), `carol@example.com` / `password`(셀러+바이어). 각 $100 지갑.
- **스택/실행**: React19+Vite8+NestJS11+Prisma+PostgreSQL. `pnpm dev`(5173/3000), 시드 `pnpm seed`.

### rotifolk — 로테이션 매칭 시음 소셜

- **위젯**: `apps/web/src/components/layout/RootLayout.tsx` — `<FeedbackWidget appId="rotifolk" …>`.
- **`/design`**: `apps/web/src/router/index.tsx`(pages/design/DesignPage).
- **테스트 계정**(`apps/api/prisma/seed.ts`): `admin@rotifolk.dev` / `rotifolk1234!`(ADMIN),
  `host@rotifolk.dev` / `rotifolk1234!`(HOST), `w1`…`w5@rotifolk.dev` · `m1`…`m5@rotifolk.dev` /
  `rotifolk1234!`(참가자 10명).
- **스택/실행**: React19+Vite8+NestJS11+Prisma+PostgreSQL+Socket.IO. `pnpm dev`, 시드 `pnpm seed`.

### pettography — 희귀 반려동물 라이프사이클

- **위젯**: `src/App.tsx` — `<FeedbackWidget appId="pettography" …>`.
- **`/design`**: `src/router/index.tsx`(pages/Design).
- **테스트 계정**(`backend/src/db/seed.ts`, 공통 비번 `pettography-1234`):
  `admin@pettography.local`(admin), `mod@pettography.local`(moderator),
  `gecko.lover@example.com`(member) 외 멤버 10여 명.
- **스택/실행**: React19+Vite8 + Node 백엔드(scrypt). 시드:
  `DATABASE_URL=postgresql://qa:qa@localhost:5433/pettography pnpm run db:seed`.

### resume(이력서공방) — AI 이력서/자소서 관리

- **위젯**: `packages/client/src/App.tsx` — `<FeedbackWidget appId="resume" …>`.
- **`/design`**: `packages/client/src/lib/routes.ts`(`design: '/design'`).
- **테스트 계정**(`packages/server/prisma/seed-sample.ts`, `isSample:true`): `sample-dev1@sample.local`,
  `sample-design@sample.local`, `sample-pm@sample.local`, `sample-recruiter1@sample.local` 등 10+
  (역할별 dev/recruiter/company/pm/designer). 시드에 평문 비번 미노출(샘플 일괄 삭제용 플래그).
- **스택/실행**: React19+Vite8+NestJS11+Prisma+PostgreSQL(Neon). `pnpm dev`, 시드 `pnpm run db:seed`.

### quote-match — 견적 매칭

- **위젯**: `apps/web/src/App.tsx` — `<FeedbackWidget appId="quotematch" …>`(env `VITE_SURVEYDESK_URL`).
- **`/design`**: `apps/web/src/app/router.ts`(DesignSystemPage).
- **테스트 계정**(`packages/shared/src/seeds/`, 인메모리 데모): `client@quotematch.demo` / `DemoClient!2026`,
  `operator@quotematch.demo` / `DemoOperator!2026`, `partner@quotematch.demo` / `DemoPartner!2026`,
  `admin@quotematch.demo` / `DemoAdmin!2026`. (참고: `docs/DEMO.md`)
- **스택/실행**: Vite8+React19+NestJS(인메모리 시드). `pnpm dev`(web 5173/api 3001).

### webtoon-index(ToonSpectrum) — 웹툰/웹소설 통합 디스커버리

- **위젯**: `src/components/feedback/FeedbackWidget.tsx` 보유(env `VITE_SURVEYDESK_URL` 선언,
  `src/vite-env.d.ts`). 마운트는 앱 셸에서 env-gated.
- **`/design`**: `src/app/routes/AppRouter.tsx`(DesignSystemPage).
- **테스트 계정**(`lib/db/seed.ts`, 참고 `test-accounts.local.md`): `admin@webdex.app` / `Admin1234!`,
  `operator@webdex.app` / `Operator1234!`, `test@webdex.app` / `User1234!`.
- **스택/실행**: Vite8+React19+React Router7 + NestJS11(Drizzle, OCI PostgreSQL `132.145.82.3`).
  `pnpm dev:all`(web 5173/api 4001), 시드 `pnpm db:seed`.

### proto-live — 초기 프로토타입 투자 매칭

- **위젯**: `apps/web/src/App.tsx` — `<FeedbackWidget appId="protolive" …>`.
- **`/design`**: 없음.
- **테스트 계정**(`apps/api/fixtures/test-accounts.json`, 참고 `docs/test-accounts.md`):
  `maker-mealmap@protolive.local` / `pass-mock-01`(maker), `investor-seed@protolive.local` /
  `pass-mock-03`(investor), `admin-ops@protolive.local` / `pass-admin-01`(admin) 외.
- **스택/실행**: Vite+React19+NestJS(JSON 파일 스토어). `pnpm dev`(BE 3003/FE 4174),
  시드 `pnpm seed:test-accounts` / `pnpm seed:test-data`.

### remote-devtools — 원격 CDP 디버깅 플랫폼

- **위젯**: `client/src/main.tsx` — `<FeedbackWidget appId="remotedevtools" …>`.
- **`/design`**: `client/src/main.tsx`(lazy `<Design/>`).
- **테스트 계정**: 데모 모드(`localStorage["demo-mode"]="1"` 또는 ⌘K → Enable demo mode); 시드
  `client/src/lib/seed.ts`. 영속 로그인 픽스처는 없고 JWT/데모.
- **스택/실행**: NestJS11(백엔드) + React19/Vite(클라이언트). `pnpm compose`(Docker PG) 또는
  `node scripts/start-pg.mjs`(embedded PG).

### spa-seo-gateway — 동적 렌더링 게이트웨이

- **위젯**: `apps/admin-frontend/src/App.tsx` — `<FeedbackWidget appId="spaseo" …>`(어드민 SPA 한정).
- **`/design`**: 없음(렌더링 엔진 + 어드민 UI 구조).
- **테스트 계정**: 전통적 로그인 없음. 어드민 인증은 `.env` `ADMIN_TOKEN`. 샘플 데이터:
  `scripts/seed-sample-data.ts`(사이트/라우트/캐시).
- **스택/실행**: Fastify 게이트웨이 + Vite/React19 어드민. `pnpm dev` → `http://localhost:3000/admin/ui`.

### family-care-platform — 돌봄 운영 플랫폼

- **위젯**: `apps/web/src/main.tsx` — `<FeedbackWidget appId="familycare" …>`. env zod 검증:
  `VITE_SURVEYDESK_URL: z.string().url().optional()`(`apps/web/src/infrastructure/env.ts`).
- **`/design`**: 없음(운영 대시보드).
- **테스트 계정**: 하드코딩 로그인 픽스처 없음. 시드 `apps/api/src/db/seed.ts`(data/\*.json → Neon).
- **스택/실행**: Vite+React19+NestJS(Drizzle, Neon). `pnpm run dev`(web 5173/api 3001),
  시드 `pnpm db:seed`.

### heejun-platform — 형제앱 공통 플랫폼 코어

- **위젯**: `apps/console/src/App.tsx` — `<FeedbackWidget appId="heejun-console" …>`(콘솔 SPA).
  env zod: `VITE_SURVEYDESK_URL: z.string().url().optional()`(`apps/console/src/env.ts`).
- **`/design`**: 없음(플랫폼 코어 — 사용자 대면 앱 아님).
- **테스트 계정**: 시드 `services/hub/src/seed.ts`(스키마+픽스처 중심, 명시 계정 목록은 README 부재).
- **스택/실행**: pnpm 워크스페이스(packages=TS 라이브러리+Nest 어댑터, services=Nest 백엔드, Drizzle).
  루트 `pnpm install && pnpm verify`; 서비스/패키지별 분리(단일 `pnpm dev` 없음).

### termsdesk — 약관 버전관리 (Desk 이자 형제앱)

- TermsDesk 는 DeskCloud Desk 이면서, 자신도 SurveyDesk 위젯의 대상 앱입니다. 라우트·임베드·데모는
  [SERVICES.md](./SERVICES.md) 의 TermsDesk 절 참고. 어드민 시드: `admin@termsdesk.local` /
  `termsdesk-admin`.

---

## 4. 다른 Desk 추가 소비 방법

현재 형제 앱은 SurveyDesk 만 소비하지만, 같은 패턴으로 다른 Desk 도 붙일 수 있습니다.

```tsx
// 예: ChangelogDesk What's-new 위젯 추가
{
  import.meta.env.VITE_CHANGELOGDESK_URL && (
    <ChangelogWidget
      publishableKey={import.meta.env.VITE_CHANGELOGDESK_PK} // 앱의 pk_
      endpoint={import.meta.env.VITE_CHANGELOGDESK_URL} // 게이트웨이 /changelog
    />
  );
}
```

1. 대상 Desk 에 가입(`POST /<desk>/api/tenants`)해 그 앱 전용 `pk_`(+ 서버용 `sk_`)를 받습니다.
2. 앱 빌드 env 에 `VITE_<X>DESK_URL`(게이트웨이 서브패스) + 필요한 `pk_` 를 넣습니다.
3. 해당 Desk 의 벤더 컴포넌트(`apps-vendor/*.tsx`) 또는 IIFE 로더(`<host>/<desk>/<widget>.js`)를
   임베드합니다([SERVICES.md](./SERVICES.md) 의 Desk별 스니펫).
4. 위젯 호출 Origin 이 그 테넌트의 `corsOrigins` allowlist 에 있어야 통과합니다.

SurveyDesk 만 쓰는 지금은 `VITE_SURVEYDESK_URL` 하나면 충분하고, env 미설정이면 위젯이 비활성이라
프로덕션 배포 전·DeskCloud 미배포 상태에서도 안전합니다.
