# 문의(Inquiry) 게시판 통합 가이드

desk-platform이 모든 형제 앱을 위한 **공개 문의 게시판 백엔드**를 제공합니다. 각 형제 앱은
별도 SDK/npm 의존성 없이 **공개 REST API를 직접 호출**해서 내부 `/support`(문의) 페이지를
구현합니다. (전화·이메일로 문의 남기는 기능은 제거하고, 모든 문의는 이 내부 게시판으로 통일.)

## 1. 베이스 URL

```
prod  https://desk-platform.vercel.app
dev   http://localhost:6090        # 로컬 desk-platform api
```

프론트엔드는 `VITE_DESK_PLATFORM_URL`(없으면 prod 기본값)로 베이스 URL을 설정한다.

## 2. appId 규칙

`appId`는 형제 앱의 슬러그(소문자 `[a-z0-9-]`, 1~64자). 레포 이름을 그대로 사용한다.
예: `rotifolk`, `offhours`, `pettography`, `quote-match`, `aidigestdesk`, `webtoon-index`,
`promptmarket`, `proto-live`, `resume`, `picky`, `heejun`, `spa-seo-gateway`,
`family-care`, `remote-devtools`, `multi-environment-setting`,
그리고 각 Desk 서비스(`searchdesk`, `surveydesk`, `chatdesk`, ...).

## 3. 카테고리

| value         | 라벨        | 용도             |
| ------------- | ----------- | ---------------- |
| `partnership` | 제휴 문의   | 협업·제휴 제안   |
| `bug`         | 버그 신고   | 사이트 오류 신고 |
| `feedback`    | 사이트 의견 | 개선 의견·제안   |
| `usage`       | 이용 문의   | 사용법·일반 문의 |

`@desk/shared`의 `INQUIRY_CATEGORIES` / `INQUIRY_CATEGORY_LABELS`, `INQUIRY_STATUSES`와 동일.

## 4. 공개 엔드포인트 (인증 없음, CORS 오픈)

### 문의 등록 — `POST /api/v1/apps/:appId/inquiries` (10/min/IP)

```jsonc
// 요청 본문
{
  "category": "partnership" | "bug" | "feedback" | "usage", // 필수
  "title": "string (1~120)",                                 // 필수
  "body": "string (1~4000)",                                 // 필수
  "contactEmail": "user@example.com",  // 선택
  "authorName": "홍길동",               // 선택 (1~80)
  "originUrl": "https://...",          // 선택 (≤2048)
  "website": ""                         // 허니팟 — 항상 빈 값 유지(봇 차단용 hidden)
}
```

- `201` → 생성된 `InquiryDto`(공개 필드만; `contactEmail`/`originUrl` 미포함)
- 허니팟(`website` 채워짐) 또는 검증 실패 → `400 { message: string[] }` (봇/잘못된 입력 차단·저장 안 함)

### 공개 게시판 목록 — `GET /api/v1/apps/:appId/inquiries?limit=20&offset=0` (60/min/IP)

```jsonc
// 응답 InquiryListDto
{
  "appId": "rotifolk",
  "items": [
    {
      "id": "uuid",
      "appId": "rotifolk",
      "category": "feedback",
      "status": "new" | "in_progress" | "resolved" | "closed",
      "title": "...",
      "body": "...",
      "authorName": "홍길동" | null,
      "createdAt": "ISO",
      "updatedAt": "ISO"
      // contactEmail / originUrl 은 공개 목록에서 마스킹됨
    }
  ],
  "limit": 20,
  "offset": 0
}
```

`limit` 1~50(기본 20), 최신순.

## 5. 관리자 엔드포인트 (`X-Admin-Token` 헤더)

- `GET /api/v1/apps/:appId/inquiries/admin?status=&limit=&offset=` — `contactEmail`/`originUrl` 포함
- `PATCH /api/v1/apps/:appId/inquiries/:id/status` body `{ "status": "in_progress" }`

desk-platform 웹 `/admin/inquiries`에서 전 앱 문의를 조회·상태변경할 수 있다.

## 6. 프론트엔드 레퍼런스 (모든 형제 앱 공통 패턴)

각 앱은 자신의 라우터/디자인 토큰에 맞춰 아래 동작을 가진 내부 페이지 1개를 추가한다.

- 경로: 앱 관례에 맞게 `/support` 또는 `/문의`(라우트 path는 `support`).
- 구성: 카테고리 선택(4개) → 제목/내용 입력(+선택 이름/이메일) → 허니팟 hidden `website` →
  제출 시 `POST`, 성공 토스트/안내. 하단에 공개 게시판 목록(`GET`)을 상태 뱃지와 함께 노출.
- 접근성: 폼 라벨, 에러 메시지 announce, 제출 중 disabled, 라우트 진입 포커스.
- 네비/푸터에 "문의" 링크 추가. **기존 `mailto:`·`tel:` 연락 수단은 제거**하고 이 페이지로 대체.
- 베이스 URL은 `import.meta.env.VITE_DESK_PLATFORM_URL ?? 'https://desk-platform.vercel.app'`.

### fetch 헬퍼 예시 (`src/lib/inquiryApi.ts`)

```ts
const BASE = import.meta.env.VITE_DESK_PLATFORM_URL ?? 'https://desk-platform.vercel.app'
const APP_ID = 'rotifolk' // 각 앱의 슬러그

export type InquiryCategory = 'partnership' | 'bug' | 'feedback' | 'usage'

export async function submitInquiry(input: {
  category: InquiryCategory
  title: string
  body: string
  contactEmail?: string
  authorName?: string
}) {
  const res = await fetch(`${BASE}/api/v1/apps/${APP_ID}/inquiries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, originUrl: location.href, website: '' }),
  })
  if (!res.ok) throw new Error((await res.json()).message?.join(', ') ?? '문의 등록 실패')
  return res.json()
}

export async function listInquiries(limit = 20, offset = 0) {
  const res = await fetch(`${BASE}/api/v1/apps/${APP_ID}/inquiries?limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new Error('문의 목록을 불러오지 못했습니다')
  return res.json()
}
```

**라이브 상태(2026-06-19~)**: `desk-platform.vercel.app/api/*`가 AWS EC2 DeskCloud 게이트웨이
(`16.176.210.195.nip.io/platform/api/*`, NestJS 컨테이너 + PGlite)로 프록시되어 동작 중.
앱은 추가 설정 없이 기본 베이스 URL(`desk-platform.vercel.app`)로 호출하면 된다.
로컬 개발 시에만 desk-platform api(:6090) 또는 `VITE_DESK_PLATFORM_URL`로 오버라이드.
