# @changelogdesk/widget

외부 사이트(또는 형제 앱)에 임베드하는 ChangelogDesk **체인지로그 위젯**. 우하단(기본)에 떠 있는
**벨** 버튼을 누르면 접근성 팝오버가 열리고, 최근 게시 항목이 태그 칩(`new`/`improved`/`fixed`/
`news`)·버전·날짜·마크다운 본문과 함께 최신순으로 보입니다. 미읽음이 있으면 벨에 배지가 뜨고,
패널을 열면 읽음 처리되어 사라집니다. 의존성은 `react`(peer)뿐, 외부 CSS 프레임워크 0.

## 백엔드 계약 (퍼블리시 키 · `x-pk` 헤더 + Origin 검사)

- `GET  {endpoint}/api/changelog?limit=&since=` → `PublicChangelogDto` (게시분만, 사용량 +1)
- `GET  {endpoint}/api/changelog/unread-count?anonId=` → `UnreadCountDto`
- `POST {endpoint}/api/changelog/seen` `{ anonId, lastSeenEntryId? }` → `{ ok: true }`

퍼블리시 키(`pk_…`)는 브라우저 노출이 안전한 **읽기·읽음표시 전용** 토큰입니다. CRUD 는 시크릿
키(`sk_…`)나 글로벌 `ADMIN_TOKEN` 으로만 가능합니다(어드민 경로).

## React 사용

```tsx
import { ChangelogWidget } from '@changelogdesk/widget'

<ChangelogWidget
  publishableKey="pk_xxxxxxxxxxxxxxxx"
  endpoint="https://changelog.example.com"
  accent="#2f5fe0"          // 선택 — 강조색
  position="bottom-right"    // 선택 — bottom-right | bottom-left | top-right | top-left
  title="What's new"        // 선택 — 패널 헤더
/>
```

## 바닐라(비-React) 임베드 — 외부 고객

빌드하면 `dist/changelog-widget.js`(IIFE, react 인라인)가 생성됩니다. 비-React 페이지에서
`<script>` 두 줄로:

```html
<script src="https://changelog.example.com/changelog-widget.js"></script>
<script>
  ChangelogDesk.init({
    publishableKey: 'pk_xxxxxxxxxxxxxxxx',
    endpoint: 'https://changelog.example.com',
  })
</script>
```

또는 명령형으로:

```js
const handle = ChangelogDesk.mount({
  publishableKey: 'pk_…',
  endpoint: 'https://changelog.example.com',
  accent: '#e0562f',
  position: 'bottom-left',
})
// 나중에: handle.unmount()
```

## 단일 파일 벤더 버전

npm publish 가 막힌 동안에는 `apps-vendor/ChangelogWidget.tsx` 를 형제 앱에 그대로 복붙해서
씁니다(워크스페이스 의존 0, react 만 필요). 동작/디자인 동일.

## 빌드 / 검증

```bash
pnpm --filter @changelogdesk/widget run build       # tsup(ESM/CJS/d.ts) + vite IIFE
pnpm --filter @changelogdesk/widget run typecheck
pnpm --filter @changelogdesk/widget run test
```

## 데모

```bash
pnpm --filter @changelogdesk/api run start:dev       # 로컬 API (기본 :4095, PGlite)
pnpm --filter @changelogdesk/api run db:seed         # pk_demo 테넌트 + 샘플 항목
pnpm --filter @changelogdesk/widget run dev:demo     # 데모 (http://127.0.0.1:5189)
```

## 접근성 · 디자인

- `role="dialog"` 팝오버, 포커스 트랩, Escape 닫기, 닫으면 launcher 로 포커스 복귀
- 벨 배지는 `aria-label` 로 미읽음 수를 음성 전달(`변경 이력 — 새 소식 3건`)
- 마크다운 본문은 서버 새니타이즈 HTML(`bodyHtml`)을 우선, 없으면 의존성 0 안전 렌더러 폴백
  (raw HTML 이스케이프 → 화이트리스트 마크다운 재구성 → http/https/mailto 링크만)
- `:focus-visible` 만 링 표시, `prefers-reduced-motion` 존중, 본문 대비 ≥ 4.5:1
- 그라디언트 텍스트/기본 글래스모피즘/사이드-스트라이프 보더 없음, 시맨틱 z-index
