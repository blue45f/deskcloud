# CommunityDesk

멀티테넌트 **커뮤니티·게시판·카페(board/cafe) SaaS**(또는 셀프호스팅). SurveyDesk/ReviewDesk/
TermsDesk의 자매 프로젝트로, 같은 형제 앱 생태계 안에서 동작합니다. **외부 서비스가 직접 가입**해
발급받은 키로 자기 앱에 게시판·카페를 붙이고, 그 서비스의 사용자(엔드유저)가 글·댓글·반응을
남기며, 운영자는 검수·운영(고정·잠금·숨김·삭제)과 게시판 관리를 합니다.

> CommunityDesk는 커뮤니티 **호스팅·검수·운영**만 담당합니다. 엔드유저 인증은 하지 않으며,
> 호스트 앱이 publishable 키로 사용자를 보증(`memberId`/`memberName` 전달)합니다.
> 각 테넌트가 자신의 게시판·글을 소유합니다.

## 스택

- pnpm 워크스페이스 · Node ≥ 24 · pnpm 11
- **apps/api** — NestJS 11 + Drizzle ORM · nestjs-zod 검증 · helmet · throttler
- **packages/shared** — Zod 스키마 · 도메인 타입 · 마크다운 살균 · 댓글 트리 유틸 (api·web·widget 공유)
- DB: `DATABASE_URL` 있으면 PostgreSQL, 비어 있으면 **PGlite 임베드 폴백**(Postgres·Docker 불필요)

## 외부 고객 온보딩 (멀티테넌트)

1. 테넌트가 `POST /api/tenants` 로 셀프 가입 → **publishable 키**(`pk_...`, 브라우저 안전:
   읽기 + 멤버 글/댓글/반응)와 **secret 키**(`sk_...`, 검수·CRUD·운영)를 받습니다.
   secret 키는 **가입 시 1회만** 평문 노출되고, 서버에는 SHA-256 해시만 저장됩니다.
2. 테넌트는 자기 사이트 도메인을 `corsOrigins` 허용목록에 등록합니다(`*` 면 전체 허용).
3. 위젯/앱은 publishable 키로 글을 읽고, 사용자(`memberId`/`memberName`)를 대신해 글·댓글·
   반응을 남깁니다(Origin 검사 통과 시). **엔드유저 인증은 호스트 앱이 책임집니다.**
4. 무료 플랜은 누적 글 작성 **소프트 한도**가 있으며, 초과 시 작성이 402로 거절됩니다.

## 도메인 (멀티테넌트 — 테넌트로 격리)

- **Tenant**: `{ id, name, slug, publishableKey, secretKeyHash, corsOrigins[], plan,
  postsCount, readsCount, createdAt }`.
- **Board/Cafe**: `{ id, tenantId, slug, name, description?, kind(board|cafe), postCount }`.
- **Post(Thread)**: `{ id, tenantId, boardId, authorMemberId, authorName, title?,
  body(markdown), bodyHtml(살균된 html), tags[], pinned, locked,
  status(visible|hidden|pending), reactions{}, replyCount, createdAt }`.
- **Comment**: `{ id, tenantId, postId, parentId?(중첩), authorMemberId, authorName, body,
  bodyHtml, status, createdAt }` — 트리로 조립.
- **Reaction**: `{ tenantId, targetType(post|comment), targetId, memberId, kind }` — 토글.

## API

전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 는 프리픽스 제외.

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/tenants` | 테넌트 셀프 가입 → publishable + secret(1회) | 공개 |
| GET | `/api/boards` | 게시판·카페 목록 | publishable + Origin |
| GET | `/api/boards/:slug/posts?sort=&tag=&limit=&offset=` | 보드의 글(페이지네이션) | publishable + Origin |
| GET | `/api/posts/:id` | 글 + 중첩 댓글 트리(읽기 카운트 증가) | publishable + Origin |
| POST | `/api/posts` | 글 작성(markdown 살균, usage 증가) | publishable + Origin |
| POST | `/api/posts/:id/comments` | 중첩 댓글 작성 | publishable + Origin |
| POST | `/api/reactions` | 반응 토글(post\|comment) | publishable + Origin |
| GET | `/api/admin/boards` · POST · PUT `:id` · DELETE `:id` | 게시판 CRUD | secret 또는 ADMIN_TOKEN |
| GET | `/api/admin/posts` | 글 목록(board/status/tag 필터, 페이지네이션) | secret 또는 ADMIN_TOKEN |
| PATCH | `/api/admin/posts/:id` | 운영(hide\|show\|pin\|unpin\|lock\|unlock\|approve) | secret 또는 ADMIN_TOKEN |
| DELETE | `/api/admin/posts/:id` | 글 삭제 | secret 또는 ADMIN_TOKEN |
| PATCH | `/api/admin/comments/:id` | 댓글 운영(hide\|show\|approve) | secret 또는 ADMIN_TOKEN |
| DELETE | `/api/admin/comments/:id` | 댓글 삭제 | secret 또는 ADMIN_TOKEN |
| GET | `/api/admin/tenant` | 테넌트 설정·usage·키(공개 정보) | secret 또는 ADMIN_TOKEN |
| PUT | `/api/admin/tenant` | 설정(name·corsOrigins·plan) 수정 | secret 또는 ADMIN_TOKEN |
| POST | `/api/admin/tenant/rotate-keys` | 키 회전(새 pk/sk, sk 1회 노출) | secret 또는 ADMIN_TOKEN |

## 로컬 실행

```bash
pnpm install
cp .env.example .env       # 기본값으로 PGlite 폴백(추가 설정 불필요)
pnpm run build:libs        # @communitydesk/shared 빌드(타입 의존)
pnpm dev                   # api 가 PORT(기본 4096)에서 기동
```

self-hosted 모드(기본)는 첫 부팅 시 데모 테넌트(`pk_demo`/`sk_demo`, cors `['*']`)와
게시판·카페 2개, 글 ~10개(태그·고정·잠금 혼합), 중첩 댓글, 반응을 시드하므로 위젯·어드민
화면이 바로 채워집니다.

```bash
# 공개: 게시판 목록 (데모는 cors '*' 라 Origin 무관)
curl 'http://localhost:4096/api/boards' -H 'x-pk: pk_demo'

# 공개: 보드의 글 목록
curl 'http://localhost:4096/api/boards/notice/posts?sort=recent' -H 'x-pk: pk_demo'

# 공개: 글 작성 (호스트 앱이 memberId/memberName 보증)
curl -X POST http://localhost:4096/api/posts \
  -H 'content-type: application/json' -H 'x-pk: pk_demo' \
  -d '{"boardSlug":"free","authorMemberId":"u1","authorName":"홍길동","title":"안녕","body":"**굵게** 첫 글"}'

# 어드민: 글 목록(secret 키)
curl 'http://localhost:4096/api/admin/posts?status=pending' -H 'x-sk: sk_demo'

# 어드민: 글 숨김
curl -X PATCH http://localhost:4096/api/admin/posts/<id> \
  -H 'content-type: application/json' -H 'x-sk: sk_demo' -d '{"action":"hide"}'
```

## 검증

```bash
pnpm run verify   # typecheck + test + build
```
