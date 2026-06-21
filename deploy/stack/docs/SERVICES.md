# SERVICES — Desk별 레퍼런스

전체 제품군 15개 서비스(14 기능 Desk + 플랫폼 코어)의 라우트·인증·임베드·데모 키 레퍼런스입니다.
`deploy/stack` 번들에 포함된 14개 API 서비스는 컨테이너 내부 기준 **전역 프리픽스 `/api`**
(헬스는 `/health`, Swagger 는 `/api/docs`)를 쓰고, 게이트웨이 뒤에서는 `<host>/<desk>/api/...`
형태가 됩니다([DEPLOY.md](./DEPLOY.md) 라우팅 맵 참고). TermsDesk 는 별도 스택에서 같은 `/api`
프리픽스와 `/socket.io` 경로를 사용합니다.

> 개요·공유 해부학은 [README.md](./README.md), 플랜·캡은 [BUSINESS-MODEL.md](./BUSINESS-MODEL.md).

---

## 퀵 레퍼런스 표

| Desk               | 게이트웨이    | 공개 인증 헤더                                 | 어드민 인증                                      | 위젯 스크립트 / 전역 객체                 | 데모 키                       | free 캡              |
| ------------------ | ------------- | ---------------------------------------------- | ------------------------------------------------ | ----------------------------------------- | ----------------------------- | -------------------- |
| **TermsDesk**      | (별도)        | `Authorization: Bearer <apiKey>`(scope)        | 세션 + RBAC                                      | `@termsdesk/sdk` + `/api/public/embed.js` | `admin@termsdesk.local`       | org-scoped(N/A)      |
| **SurveyDesk**     | `/survey`     | 없음(공개, appId)                              | `X-Admin-Token`                                  | `feedback-widget.js` / `SurveyDesk`       | appId `demo`,`offhours`       | N/A                  |
| **AdDesk**         | `/ad`         | `X-Pk` 또는 `?pk=`                             | `X-Sk` 또는 `X-Admin-Token`                      | (apps-vendor `AdSlot.tsx`)                | `pk_demo`/`sk_demo`           | 광고 서빙 캡         |
| **AuthDesk**       | `/authdesk`   | `X-Pk` 또는 `?pk=`                             | `X-Sk` 또는 `X-Admin-Token`                      | (lean admin web)                          | `pk_demo`/`sk_demo`           | N/A                  |
| **FileDesk**       | `/file`       | `X-Pk` 또는 `?pk=`                             | `X-Sk` 또는 `X-Admin-Token`                      | (lean admin web)                          | `pk_demo`/`sk_demo`           | 파일 수/크기 캡      |
| **ChangelogDesk**  | `/changelog`  | `x-pk` 또는 `?pk=`                             | `x-sk` 또는 `X-Admin-Token`                      | `changelog-widget.js` / `ChangelogDesk`   | `pk_demo`/`sk_demo`           | 10,000/월            |
| **ReviewDesk**     | `/review`     | `X-Pk` 또는 `?pk=`                             | `X-Sk` 또는 `X-Admin-Token`                      | `reviewdesk-widget.js` / `ReviewDesk`     | `pk_demo`/`sk_demo`           | 500(누적)→402        |
| **MediaDesk**      | `/media`      | `X-Publishable-Key`                            | `X-Sk` 또는 `X-Admin-Token`                      | (apps-vendor `MediaWidgets.tsx`)          | `pk_demo_publishable_key_…`   | 100 MB / 500 파일    |
| **NotifyDesk**     | `/notify`     | `Authorization: Bearer pk_` (또는 `X-Api-Key`) | `Authorization: Bearer sk_` 또는 `X-Admin-Token` | `notify-widget.js` / `NotifyDesk`         | `pk_demo`/`sk_demo`           | 1,000(누적)          |
| **ModerationDesk** | `/moderation` | `X-Pk` 또는 `?pk=`                             | `X-Sk` 또는 `X-Admin-Token`                      | `report-button.js` / `ModerationDesk`     | `pk_demo`/`sk_demo`           | 1,000(누적)          |
| **RealtimeDesk**   | `/realtime`   | `X-Realtime-Key: pk_` + WS `auth.key`          | `X-Realtime-Key: sk_` 또는 `X-Admin-Token`       | `realtime-widget.js` / `RealtimeDesk`     | `pk_demo`/`sk_demo`           | 100k msg / 100 conn  |
| **SearchDesk**     | `/search`     | `Authorization: Bearer pk_`                    | `Authorization: Bearer sk_` 또는 `X-Admin-Token` | `search-widget.js` / `SearchDesk`         | `pk_demo`/`sk_demo`           | 1,000 문서           |
| **CommunityDesk**  | `/community`  | `X-Pk` 또는 `?pk=`                             | `X-Sk` 또는 `X-Admin-Token`                      | `community-widget.js` / `CommunityDesk`   | `pk_demo`/`sk_demo`           | free 게시 캡(소프트) |
| **ChatDesk**       | `/chat`       | `X-Chat-Key: pk_` + WS `auth.key`/`memberId`   | `X-Chat-Key: sk_` 또는 `X-Admin-Token`           | `chat-widget.js` / `ChatDesk`             | `pk_demo`/`sk_demo`           | 100k msg             |
| **@desk/platform** | `/platform`   | `Authorization: Bearer sk_`                    | `X-Admin-Token`                                  | (통합 포털 SPA)                           | `pk_demo`/`sk_demo`(Free+Pro) | 플랜별(§ BM)         |

