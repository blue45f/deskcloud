# INTEGRATION — 약관을 사이트에 붙이기

TermsDesk에서 **게시(발행)** 한 약관을 실제 사이트·앱에 연동하고, 사용자의 동의를 변조 방지
증거로 남기는 방법입니다. 대시보드의 **연동 가이드**(`/app/guide`) 페이지에서 내 정책 slug·도메인이
채워진 코드를 바로 복사할 수도 있습니다.

> 전제: 약관을 만들고 **게시**까지 끝낸 상태(정책에 "현재 발효" 버전이 있어야 함).

## 0) 약관을 사이트에 노출하기 — 렌더링 방식

먼저 **약관을 보여주는** 방법입니다. 아래 공개 렌더 엔드포인트는 **인증 없이** 동작하며, 모바일
반응형·라이트/다크·인쇄를 지원합니다. self-hosted 단일 조직은 `:orgSlug` 를 `_` 로 줄 수 있습니다.

| 경로                                       | 용도                                                 |
| ------------------------------------------ | ---------------------------------------------------- |
| `/p/:orgSlug/:slug`                        | TermsDesk 호스티드 약관 페이지(SPA) — 링크만 걸면 됨 |
| `/api/public/:orgSlug/policies/:slug`      | JSON(본문·메타·해시·버전목록) — 직접 렌더링용        |
| `/api/public/:orgSlug/policies/:slug/html` | 독립형 HTML 문서 — iframe·팝업·직접 링크             |
| `/api/public/:orgSlug/policies/:slug/text` | text/plain                                           |
| `/api/public/embed.js`                     | 드롭인 팝업(모달) 위젯                               |

**공통 URL 파라미터(동적 약관)**: `?version=v2`(버전 고정), `?theme=dark`,
그리고 임의의 `?키=값` → 본문의 `{{키}}` 치환(값이 없으면 자리표시자 유지, 증거 해시는 원문 불변).

### 포트폴리오 형제 프로젝트용 공개 정본

`termsdesk.vercel.app` 배포본은 형제 프로젝트 전체를 위한 공개 정본 카탈로그를 내장합니다. 각
프로젝트는 자체 약관 페이지를 복제하지 않고 아래 URL을 푸터, 회원가입, 결제, 설정 화면에서 그대로
참조합니다.

| 문서             | URL 형식                                                       |
| ---------------- | -------------------------------------------------------------- |
| 이용약관         | `https://termsdesk.vercel.app/p/:projectSlug/terms-of-service` |
| 개인정보처리방침 | `https://termsdesk.vercel.app/p/:projectSlug/privacy-policy`   |
| 환불·취소 정책   | `https://termsdesk.vercel.app/p/:projectSlug/refund-policy`    |
| 지원 보드        | `https://termsdesk.vercel.app/support/:projectSlug`            |

등록된 `projectSlug`: `promptmarket`, `family-care-platform`, `offhours`, `pettography`,
`proto-live`, `remote-devtools`, `resume`, `rotifolk`, `spa-seo-gateway`,
`multi-environment-setting`, `termsdesk`.

지원 보드는 `?category=site-inquiry`, `?category=partnership`, `?category=bug` 쿼리로 사이트
문의, 제휴, 버그 신고 진입점을 분리할 수 있습니다.

### 비공개 인앱 문의 API

공개 지원 보드에 노출하면 안 되는 인앱 문의는 별도 비공개 접수함으로 보냅니다. 형제 프로젝트는 아래
무인증 공개 API만 호출하면 되고, TermsDesk는 본문·회신 이메일을 공개 목록에 되돌려주지 않습니다.

```http
POST https://termsdesk.vercel.app/api/public/:projectSlug/inquiries
Content-Type: application/json
Accept: application/json
```

```json
{
  "category": "question",
  "title": "연동 질문",
  "body": "약관 연동 과정에서 문의할 내용이 있어 비공개로 접수합니다.",
  "contactEmail": "kim@example.com",
  "originUrl": "https://example.com/contact",
  "website": ""
}
```

필드 계약은 다음과 같습니다.

