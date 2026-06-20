# @communitydesk/widget

호스트 앱에 임베드하는 CommunityDesk **게시판·카페 위젯**. 자급식(self-contained) React
컴포넌트로, publishable 키만 있으면 글 목록·상세·중첩 댓글·반응을 렌더하고, `memberId` 가
주어지면 글/댓글 작성·반응까지 켜집니다. 의존성은 `react`(peer) + `@communitydesk/sdk` 뿐,
외부 CSS 프레임워크 0(스코프 `.cd-*` 스타일).

## 백엔드 계약 (공개·publishable)

- `GET  {endpoint}/api/boards` → `BoardDto[]`
- `GET  {endpoint}/api/boards/{slug}/posts?sort&tag&limit&offset` → `PostListDto`
- `GET  {endpoint}/api/posts/{id}` → `PostDetailDto` (살균 HTML + 중첩 댓글 트리)
- `POST {endpoint}/api/posts` · `POST .../posts/{id}/comments` · `POST .../reactions`

키는 `x-pk` 헤더로 싣고, 브라우저가 자동으로 보내는 `Origin` 을 서버가 테넌트
`corsOrigins` 허용목록과 대조합니다.

## React 사용

```tsx
import { CommunityBoard, CommunityFeed } from '@communitydesk/widget'

// 게시판 하나(목록 → 상세 → 댓글 → 작성·반응)
<CommunityBoard
  boardSlug="free"
  publishableKey="pk_..."
  endpoint="https://community.example.com"
  memberId="u_42"          // 선택 — 있으면 작성/반응 가능, 없으면 읽기전용
  memberName="준호"        // 선택 — 작성 표기 이름
  defaultSort="recent"     // 선택 — recent | popular | replies
  accent="#2f5fe0"         // 선택 — 강조색
/>

// 최근 글 요약(compact) — 사이드바 등
<CommunityFeed
  boardSlug="notice"
  publishableKey="pk_..."
  endpoint="https://community.example.com"
  limit={5}
  onOpenPost={(post) => router.push(`/community/${post.id}`)}
/>
```

`memberId` 가 없으면 작성 UI 는 숨겨지고 읽기 + 반응 카운트만 노출됩니다(호스트 앱이
로그인 사용자일 때만 `memberId`/`memberName` 을 넘기세요 — 익명은 `anon:xxxx` 형태로).

## 바닐라(비-React) 임베드

빌드하면 `dist/community-widget.js`(IIFE, react·sdk 인라인)가 생성됩니다.

```html
<div id="community"></div>
<script src="https://community.example.com/community-widget.js"></script>
<script>
  CommunityDesk.init({
    target: '#community',
    boardSlug: 'free',
    publishableKey: 'pk_...',
    endpoint: 'https://community.example.com',
    memberId: 'u_42', memberName: '준호',
  })
</script>
```

명령형으로:

```js
const handle = CommunityDesk.mount({ target: '#community', boardSlug: 'free', publishableKey, endpoint })
const feed = CommunityDesk.mountFeed({ target: '#recent', boardSlug: 'notice', publishableKey, endpoint, limit: 5 })
// 나중에: handle.unmount()
```

## 단일 파일 벤더 버전

npm publish 가 막힌 동안에는 `apps-vendor/CommunityBoard.tsx` 를 호스트 앱에 그대로 복붙해서
씁니다(워크스페이스 의존 0, react 만 필요). 동작/디자인 동일.

## 빌드 / 검증

```bash
pnpm --filter @communitydesk/widget run build      # tsup(ESM/CJS/d.ts) + vite IIFE
pnpm --filter @communitydesk/widget run typecheck
pnpm --filter @communitydesk/widget run test
```

## 데모

```bash
pnpm --filter @communitydesk/api run start:dev     # 로컬 API (기본 :4096, PGlite)
pnpm --filter @communitydesk/widget run dev:demo   # 데모 (http://127.0.0.1:5289)
```

## 접근성 · 디자인

- 글 목록/피드는 버튼(키보드 포커스), 상세 진입 시 제목으로 포커스 이동(라우트 안내)
- 반응은 토글 버튼(`aria-pressed` + `좋아요 3` 라벨), 에러는 `role="alert"`, 로딩은 `aria-busy`
- 댓글은 시맨틱 `ul/li` 트리, 작성은 `⌘/Ctrl + Enter` 단축키
- `:focus-visible` 만 링 표시, `prefers-reduced-motion` 존중, 본문 대비 ≥ 4.5:1
- 그라디언트 텍스트/기본 글래스모피즘/사이드-스트라이프 보더 없음
- 살균 본문 HTML(`.cd-prose`)은 서버가 화이트리스트로 생성 → 위젯은 자체 타이포로 안전 렌더