> 모든 외부 온보딩 Desk 공통: `POST /api/tenants` 로 가입 → `{ publishableKey, secretKey(1회) }`.
> 어드민 테넌트 관리 공통: `GET/PUT /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`.

---

## TermsDesk — 약관/정책 원장 + 동의 영수증 + 의뢰 중계

**하는 일**: 약관·정책 문서를 불변 버전으로 관리하고, 변조 방지 게시 + append-only 동의 영수증으로
"누가 어떤 버전에 언제 동의했는지"를 사후 증명. 여기에 **약관 작성·검토·개정 의뢰 중계**,
전문가 프로필/공개 디렉터리, 스레드 메시지·첨부(S3/R2), 검수 반려·분쟁 큐, 문의/지원 보드,
Socket.IO 실시간 알림까지 포함합니다. 멀티테넌트 외부 온보딩형 Desk 와 달리 **조직(org) 스코프**로
동작하며, 프로덕션은 TermsDesk 전용 Vercel(web) + EC2(api) 스택입니다.

### 라우트 (전역 프리픽스 `/api`, Swagger `/api/docs`)

공개 약관·동의(SDK · `Authorization: Bearer <apiKey>` + scope):

- `GET  /api/v1/policies/:slug/current` — 현재 게시 버전 + content_hash (scope `read:current`)
- `POST /api/v1/consents` — 동의 영수증 기록 (scope `write:consent`)
- `GET  /api/public/:orgSlug/policies/:slug` — 공개 약관 JSON 렌더(version/locale/vars)
- `GET  /api/public/:orgSlug/policies/:slug/html|text` — iframe/팝업/직접 링크용 렌더
- `GET  /api/public/:orgSlug/policies/:slug/verify` — 저장 본문 재해싱으로 content_hash 검증
- `GET  /api/public/embed.js`, `GET /api/public/sitemap.xml` — 드롭인 임베드와 SEO sitemap

공개 지원/전문가 디렉터리(무인증):

- `GET/POST /api/public/support/:projectSlug/posts` — 공개 지원 게시판(연락처 비노출)
- `POST /api/public/:siteSlug/inquiries` — 비공개 문의 접수(throttle 5/min, 영수증만 반환)
- `GET /api/public/providers`, `GET /api/public/providers/:id` — 공개 전문가 디렉터리(연락처 비노출)

어드민 정책/동의/운영(세션 + RBAC):

- `GET/POST /api/policies`, `GET/PATCH/DELETE /api/policies/:idOrSlug`
- `GET/POST /api/policies/:policyId/versions`, `GET/PATCH /api/versions/:versionId`,
  `POST /api/versions/:versionId/publish`
- `GET /api/consents`(subjectRef/policySlug/decision/method/from/to), `GET /api/consents/subject/:subjectRef`
- `GET /api/export/consents.csv`, `GET /api/export/policies/:policyId/versions.csv`
- `GET/PATCH /api/inquiries[/:id]`, `GET /api/insights/consents/daily|reconsent|apikeys`

의뢰 중계(세션 + `request.*` 권한):

- `GET/POST /api/requests`, `GET/PATCH /api/requests/:id`
- `POST /api/requests/:id/cancel|start|complete|request-revision|flag`
- `POST /api/requests/:id/proposals`, `POST /api/requests/:id/proposals/:pid/withdraw|accept`
- `POST /api/requests/:id/messages`
- `POST /api/requests/:id/attachments`, `GET /api/requests/:id/attachments/:attachmentId`
- `POST /api/requests/:id/import-to-policy`, `POST /api/requests/:id/review`
- `GET /api/marketplace` — 공개 모집 의뢰 목록(type/policyType 필터, 인증 사용자)
- `GET/PUT /api/providers/me`, `GET /api/providers`, `GET /api/providers/:id`
- `GET /api/brokerage/stats`, `GET/PATCH /api/brokerage/admin/requests[/:id]`,
  `GET/PATCH /api/brokerage/admin/providers[/:id]`

실시간(Socket.IO, 세션):

- `GET /api/realtime/token` — Socket.IO 접속용 단기 토큰(`origin`, `path: /socket.io`, `expiresAt`)
- `wss://<terms-host>/socket.io` — 세션 쿠키 또는 토큰 auth; Caddy/Vercel rewrite 는 `/socket.io*`
  를 API 로 프록시해야 함
- 서버 이벤트: `realtime.connected`, `notification.created`, `notification.unread_count`,
  `brokerage.message.created`
- 클라이언트 이벤트: `brokerage.request.join`, `brokerage.request.leave`