| 필드           | 필수   | 설명                                                                 |
| -------------- | ------ | -------------------------------------------------------------------- |
| `category`     | 예     | `contact`, `partnership`, `bug`, `qa`, `question` 중 하나            |
| `title`        | 예     | 2~140자                                                              |
| `body`         | 예     | 10~4000자                                                            |
| `contactEmail` | 아니오 | 회신 받을 이메일. 빈 문자열·누락·`null`은 익명 접수로 정규화         |
| `originUrl`    | 아니오 | 문의가 발생한 화면 URL. 최대 500자                                   |
| `website`      | 아니오 | 허니팟 필드. 사람은 빈 값으로 보내고, 값이 있으면 저장하지 않고 폐기 |

성공 응답은 접수증 형태이며, 본문과 연락처를 포함하지 않습니다.

```json
{
  "id": "2f4c0f45-0d1d-4e63-9e55-9021d1e5e9f0",
  "siteSlug": "proto-live",
  "category": "question",
  "status": "new",
  "createdAt": "2026-06-11T11:00:00.000Z"
}
```

### A. 호스티드 링크 (가장 간단)

```html
<a href="https://terms.your-company.com/p/acme/terms-of-service" target="_blank" rel="noopener">
  이용약관
</a>
```

### B. 팝업·모달 (드롭인 위젯)

```html
<!-- ① 페이지에 한 번 -->
<script src="https://terms.your-company.com/api/public/embed.js" data-org="acme" defer></script>

<!-- ② 트리거 (여러 개 가능). 클릭 시 모달(데스크톱)·바텀시트(모바일) -->
<a href="#" data-termsdesk-policy="terms-of-service">이용약관</a>
<a
  href="#"
  data-termsdesk-policy="privacy-policy"
  data-termsdesk-theme="dark"
  data-termsdesk-var-company_name="Acme"
  >개인정보처리방침</a
>
```

`data-termsdesk-*`: `policy`(필수), `org`, `version`, `theme`, `label`, `var-<키>`(→ `{{키}}` 치환).

### C. iframe 임베드

```html
<iframe
  src="https://terms.your-company.com/api/public/acme/policies/terms-of-service/html"
  title="이용약관"
  loading="lazy"
  style="width:100%;height:620px;border:1px solid #e7e3da;border-radius:14px"
></iframe>
```

### D. 인라인 fetch (완전한 스타일 제어)

```js
const res = await fetch(
  'https://terms.your-company.com/api/public/acme/policies/terms-of-service?company_name=Acme'
)
const policy = await res.json() // { name, body, versionLabel, contentHash, availableVersions, ... }
el.style.whiteSpace = 'pre-wrap' // 줄바꿈 보존
el.textContent = policy.body
```

### 스타일링

**호스팅 렌더(A~C)는 URL 파라미터로 룩을 바꿉니다** — 게시 원문·해시와 무관한 표현 레이어입니다.

| 파라미터 | 값                             | 설명                          |
| -------- | ------------------------------ | ----------------------------- |
| `theme`  | `auto`(기본)·`light`·`dark`    | 라이트/다크                   |
| `accent` | hex (예 `2563eb`)              | 강조색(인장색)                |
| `font`   | `sans`(기본)·`serif`           | 본문 글꼴(명조=법률문서 느낌) |
| `align`  | `left`(기본)·`center`          | 제목/메타 정렬                |
| `width`  | `narrow`·`normal`(기본)·`wide` | 본문 최대 폭                  |

```html
<!-- 예: 파란 강조 + 명조 + 좁은 폭 -->
<iframe
  src="https://terms.your-company.com/api/public/acme/policies/terms-of-service/html?accent=2563eb&font=serif&width=narrow"
></iframe>

<!-- 팝업 위젯도 동일 -->
<a
  href="#"
  data-termsdesk-policy="terms-of-service"
  data-termsdesk-accent="2563eb"
  data-termsdesk-font="serif"
  >이용약관</a
>
```

대시보드 **연동 가이드 → 스타일링**에서 컨트롤을 만지면 코드가 즉시 갱신됩니다.

**완전한 디자인 자유도가 필요하면 D(인라인 fetch)** — JSON을 받아 내 마크업·CSS로 그립니다.
권장 구조와 스타터 CSS(클래스 `.td`, 변수 `--td-accent` 등)도 가이드 페이지에 있습니다. 본문은
`white-space: pre-wrap`로 줄바꿈만 보존하면 됩니다.

### CORS·캐시

