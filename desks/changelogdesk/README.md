# ChangelogDesk

외부 서비스 온보딩형 **멀티테넌트 인앱 체인지로그('What's new') SaaS**(또는 셀프호스팅).
SurveyDesk·TermsDesk의 자매 프로젝트로 같은 형제 앱 생태계 컨벤션을 따릅니다.

외부 서비스가 직접 가입해 **퍼블리시 키(`pk_…`)** 로 임베드 위젯에서 변경 이력을 읽고
미읽음 배지를 띄우며, **시크릿 키(`sk_…`)** 로 항목을 작성·게시(CRUD)합니다.

## 스택

- pnpm 워크스페이스 · Node ≥ 24 · pnpm 11 · TypeScript 6
- **apps/api** — NestJS 11 + Drizzle ORM · nestjs-zod 검증 · helmet · throttler · compression
- **packages/shared** — Zod 스키마 · 도메인 타입 · 순수 유틸(키 발급/해시 · 마크다운 새니타이즈 ·
  미읽음 계산 · CORS 판정) (api·web·widget 공유)
- DB: `DATABASE_URL` 있으면 PostgreSQL, 비어 있으면 **PGlite 임베드 폴백**(Postgres·Docker 불필요)

## 멀티테넌트 모델 (외부 온보딩)

- **Tenant** = `{ id, name, slug, publishableKey, secretKeyHash, corsOrigins[], plan, usageCount, createdAt }`.
  - 외부 서비스가 `POST /api/tenants` 로 셀프서브 가입 → `pk_…`/`sk_…` 발급.
  - **퍼블리시 키**: 브라우저 위젯이 사용. 읽기 + read-receipt 만. 평문 저장.
  - **시크릿 키**: 서버/어드민 전용. 전체 CRUD. **해시(SHA-256)만 저장**, 평문은 발급 1회만 노출.
  - **corsOrigins**: 퍼블리시 키 엔드포인트의 Origin 화이트리스트(`'*'` = 모두 허용).
  - **usageCount + free 월간 소프트 한도**: 공개 위젯 호출마다 +1, free 플랜이 한도를 넘으면 `overLimit`.
- **ChangelogEntry** = `{ id, tenantId, title, bodyMarkdown, tag, version?, category?, isPublished, publishedAt?, createdAt }`.
  - 태그: `new` · `improved` · `fixed` · `announcement`. 게시(`isPublished`)된 항목만 위젯에 노출.
  - `bodyHtml`(새니타이즈된 안전 HTML)을 함께 직렬화해 위젯이 그대로 렌더.
- **ReadReceipt** = `{ tenantId, anonId, lastSeenEntryId, seenAt }` — 미읽음 배지 계산.

## API

전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 는 프리픽스 제외.

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/tenants` | 외부 셀프서브 가입 → `{tenant, publishableKey, secretKey(1회)}` | 공개 |
| GET | `/api/changelog?since=&limit=` | 위젯용 게시 목록(최신순). 사용량 +1 | 퍼블리시 키(`x-pk`/`?pk=`) + Origin |
| POST | `/api/changelog/seen` | 마지막 본 항목 기록 | 퍼블리시 키 |
| GET | `/api/changelog/unread-count?anonId=` | 미읽음 개수 | 퍼블리시 키 |
| GET | `/api/admin/changelog` | 항목 목록(게시·미게시) | 시크릿 키(`x-sk`) 또는 `X-Admin-Token` |
| POST | `/api/admin/changelog` | 항목 생성(게시 포함) | 시크릿 키 / `X-Admin-Token` |
| PUT | `/api/admin/changelog/:id` | 항목 수정·게시 토글 | 시크릿 키 / `X-Admin-Token` |
| DELETE | `/api/admin/changelog/:id` | 항목 삭제 | 시크릿 키 / `X-Admin-Token` |
| GET | `/api/admin/tenant` | 설정·키(pk)·사용량 | 시크릿 키 / `X-Admin-Token` |
| PUT | `/api/admin/tenant` | corsOrigins / plan 변경 | 시크릿 키 / `X-Admin-Token` |
| POST | `/api/admin/tenant/rotate-keys` | 키 회전(새 pk/sk, 1회 노출) | 시크릿 키 / `X-Admin-Token` |

> **인증 분리**: 공개 위젯 경로는 퍼블리시 키 + 테넌트 `corsOrigins` Origin 검사로 인증합니다.
> 어드민 경로는 테넌트 시크릿 키(`x-sk`) **또는** 글로벌 `ADMIN_TOKEN`(`X-Admin-Token`, 셀프호스트)으로
> 인증합니다. `ADMIN_TOKEN` 인증 시 대상 테넌트는 `x-tenant-id` 헤더(테넌트 id 또는 slug)로 지정합니다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env       # 기본값으로 PGlite 폴백(추가 설정 불필요)
pnpm run build:libs        # @changelogdesk/shared 빌드(타입 의존)
pnpm dev                   # api 가 PORT(기본 4095)에서 기동
```

self-hosted 모드(기본)는 첫 부팅 시 데모 테넌트(`pk_demo` / `sk_demo`, `corsOrigins: ['*']`)와
샘플 체인지로그 ~8건을 시드하므로 위젯/어드민이 바로 채워집니다.

```bash
# 1) 외부 서비스 가입(온보딩) — pk/sk 발급
curl -X POST http://localhost:4095/api/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","corsOrigins":["https://app.acme.com"]}'

# 2) 어드민으로 항목 작성·게시(시크릿 키)
curl -X POST http://localhost:4095/api/admin/changelog \
  -H 'content-type: application/json' -H "x-sk: <secretKey>" \
  -d '{"title":"새 기능","bodyMarkdown":"**굵게**","tag":"new","isPublished":true}'

# 3) 위젯이 게시 목록 조회(퍼블리시 키 + Origin)
curl http://localhost:4095/api/changelog \
  -H "x-pk: <publishableKey>" -H "Origin: https://app.acme.com"

# 4) 미읽음 개수
curl "http://localhost:4095/api/changelog/unread-count?anonId=device-1" \
  -H "x-pk: <publishableKey>" -H "Origin: https://app.acme.com"
```

데모 테넌트로 바로 시도:

```bash
curl http://localhost:4095/api/changelog -H "x-pk: pk_demo" -H "Origin: http://localhost"
curl http://localhost:4095/api/admin/changelog -H "x-sk: sk_demo"
```

## 검증

```bash
pnpm run verify   # typecheck + test + build
```