### 임베드 (npm SDK + 공개 렌더)

```ts
import { createTermsDeskClient } from "@termsdesk/sdk";
const client = createTermsDeskClient({
  baseUrl: "https://terms.example.com",
  apiKey: "tdk_…",
});
const policy = await client.getCurrentPolicy({
  policySlug: "terms-of-service",
  subjectRef: "user-123",
});
await client.recordConsent({
  subjectRef: "user-123",
  policySlug: "terms-of-service",
  decision: "accepted",
  method: "checkbox_clickwrap",
});
```

호스티드 정책 페이지: `https://terms.example.com/p/<org>/<slug>` 로 직접 링크 가능. 공개 전문가 디렉터리는
`https://terms.example.com/experts`, 지원 보드는 `https://terms.example.com/support/<projectSlug>`.

### 어드민/포털 · 데모

- `apps/web`(Vite + React, dev `:5270`) — 정책 CRUD·draft→publish·동의 영수증·CSV export·RBAC.
- `/app/inquiries`, `/app/requests`, `/app/marketplace`, `/app/expert`, `/app/moderation` — 문의 보드,
  의뢰자/전문가/운영자 중계 워크플로.
- `/experts`, `/experts/:id`, `/support/:projectSlug`, `/p/:orgSlug/:slug` — 공개 전문가·지원·약관 렌더.
- `/design` 리빙 스타일가이드, `/sitemap` 공개 사이트맵 뷰.
- 셀프호스트 부팅 시 어드민 시드: `admin@termsdesk.local` / `termsdesk-admin`.

> 약관은 **append-only · content_hash 불변**(버전 재작성 금지) — TermsDesk 의 핵심 규약.

---

## SurveyDesk — 설문/피드백 수집

**하는 일**: 멀티테넌트(`appId`) 설문·피드백 수집. 형제 앱의 임베드 위젯이 응답(별점·NPS·선택지·
자유서술)을 보내고, 운영자가 집계(응답 수·평균·분포·NPS)를 조회. **DeskCloud 생태계의 기본 위젯**
— 13개 형제 앱 전부가 이 FeedbackWidget 을 통합합니다([ECOSYSTEM.md](./ECOSYSTEM.md)).

### 라우트 (전역 프리픽스 `/api`)

공개(인증 없음, CORS 개방):

- `GET  /api/surveys/:appId/active` — 위젯용 활성 설문 스키마(없으면 404)
- `POST /api/surveys/:appId/responses` — 응답 제출(활성 설문 검증, throttle 20/min)

어드민(`X-Admin-Token`):

- `GET  /api/admin/surveys/:appId/responses` — 응답 목록(offset/limit, `X-Total-Count`)
- `GET  /api/admin/surveys/:appId/summary` — 집계(응답수·평균별점·NPS·선택지분포·최근 자유서술)
- `GET  /api/admin/surveys/:appId` / `/:version` — 설문 목록·단건
- `POST /api/admin/surveys/:appId` — 설문 생성(버전 자동 증가)
- `PUT  /api/admin/surveys/:appId/:version` — 수정
- `POST /api/admin/surveys/:appId/:version/activate` — 활성화(기존 활성본 자동 비활성)

### 임베드

React (`@surveydesk/widget/react` 또는 apps-vendor `FeedbackWidget.tsx` 복붙):

```tsx
import { SurveyWidget } from "@surveydesk/widget/react";
<SurveyWidget
  appId="offhours"
  endpoint="https://desk.example.com/survey"
  accent="#2563eb"
/>;
```

바닐라 `<script>` (전역 `SurveyDesk`):

```html
<script src="https://desk.example.com/survey/feedback-widget.js"></script>
<script>
  SurveyDesk.init({
    appId: "offhours",
    endpoint: "https://desk.example.com/survey",
  });
</script>
```

### 어드민/포털 · 데모

- `apps/web`(Vite + React) — 설문 CRUD·버전 관리·응답 목록·집계 뷰. `/design` 라우트 보유.
- 셀프호스트 데모 `appId`: `demo`, `offhours`. 어드민 토큰: `.env` `ADMIN_TOKEN`.

---

## ChangelogDesk — 체인지로그 / What's new

**하는 일**: 외부 온보딩형 멀티테넌트 인앱 체인지로그. 고객이 셀프 가입해 `pk_`로 위젯에서 변경
이력을 읽고, `sk_`로 항목을 CRUD·게시.

### 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → `{ tenant, publishableKey, secretKey(1회) }` (throttle 10/min)

위젯(공개, `x-pk` 헤더 또는 `?pk=` + Origin 검사):

- `GET  /api/changelog` — 게시 항목 목록(최신순, `since`/`limit`, usage +1)
- `POST /api/changelog/seen` — 마지막 본 항목 기록(미읽음 배지)
- `GET  /api/changelog/unread-count?anonId=` — 미읽음 개수

어드민(`x-sk` 또는 `X-Admin-Token`; 후자는 `x-tenant-id` 필요):

- `GET/POST /api/admin/changelog`, `GET/PUT/DELETE /api/admin/changelog/:id`
- `GET/PUT /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`

