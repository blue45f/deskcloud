# FileDesk

외부 온보딩형(멀티테넌트) **파일 업로드/스토리지 모듈**. DeskCloud 형제 앱(SurveyDesk ·
NotifyDesk · TermsDesk …)과 같은 컨벤션을 따른다. 테넌트가 셀프 가입(`pk_`/`sk_`)해
publishable 키로 파일을 올리고, 운영자는 secret 키로 목록·통계·삭제를 관리한다.

## 한눈에

- **임베드 위젯** `<FileUpload publishableKey endpoint onUploaded />` — 드래그-드롭 + 진행률.
  의존성은 react(peer)뿐, 외부 CSS 프레임워크 0. 바닐라 IIFE 로더도 제공.
- **스토리지 어댑터** — v1 기본은 Postgres `bytea`(작은 파일 인라인 저장). 프로덕션은
  `DESK_STORAGE_DRIVER=s3` 로 S3/R2 어댑터로 스왑(문서화된 스텁, 실제 자격증명 불요).
- **PGlite 폴백** — `DATABASE_URL` 없으면 임베드 PGlite 로 즉시 동작(설정 0).

## 아키텍처

- **pnpm 워크스페이스** · Node ≥ 24 · pnpm 11 · TypeScript 6
- **packages/shared(`@filedesk/shared`)** — 순수 Zod 스키마 · 도메인 타입 · 키 유틸(pk_/sk_) ·
  파일 검증 유틸(크기·MIME) · 플랜/사용량 상수. tsup 빌드.
- **apps/api(`@filedesk/api`)** — NestJS 11 + Drizzle. 전역 프리픽스 `/api`, Swagger `/api/docs`,
  `/health` 제외. helmet · compression · throttler · 자체 ZodValidationPipe.
- **packages/widget(`@filedesk/widget`)** — 임베드 업로드 위젯(React + 바닐라 IIFE) + 업로드 SDK.
- **apps/web(`@filedesk/web`)** — Vite 8 + React 19 어드민(pricing · signup · login(sk_) · dashboard · /design).
- **apps-vendor/** — npm publish 불가 대비 단일 파일 벤더 위젯(워크스페이스 의존 0, 인라인).

## API (요약)

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| `POST` | `/api/tenants` | 공개 | 가입 — `pk_`/`sk_` 발급(secret 평문 1회) |
| `POST` | `/api/files` | `pk_` + Origin | 업로드(multipart 또는 base64 JSON) → `{ id, key, url }` |
| `GET` | `/api/files/:key` | 공개/`sk_`/토큰 | 파일 서빙(public 직접, private 은 sk_/서명 토큰) |
| `GET` | `/api/files` | `sk_` / 어드민 | 목록(메타데이터) |
| `GET` | `/api/files/stats` | `sk_` / 어드민 | 통계(개수·총 바이트) |
| `DELETE` | `/api/files/:id` | `sk_` / 어드민 | 삭제 |

`POST /api/files/:id/signed-url` (sk_) 로 private 파일의 한시적 서명 토큰을 발급한다.

## 멀티테넌트 / 키 규약

- **publishable 키**(`pk_…`) — 공개 안전, 브라우저 임베드용. 평문 저장, CORS allowlist 와 함께 검증.
- **secret 키**(`sk_…`) — 서버 전용. **scrypt 해시 + SHA-256 룩업**만 저장. 평문은 발급/회전 시 1회.
- 어드민 경로는 `sk_` 또는 `X-Admin-Token`(+ `:tenantId`/`?tenantId`).

## 로컬 실행

```bash
pnpm install
FILEDESK_MODE=self-hosted pnpm --filter @filedesk/api run dev   # API :4100 (PGlite 폴백)
pnpm --filter @filedesk/web run dev                              # 대시보드 :5300
```

부팅 시 데모 테넌트(`pk_demo` / `sk_demo`)와 샘플 파일이 시드되어 바로 검증할 수 있다.

## 검증 게이트

```bash
pnpm run verify   # lint:ci + typecheck + test + build
```

## 안전

- 다른 레포 절대 건드리지 않음. neon.tech URL 금지(로컬은 PGlite 또는 qa-postgres).
- 포트는 FREE 하이포트만(API 4100 · web 5300). S3 어댑터는 스텁(실제 자금/자격증명 없음).
