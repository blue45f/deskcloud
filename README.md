# NotifyDesk

외부 온보딩형(멀티테넌트) **Notifications-as-a-Service**. 테넌트가 셀프 가입해 키를 받고,
서버에서 알림을 보내면(in-app · email · web-push) 사용자의 인박스에 쌓인다.
SurveyDesk · TermsDesk 의 자매 프로젝트이며 같은 형제 앱 생태계 컨벤션을 따른다.

## 핵심 개념

- **테넌트(Tenant)** — 셀프 가입의 단위. 두 종류의 키를 받는다.
  - `pk_…` **publishable** 키: 브라우저에 노출해도 되는 키. 자기 인박스 읽기 · 읽음 처리에 사용.
    테넌트별 **CORS 허용목록**(Origin)으로 보호.
  - `sk_…` **secret** 키: 서버 전용. 발송 · 어드민. **해시(scrypt)로만 저장**(평문은 가입/로테이션 응답에서 1회 노출).
- **채널(Channel)** — `in_app`(항상 저장) · `email`(pluggable: 콘솔/SMTP) · `web_push`(VAPID, 미설정 시 no-op).
- **선호(Preference)** — `(type, channel)` 별 on/off. opt-out 모델(미설정은 허용). `in_app` 은 끌 수 없다.
- **소프트 캡** — `free` 플랜은 누적 발송 `FREE_PLAN_CAP` 초과 시 발송 거부. `pro` 는 무제한.

## 아키텍처

- **pnpm 워크스페이스** · Node ≥ 24 · pnpm 11 · TypeScript 6
- **apps/api** — NestJS 11 + Drizzle ORM. 전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 제외.
  helmet · compression · throttler · 자체 `ZodValidationPipe`.
- **packages/shared** — Zod 스키마 · 도메인 타입 · 키 유틸 · 템플릿 렌더(`renderTemplate`) ·
  선호 게이팅(`resolveChannels`) 순수 유틸. tsup 빌드.

## DB 규약 (자매 프로젝트 미러)

- `DATABASE_URL` 있으면 PostgreSQL(node-postgres), 비어 있으면 **PGlite** 폴백(`PGLITE_DIR`).
- **부팅 마이그레이터**: `src/db/migrations.ts` 의 `MIGRATIONS[]`(문자열 SQL, 멱등) 를
  `_migrations` 테이블 추적으로 pg/PGlite 양쪽에 동일 적용. 파일시스템 안 읽음.
- 부팅 시드: `BootstrapService` → `runSeed`. 데모 테넌트(`pk_demo`/`sk_demo`) + 템플릿 2개 +
  데모 인박스 알림 ~12건(읽음/안읽음 혼합). 멱등(테넌트 있으면 건너뜀).

## 빠른 시작

```bash
pnpm install
pnpm run build:libs        # @notifydesk/shared 먼저 빌드
pnpm --filter @notifydesk/api run dev    # PGlite 폴백으로 즉시 실행 (포트 4095)
```

`.env` 없이도 PGlite 임베드 DB로 바로 뜬다(데모 시드 포함). 포트는 `PORT`(기본 4095).

## API 요약 (prefix `/api`)

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/api/tenants` | 없음 | 셀프 가입 → pk_/sk_ 발급 |
| POST | `/api/notify` | sk_ / admin | 알림 발송(템플릿 또는 애드혹, 선호·캡 반영) |
| GET | `/api/inbox?recipientId=&limit=` | pk_ | 인박스 목록 + 미읽음 카운트 |
| POST | `/api/inbox/read` | pk_ | 읽음 처리(ids 또는 all) |
| GET | `/api/inbox/unread-count?recipientId=` | pk_ | 미읽음 카운트 |
| GET / PUT | `/api/preferences?recipientId=` | pk_ | 선호 조회 / 갱신 |
| GET POST PUT DELETE | `/api/admin/templates[...]` | sk_ / admin | 템플릿 CRUD |
| GET | `/api/admin/sent` | sk_ / admin | 발송 로그 |
| GET / PUT | `/api/admin/tenant` | sk_ / admin | 테넌트 조회 / 갱신 |
| POST | `/api/admin/tenant/rotate-keys` | sk_ / admin | 키 로테이션 |

인증 헤더:
- publishable: `Authorization: Bearer pk_…` (또는 `X-Api-Key: pk_…`). 브라우저는 Origin 이 테넌트 CORS 목록에 있어야 함.
- secret: `Authorization: Bearer sk_…`.
- 플랫폼 어드민: `X-Admin-Token: <ADMIN_TOKEN>` (+ 대상 `?tenantId=`).

## 검증 게이트

```bash
pnpm run verify   # typecheck + test + build
```

## 안전

- 다른 레포 절대 건드리지 않음. neon.tech URL 금지(로컬은 PGlite 또는 qa-postgres :5433).
- 포트는 FREE 하이포트만(기본 API 4095). 띄운 서버는 반드시 종료.