### 임베드

React (`@changelogdesk/widget/react` 또는 apps-vendor `ChangelogWidget.tsx`):

```tsx
import { ChangelogWidget } from "@changelogdesk/widget/react";
<ChangelogWidget
  publishableKey="pk_demo"
  endpoint="https://desk.example.com/changelog"
  accent="#3b82f6"
/>;
```

바닐라 `<script>` (전역 `ChangelogDesk`):

```html
<script src="https://desk.example.com/changelog/changelog-widget.js"></script>
<script>
  ChangelogDesk.init({
    publishableKey: "pk_demo",
    endpoint: "https://desk.example.com/changelog",
  });
</script>
```

### 어드민/포털 · 데모

- `apps/web`(Vite + React, dev `:5295`) — 항목 CRUD·게시 토글·테넌트 설정·키 회전. `/design` 보유.
- 데모 테넌트: `pk_demo` / `sk_demo`(plan `pro`, `corsOrigins: ['*']`), 샘플 항목 ~8개 시드.
- **free 캡**: `DEFAULT_FREE_MONTHLY_LIMIT = 10_000` 월 호출(env `FREE_PLAN_MONTHLY_LIMIT`).

---

## ReviewDesk — 평점·리뷰·후기(testimonials)

**하는 일**: 멀티테넌트 평점·리뷰·후기 수집. 외부 서비스가 `pk_`로 리뷰 제출·승인본 읽기·별점
요약 노출, `sk_`로 검수(approve/reject/feature)·답글·집계.

### 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → publishable + secret(1회) (throttle 10/min)

위젯(공개, `X-Pk` 헤더 또는 `?pk=` + Origin):

- `POST /api/reviews` — 리뷰 제출(throttle 20/min, usage 증가)
- `GET  /api/reviews?subjectId=&limit=` — subject 승인본 + 집계
- `GET  /api/reviews/wall?limit=` — 승인+추천(featured) 후기 월
- `GET  /api/reviews/aggregate?subjectId=` — 별점 요약(배지)

어드민(`X-Sk` 또는 `X-Admin-Token`):

- `GET  /api/admin/reviews`(status/subjectId/featured 필터, offset/limit)
- `PATCH /api/admin/reviews/:id`(approve|reject|feature|unfeature|reply), `DELETE /api/admin/reviews/:id`
- `GET/PUT /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`

### 임베드 (4종 위젯)

React (`@reviewdesk/widget/react` 또는 apps-vendor `ReviewWidgets.tsx`):

```tsx
import { ReviewStars, ReviewList, ReviewForm, TestimonialWall } from '@reviewdesk/widget/react'
<ReviewStars       publishableKey="pk_demo" endpoint="…/review" subjectId="pro-plan" />
<ReviewList        publishableKey="pk_demo" endpoint="…/review" subjectId="pro-plan" limit={10} />
<ReviewForm        publishableKey="pk_demo" endpoint="…/review" subjectId="pro-plan" collectEmail />
<TestimonialWall   publishableKey="pk_demo" endpoint="…/review" limit={20} />
```

바닐라 `<script>` (전역 `ReviewDesk`, `data-reviewdesk` 자동 스캔):

```html
<div data-reviewdesk="stars" data-subject-id="pro-plan"></div>
<div data-reviewdesk="wall"></div>
<script src="https://desk.example.com/review/reviewdesk-widget.js"></script>
<script>
  ReviewDesk.init({
    publishableKey: "pk_demo",
    endpoint: "https://desk.example.com/review",
  });
</script>
```

`data-*`: `data-reviewdesk`(stars|list|form|wall), `data-subject-id`, `data-limit`,
`data-collect-email`, `data-hide-count`, `data-hide-distribution`.

### 어드민/포털 · 데모

- `apps/web`(Vite + React, dev `:5299`) — 검수 대시보드·테넌트 설정(autoApprove)·키 회전. `/design`.
- 데모 테넌트: `pk_demo` / `sk_demo`(plan `pro`), 샘플 리뷰 ~15개(pro-plan/landing).
- **free 캡**: `FREE_PLAN_LIMIT = 500` 누적 제출, 초과 시 **HTTP 402**(env `FREE_PLAN_LIMIT`).

---

## MediaDesk — 업로드·변환·CDN 서빙

**하는 일**: 멀티테넌트 미디어/에셋 관리. `pk_`로 업로드, 공개 URL 서빙(쿼리 변환: 리사이즈·포맷),
`sk_`로 스토리지(local/S3)·에셋 관리.

### 라우트 (전역 프리픽스 `/api`)

공개(업로드/조회, `X-Publishable-Key` + Origin):

- `POST /api/uploads` — 파일 업로드(multipart: file, folder?) → AssetDto
- `GET  /api/assets?folder=&limit=&offset=` — 테넌트 공개 에셋 목록

파일 서빙(프리픽스 밖, 변환 쿼리 지원):

- `GET  /file/:slug/*key?w=&h=&format=&q=` — 공개 파일 서빙(ETag·캐시 헤더, sharp 있으면 변환)