공개 렌더·검증 엔드포인트(`/api/public/*`)는 **모든 출처에서 호출 가능**합니다 — CORS 전 출처
허용, 자격증명(쿠키·API 키) 불필요. 임베드를 위해 `X-Frame-Options`를 해제하고
`Cross-Origin-Resource-Policy: cross-origin`을 내려주므로 교차 출처 iframe·팝업·fetch가 그대로
동작합니다.

브라우저에서만 약관 호출이 실패한다면 먼저 **Origin 헤더를 넣어** 실제 CORS 응답을 확인하세요.
Origin 없이 `curl`만 하면 200이어도 브라우저가 차단할 수 있습니다.

```bash
# JSON 직접 렌더 응답에 access-control-allow-origin 이 있어야 합니다.
curl -i \
  -H "Origin: http://localhost:5173" \
  "https://terms.your-company.com/api/public/acme/policies/terms-of-service"

# 프리플라이트가 필요한 환경을 대비해 OPTIONS 도 확인합니다.
curl -i -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  "https://terms.your-company.com/api/public/acme/policies/terms-of-service"
```

정상 응답에는 아래 헤더가 포함됩니다. `Access-Control-Allow-Origin`은 `*` 또는 요청 Origin을 그대로
반환해도 됩니다.

```http
access-control-allow-origin: *
access-control-allow-methods: GET, HEAD, OPTIONS
cross-origin-resource-policy: cross-origin
```

운영 환경에서 외부 fetch를 허용하지 않거나, 배포 경로의 프록시가 CORS 헤더를 누락한다면
사이트 서버에 **같은 출처 프록시**를 두고 브라우저는 내부 `/api/...`만 호출하게 하세요.

```ts
// 예: Express/Nest/Vite 서버리스의 GET /api/legal/policies/:slug 핸들러
app.get('/api/legal/policies/:slug', async (req, res) => {
  const upstream = await fetch(
    `https://terms.your-company.com/api/public/acme/policies/${encodeURIComponent(req.params.slug)}`,
    { headers: { accept: 'application/json' } }
  )

  if (!upstream.ok) {
    return res.status(502).json({ error: `policy_fetch_failed:${upstream.status}` })
  }

  res.set('Cache-Control', 'no-store')
  res.json(await upstream.json())
})

// 브라우저에서는 같은 출처만 호출
const policy = await fetch('/api/legal/policies/terms-of-service').then((r) => r.json())
```

응답은 짧게 캐시됩니다(`Cache-Control`):

| 경로                                                         | TTL                                            |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `/api/public/:orgSlug/policies/:slug` (JSON·`/html`·`/text`) | `public, max-age=60`                           |
| `/api/public/:orgSlug/policies/:slug/verify`                 | `public, max-age=30`                           |
| `/api/public/embed.js`                                       | `public, max-age=3600`                         |
| `/api/v1/policies/:slug/current` (Bearer)                    | `public, max-age=<PUBLIC_CACHE_TTL>` (기본 60) |

> 게시 직후에는 캐시 때문에 **최대 60초** 이전 본문이 보일 수 있습니다. 즉시 반영이 필요하면
> `?version=<새 버전 라벨>`을 붙이세요 — URL이 달라져 캐시를 새로 받고, 해당 버전에 고정됩니다.

### 변조 검증 (감사자용·무인증)

영수증의 `content_hash`가 **진짜 게시본의 해시인지** 누구나 독립적으로 확인할 수 있습니다.
서버가 저장된 게시본을 **지금 다시 해싱**해 게시 시점 해시와 일치(자가 무결성)하는지, 그리고
제시한 해시가 실제 게시 버전인지 검증합니다.

```bash
# 현재본 무결성 확인
curl "https://terms.your-company.com/api/public/acme/policies/terms-of-service/verify"