어드민(`X-Sk` 또는 `X-Admin-Token`):

- `GET /api/admin/me`, `GET /api/admin/tenants`(마스터), `PATCH /api/admin/tenant`,
  `POST /api/admin/tenant/rotate-keys`
- `GET /api/admin/storage`(어댑터·sharp 가용성), `GET /api/admin/assets`, `GET /api/admin/folders`,
  `DELETE /api/admin/assets/*key`

### 임베드

전용 IIFE 로더는 없고, 단일파일 React 컴포넌트 `apps-vendor/MediaWidgets.tsx`(업로드/갤러리)를
복붙해 사용. 서버 측 업로드는 위 `POST /api/uploads` 를 직접 호출.

### 어드민/포털 · 데모

- `apps/web`(Vite + React) — 스토리지·에셋·테넌트 관리. `/design` 보유.
- 데모 테넌트: `publishableKey: pk_demo_publishable_key_0000000000`,
  `secretKey: sk_demo_secret_key_00000000000000`(해시 저장), slug `demo`, CORS `['*']`.
- **free 캡**: `freePlanMaxBytes` 100 MB + `freePlanMaxCount` 500 파일(env `FREE_PLAN_MAX_BYTES`/
  `FREE_PLAN_MAX_COUNT`), 초과 시 402.

---

## NotifyDesk — 알림(인앱/이메일/웹푸시)

**하는 일**: Notifications-as-a-Service. 셀프 가입 후 사용자 인박스로 알림 발송(인앱/이메일/웹푸시),
템플릿·환경설정 관리.

### 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → `{ publishableKey, secretKey(1회), … }` (throttle 10/min)

위젯(공개, `Authorization: Bearer pk_…` 또는 `X-Api-Key: pk_…` + Origin):

- `GET  /api/inbox?recipientId=&limit=` — 인박스(최신순) + 미읽음 수
- `GET  /api/inbox/unread-count?recipientId=`
- `POST /api/inbox/read` — 읽음 처리(ids[] 또는 all=true)
- `GET/PUT /api/preferences?recipientId=` — 알림 환경설정

발송·어드민(`Authorization: Bearer sk_…` 또는 `X-Admin-Token`):

- `POST /api/notify` — 알림 발송(템플릿 key 또는 ad-hoc title/body, 환경설정·소프트 캡 적용)
- `GET/POST /api/admin/templates`, `GET/PUT/DELETE /api/admin/templates/:key`
- `GET  /api/admin/sent?offset=&limit=` — 발송 로그(`X-Total-Count`)
- `GET/PUT /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`

### 임베드 (알림 벨/인박스)

React (`@notifydesk/widget`):

```tsx
import { NotificationBell } from "@notifydesk/widget";
<NotificationBell
  recipientId="user_42"
  publishableKey="pk_demo"
  endpoint="https://desk.example.com/notify"
  accent="#2f5fe0"
/>;
```

바닐라 `<script>` (전역 `NotifyDesk`):

```html
<div id="notify-bell"></div>
<script src="https://desk.example.com/notify/notify-widget.js"></script>
<script>
  NotifyDesk.init({
    target: "#notify-bell",
    recipientId: "user_42",
    publishableKey: "pk_demo",
    endpoint: "https://desk.example.com/notify",
  });
</script>
```

### 어드민/포털 · 데모

- `apps/web`(Vite + React) — 템플릿·발송 로그·테넌트 설정·키 회전. `/design` 보유.
- 데모: `pk_demo` / `sk_demo`, 템플릿 `order.shipped`·`comment.mention`, 샘플 인박스 ~12건.
  (셀프호스트 부팅 또는 `NOTIFYDESK_SEED=true` 시 시드.)
- **free 캡**: `DEFAULT_FREE_PLAN_CAP = 1000` 누적 발송(env `FREE_PLAN_CAP`), 초과 시 402.

---

## ModerationDesk — 콘텐츠 모더레이션 + 신고

**하는 일**: 규칙 기반(exact/substring/regex) 텍스트 모더레이션 + 선택적 Claude AI 톡시시티 점수.
판정 block/flag/allow, 신고 open→reviewing→resolved/dismissed.

### 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → `{ publishableKey, secretKey(1회), … }` (throttle 10/min)

공개(`X-Pk` 헤더 또는 `?pk=` + Origin):

- `POST /api/moderate` — 텍스트 검사 → `{ verdict, matchedRules[], aiScore? }`
- `POST /api/reports` — 사용자 신고 제출

어드민(`X-Sk` 또는 `X-Admin-Token`):

- `GET/PUT /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`
- `GET /api/admin/reports`(status/subjectType 필터), `PATCH /api/admin/reports/:id`
- `GET/POST /api/admin/rules`, `PATCH/DELETE /api/admin/rules/:id`
- `GET /api/admin/logs?verdict=&offset=&limit=`(`X-Total-Count`)

### 임베드 (신고 버튼)