# 특정 영수증의 해시가 진본인지 확인
curl ".../verify?hash=<영수증의 contentHash>"
# → { "verified": true, "versionLabel": "v2", "contentHash": "...", "recomputedHash": "...", "publishedAt": "..." }
```

`verified:false`면 사유(`reason`)가 함께 옵니다(해시 불일치 / 무결성 손상 / 미존재).

> 위 방식은 **표시·검증 전용**입니다. 사용자의 **동의를 증거로 남기려면** 아래 1)~5) 흐름을 사용하세요.

## 1) API 키 발급

대시보드 → **API 키** → 키 발급. SDK·서버가 쓸 publishable 키입니다.

- `read:current` — 현재 게시된 약관 조회
- `write:consent` — 동의 영수증 기록
- `read:consent` — (선택) 동의 조회

키 평문은 발급 시 **한 번만** 표시됩니다.

## 2) 연동 — 셋 중 하나

`BASE`는 TermsDesk 주소(self-host면 `https://terms.your-company.com`, 단일 출처면 웹과 동일 도메인).
`SLUG`는 정책 slug(예: `terms-of-service`). `subjectRef`는 회사가 부여하는 끝단 사용자 식별자(회원 ID 등).
TermsDesk는 원본 PII를 저장하지 않습니다.

### A. React (`@termsdesk/sdk/react`)

가장 간단합니다. `<ConsentGate>`가 본문 표시 → 동의 → 영수증 기록 → children 렌더까지 처리하고,
약관이 바뀌어 재동의가 필요하면 자동으로 다시 게이트를 엽니다.

```tsx
import { createTermsDeskClient } from '@termsdesk/sdk'
import { ConsentGate } from '@termsdesk/sdk/react'

const client = createTermsDeskClient({ baseUrl: 'BASE', apiKey: 'tdk_...' })

export function App({ userId }: { userId: string }) {
  return (
    <ConsentGate client={client} policySlug="SLUG" subjectRef={userId}>
      <YourApp /> {/* 동의 후에만 렌더 */}
    </ConsentGate>
  )
}
```

### B. 바닐라 JS (`@termsdesk/sdk`)

```js
import { createTermsDeskClient } from '@termsdesk/sdk'

const client = createTermsDeskClient({ baseUrl: 'BASE', apiKey: 'tdk_...' })

const policy = await client.getCurrentPolicy({ policySlug: 'SLUG', subjectRef: userId })
if (policy.reconsentRequired) {
  showModal(policy.body) // 게시본 본문을 그대로 노출
  await client.recordConsent({
    subjectRef: userId,
    policySlug: 'SLUG',
    contentHash: policy.contentHash, // 동의한 버전에 귀속
  })
}
```

### C. REST (설치 없이 바로)

```bash
# 현재 게시본 + content_hash
curl "BASE/api/v1/policies/SLUG/current?subjectRef=USER_ID" -H "authorization: Bearer tdk_..."

# 동의 기록 (append-only)
curl -X POST "BASE/api/v1/consents" \
  -H "authorization: Bearer tdk_..." -H "content-type: application/json" \
  -d '{"subjectRef":"USER_ID","policySlug":"SLUG","decision":"accepted"}'
```

## 3) 엔드포인트 레퍼런스 (공개 API · Bearer)

| 메서드 | 경로                             | 스코프          | 설명                                                                |
| ------ | -------------------------------- | --------------- | ------------------------------------------------------------------- |
| GET    | `/api/v1/policies/:slug/current` | `read:current`  | 현재 게시본 + `contentHash` (+ `subjectRef` 시 `reconsentRequired`) |
| POST   | `/api/v1/consents`               | `write:consent` | 동의 영수증 기록 → `{ receiptId, contentHash, ... }`                |

응답 `reconsentRequired`: 이 `subjectRef`가 현재 해시에 'accepted' 영수증을 가졌는지의 부정.

## 4) 약관 변경 → 재동의

새 버전을 **재동의 필요**로 게시하면, 구버전에만 동의한 사용자는 다음 호출 때 `reconsentRequired:true`가
되어 SDK가 게이트를 다시 엽니다. 게시본은 동결(content_hash)되어 바뀌지 않으므로, 각 사용자가
정확히 어떤 문안에 동의했는지 영구히 증명·재현됩니다.

## 5) 동의 확인 / 내보내기

대시보드 → **동의 영수증**에서 누가·어떤 버전(해시)에·언제 동의했는지 조회하고, CSV로 내보내 규제·감사에
제출합니다. 특정 대상의 전체 이력도 한 번에 볼 수 있습니다.

## 참고

`@termsdesk/sdk`는 현재 이 저장소의 패키지입니다. 외부 앱에선 ① REST를 그대로 쓰거나 ② SDK를 사내
레지스트리/번들로 사용하세요(공개 npm 배포는 추후). REST만으로도 모든 기능이 동작합니다.