단일파일 React `apps-vendor/ReportButton.tsx`(UGC 신고 버튼) 복붙, 또는 바닐라 IIFE
`report-button.js`(전역 `ModerationDesk`). 텍스트 검사는 서버에서 `POST /api/moderate` 직접 호출.

### 어드민/포털 · 데모

- `apps/web`(Vite + React) — 규칙·신고·로그·설정. `/design` 보유.
- 데모: `pk_demo` / `sk_demo`, 규칙 ~6개·신고 ~4건·샘플 로그.
- **free 캡**: `FREE_PLAN_LIMIT = 1000` 누적 검사(env `FREE_PLAN_LIMIT`), 초과 시 402.
- AI: 기본 모델 `claude-haiku-4-5`(env `MODERATION_AI_MODEL`); `ANTHROPIC_API_KEY` 없으면
  규칙 전용 모드(하드 페일 없음).

---

## RealtimeDesk — 실시간 pub/sub + presence (WebSocket)

**하는 일**: 멀티테넌트 실시간 pub/sub + presence. 채널 구독, presence 업데이트, 메시지 히스토리.

### REST 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → publishable + secret(1회)

- `POST /api/publish` — 브로드캐스트 `{channel,event,data}` + 영구화 (`X-Realtime-Key: sk_`)
- `GET  /api/channels/:channel/history` — 최근 N 메시지 (`X-Realtime-Key: pk_` + Origin)
- `GET/PATCH /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`,
  `GET /api/admin/tenant/usage` (`sk_` 또는 `X-Admin-Token`)

### WebSocket (socket.io)

- **path**: `REALTIME_PATH`(env). 게이트웨이 뒤에서는 **`/realtime/socket.io`** (정확 매칭, 트레일링
  슬래시 금지 — [DEPLOY.md](./DEPLOY.md) WS 함정 참고).
- 핸드셰이크 인증: `auth.key`(또는 `?key=`) = `pk_` + Origin allowlist.
- 클라→서버: `subscribe`, `unsubscribe`, `presence`
- 서버→클라: `message`(channel/event/data/id/publishedAt), `presence:state`, `presence:join`,
  `presence:leave`, `error`

### 임베드 (SDK)

브라우저 클라이언트(`@realtimedesk/sdk/client`):

```ts
import { createRealtimeClient } from "@realtimedesk/sdk/client";
const client = createRealtimeClient({
  publishableKey: "pk_demo",
  endpoint: "https://desk.example.com/realtime",
  path: "/realtime/socket.io", // 게이트웨이 서브패스와 일치
  autoReconnect: true,
});
await client.connect();
const sub = client.subscribe("demo:welcome", (m) => console.log(m));
client.onPresence("demo:welcome", (p) => console.log(p.members, p.count));
```

서버 퍼블리셔(`@realtimedesk/sdk/server`):

```ts
import { createPublisher } from "@realtimedesk/sdk/server";
const pub = createPublisher({
  secretKey: "sk_demo",
  endpoint: "https://desk.example.com/realtime",
});
await pub.publish({
  channel: "room:42",
  event: "notification",
  data: { text: "Hello!" },
});
```

또 presence 표시용 단일파일 컴포넌트 `apps-vendor/PresenceBar.tsx`(전역 `RealtimeDesk`,
`realtime-widget.js`).

### 어드민/포털 · 데모

- `apps/web` — `/design` 보유(전용 어드민 콘솔은 추후). Swagger `/api/docs` 로 테스트.
- 데모: `pk_demo` / `sk_demo`, `corsOrigins: ['*']`.
- **free 캡**: `FREE_MESSAGE_CAP = 100_000` msg + `FREE_CONNECTION_CAP = 100` conn, 초과 시 429.

---

## SearchDesk — 호스티드 검색 + ⌘K

**하는 일**: Search-as-a-Service. 전문 검색(Postgres tsvector / PGlite LIKE 폴백) + 패싯/필터 +
⌘K 커맨드 팔레트. `sk_`로 문서 인덱싱, `pk_`로 브라우저 검색.

### 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → publishable + secret(1회)

검색(공개, `Authorization: Bearer pk_…` + Origin, throttle 240/min):

- `GET  /api/search?q=&index=&category=&tags=&limit=` → `{ hits, facets:{category,tags}, … }`
  (랭킹 + `<mark>` 하이라이트 + 패싯 카운트)

인덱싱·어드민(`Authorization: Bearer sk_…` 또는 `X-Admin-Token`):

- `POST /api/docs` — 문서 upsert(단건/배치, throttle 120/min)
- `DELETE /api/docs/:id?index=`
- `GET /api/admin/docs`(`X-Total-Count`), `GET/PUT /api/admin/tenant`,
  `POST /api/admin/tenant/rotate-keys`, `GET /api/admin/usage`(docCount/docCap/searchCount)

### 임베드 (⌘K 팔레트 / 인라인 박스)

React (`@searchdesk/widget` 또는 apps-vendor `SearchPalette.tsx`):

```tsx
import { SearchPalette, SearchBox } from '@searchdesk/widget'
<SearchPalette publishableKey="pk_demo" endpoint="https://desk.example.com/search" accent="#2f5fe0" />
<SearchBox     publishableKey="pk_demo" endpoint="https://desk.example.com/search" />
```

바닐라 `<script>` (전역 `SearchDesk`):

```html
<script src="https://desk.example.com/search/search-widget.js"></script>
<script>
  SearchDesk.init({
    publishableKey: "pk_demo",
    endpoint: "https://desk.example.com/search",
  });
  // 또는 인라인: SearchDesk.mountBox({ target: '#search-box', publishableKey: 'pk_demo', endpoint: '…/search' })
</script>
```

### 어드민/포털 · 데모

- `apps/web`(Vite + React) — 문서 목록·인덱싱·검색 테스트·사용량. `/design` 보유.
- 데모: `pk_demo` / `sk_demo`, 샘플 문서 ~20개(docs/guide/api/billing/faq/changelog).
- **free 캡**: `DEFAULT_FREE_PLAN_DOC_CAP = 1000` 문서(env `FREE_PLAN_DOC_CAP`). 검색 limit
  기본 10 / 최대 50.

---

## CommunityDesk — 게시판 / 카페 / 포럼

**하는 일**: 멀티테넌트 커뮤니티(보드/카페 + 글/댓글/반응). 외부 테넌트가 위젯 임베드, 엔드유저
(memberId)가 글·댓글, 어드민이 모더레이션.

### 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → publishable + secret(1회)

공개(`X-Pk` 헤더 또는 `?pk=` + Origin):

- `GET  /api/boards` — 보드/카페 목록
- `GET  /api/boards/:slug/posts` — 글 목록(visible·핀 우선; `sort=recent|popular|replies`, `tag=`, `limit=`, `offset=`)
- `GET  /api/posts/:id` — 글 상세 + 댓글 트리(읽음 +1)
- `POST /api/posts` — 글 작성(markdown→sanitized HTML; free 캡 초과 시 402)
- `POST /api/posts/:id/comments` — 댓글(parentId 선택; 잠금 글 거부)
- `POST /api/reactions` — 반응 토글(post|comment) → 집계 카운트

어드민(`X-Sk` 또는 `X-Admin-Token`):

- `GET/POST/PUT/DELETE /api/admin/boards[/:id]`
- `GET /api/admin/posts`(filters), `PATCH /api/admin/posts/:id`(show|hide|pin|unpin|lock|unlock|approve), `DELETE`
- `PATCH /api/admin/comments/:id`(show|hide|approve), `DELETE`
- `GET/PUT /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`

### 임베드 (보드 + 피드)

React (`@communitydesk/widget` 또는 apps-vendor `CommunityBoard.tsx`):
컴포넌트 `CommunityBoard`(메인), `CommunityFeed`(컴팩트).

바닐라 `<script>` (전역 `CommunityDesk` = `{ mount, mountFeed, init }`):

```html
<div id="community"></div>
<script src="https://desk.example.com/community/community-widget.js"></script>
<script>
  CommunityDesk.init({
    target: "#community",
    boardSlug: "free",
    publishableKey: "pk_demo",
    endpoint: "https://desk.example.com/community",
    memberId: "u_42",
    memberName: "준호",
  });
</script>
```

주요 props: `publishableKey`, `endpoint`, `boardSlug`, `memberId?`, `memberName?`,
`defaultSort?`(recent|popular|replies), `accent?`.

### 어드민/포털 · 데모

- `apps/web` — `/design` 보유(어드민 콘솔은 라우트 기준 진행).
- 데모: `pk_demo` / `sk_demo`, 보드 2개(notice/free) + 글 ~10개 + 댓글/반응.
- **free 캡**: 게시 소프트 캡(작성 시 402), 읽기·반응 카운트 트래킹.

---

## ChatDesk — DM + 그룹 채팅 (WebSocket)

**하는 일**: 멀티테넌트 메시징(1:1 DM + 그룹). 셀프 가입 후 채팅 위젯 임베드, 엔드유저(memberId)가
메시지·읽음·타이핑. 실시간 WS + REST.

### REST 라우트 (전역 프리픽스 `/api`)

공개 가입: `POST /api/tenants` → publishable + secret(1회)

대화·메시지(`X-Chat-Key: pk_` 또는 `sk_` — AnyKeyGuard; memberId 쿼리/바디):

- `POST /api/conversations` — DM(dedupe) 또는 그룹 생성
- `GET  /api/conversations?memberId=` — 내 대화 + 미읽음
- `GET  /api/conversations/:id/messages?before=&limit=` — 히스토리
- `POST /api/conversations/:id/messages` — 메시지 전송(WS 브로드캐스트 + 영구화)
- `POST /api/conversations/:id/read` — 읽음 처리
- `POST /api/members/token` — 멤버 토큰 발급(sk 서명 HMAC, 기본 1h) (`X-Chat-Key: sk_`)

어드민(`X-Chat-Key: sk_` 또는 `X-Admin-Token`):

- `GET /api/admin/conversations[/:id/messages]`, `POST /api/admin/conversations/:id/system-message`,
  `DELETE /api/admin/messages/:id`(소프트 삭제)
- `GET/PUT /api/admin/tenant`, `POST /api/admin/tenant/rotate-keys`, `GET /api/admin/tenant/usage`

### WebSocket (socket.io)

- **path**: `CHAT_PATH`(env). 게이트웨이 뒤 **`/chat/socket.io`**(정확 매칭).
- 핸드셰이크: `auth.key`(pk\_), `auth.memberId`, `auth.token`(선택 멤버 토큰) + Origin.
- 클라→서버: `join {conversationId}`, `leave`, `typing {conversationId,typing}`,
  `read {conversationId,lastReadMessageId}`
- 서버→클라: `message`, `message:deleted`, `typing`, `read`, `presence:state/join/leave`, `error`

### 임베드

React (`@chatdesk/widget` 또는 apps-vendor `ChatWidget.tsx`). SDK(`@chatdesk/sdk`)도 제공:

```ts
import { createChatClient } from "@chatdesk/sdk";
const chat = createChatClient({
  publishableKey: "pk_demo",
  memberId: "alice",
  endpoint: "https://desk.example.com/chat",
  path: "/chat/socket.io",
});
await chat.connect();
const room = await chat.open(conversationId); // 히스토리 + join + subscribe
room.onMessage((m) => console.log(m));
await chat.send(conversationId, "Hello!");
```

바닐라 `<script>` (전역 `ChatDesk`):

```html
<script src="https://desk.example.com/chat/chat-widget.js"></script>
<script>
  ChatDesk.init({
    publishableKey: "pk_demo",
    endpoint: "https://desk.example.com/chat",
    memberId: "alice",
  });
</script>
```

props: `publishableKey`, `endpoint`, `memberId`(필수), `memberName?`, `path?`, `memberToken?`,
`position?`, `accent?`, `label?`(기본 '채팅'), `title?`(기본 '메시지').

### 어드민/포털 · 데모

- `apps/web` — `/design` 보유.
- 데모: `pk_demo` / `sk_demo`, DM 1 + 그룹 1 + 메시지 ~12.
- **free 캡**: `FREE_MESSAGE_CAP = 100_000`(전송 시 소프트 집행).

---

## @desk/platform — 멀티테넌트 코어 + 빌링/BM + 통합 포털

**하는 일**: 모든 Desk 가 소비하는 **멀티테넌트 프리미티브 + 빌링/수익화 기반**. 테넌트/조직 관리,
API 키 발급/검증/회전, CORS allowlist, 사용량 미터링 + 플랜(Free/Pro/Scale/Enterprise)·구독 상태
머신·결제 어댑터(**TEST/STUB 전용**)·per-plan 한도 집행. 빌링·BM 상세는
[BUSINESS-MODEL.md](./BUSINESS-MODEL.md).

### 라우트 (전역 프리픽스 `/api`, 인증 `Authorization: Bearer sk_…`)

공개 가입: `POST /api/tenants` → publishable + secret(1회)

- `GET/PUT /api/tenant`, `POST /api/tenant/rotate-keys`
- `GET  /api/usage?period=current|YYYY-MM` — 메트릭별 `{ used, limit, remaining }`
- `GET  /api/billing/plans` — **공개** 가격표(Free/Pro/Scale/Enterprise, 가격·한도·기능의 단일 소스)
- `POST /api/billing/checkout` — 체크아웃 시작 → `{ checkoutUrl, sessionId }`(TEST stub)
- `GET  /api/billing/subscription` — 현재 구독(plan/status/provider/periodEnd)
- `POST /api/billing/cancel` — Free 로 다운그레이드
- `POST /api/billing/webhook/:provider` — 웹훅(stub/toss/stripe, 서명 검증, **TEST 전용**)

### 통합 포털 / 콘솔 (apps/web, Vite SPA)

공개 라우트: `/`(랜딩), `/pricing`(`GET /api/billing/plans` 단일 소스), `/docs`, `/catalog`(Desk
카탈로그), `/signup`, `/login`, `/design`. 인증 라우트: `/dashboard`(테넌트 콘솔 — 구독·사용량·키·
설정, `POST /api/billing/checkout`/`cancel`).

**"Powered by DeskCloud" 배지**: `apps/web/src/PoweredByDeskCloud.tsx` — Free 플랜은 표시,
유료(removableBadge)는 숨김 가능. 형제 위젯 푸터에 들어가는 마케팅 훅.

### DB · 데모

- Drizzle + PGlite 폴백. 스키마: tenants/members/api_keys/usage_meter/subscriptions.
- secret 키: **SHA-256(key + `DESK_KEY_PEPPER`)** 해시 저장.
- 셀프호스트 부팅 시 데모 테넌트(Free 1 + Pro 1, `pk_demo`/`sk_demo`) 멱등 시드.
- 빌링: `DESK_BILLING_PROVIDER`(stub|toss|stripe, **stub 기본**), 실제 자금 이동 없음.
