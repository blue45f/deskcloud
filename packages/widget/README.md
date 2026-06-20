# @moderationdesk/widget

ModerationDesk 임베드 위젯 — 콘텐츠 옆에 붙는 접근성 **신고 버튼**(`<ReportButton>`)과
작성 중 콘텐츠를 검사하는 **클라이언트 사전검사**(`<ModerationBadge>` / `useModerationCheck`).
전부 **publishable 키(`pk_`)** 로 동작해 브라우저에 안전하다. 의존성은 `react`(peer)뿐,
외부 CSS 프레임워크 0(스코프 `.md-*` 인라인 스타일).

> 차단/게이트의 최종 결정은 서버(secret 키, [`@moderationdesk/sdk`](../sdk))가 한다.
> 위젯의 사전검사는 UX 힌트일 뿐이다.

## 설치

```bash
pnpm add @moderationdesk/widget react react-dom
```

## React — 신고 버튼

```tsx
import { ReportButton } from '@moderationdesk/widget'

<ReportButton
  subjectType="comment"
  subjectId={comment.id}
  publishableKey="pk_..."
  endpoint="https://moderate.example.com"
  reporterId={currentUser?.id}        // 선택
  onSubmitted={(r) => toast(`신고 접수됨 (${r.status})`)}
/>
```

클릭하면 사유 선택(라디오) + 선택 상세 입력을 받는 접근성 다이얼로그가 열린다 —
포커스 트랩 · `Esc` 닫기 · 트리거로 포커스 복귀 · `:focus-visible` 링 · reduced-motion 대응.
`reasons` 로 사유 목록을, `bare` 로 텍스트형 트리거를 쓸 수 있다.

## React — 작성 중 사전검사 배지

```tsx
import { ModerationBadge, useModerationCheck } from '@moderationdesk/widget'

// 배지(allow/loading 이면 아무것도 안 보임)
<ModerationBadge text={draft} publishableKey="pk_..." endpoint="https://moderate.example.com" />

// 직접 verdict 가 필요하면 훅으로
const { verdict, loading } = useModerationCheck(draft, {
  publishableKey: 'pk_...',
  endpoint: 'https://moderate.example.com',
})
const canSubmit = !loading && verdict !== 'block'
```

훅은 입력을 디바운스(기본 500ms)해 `POST /api/moderate` 를 pk 로 호출하고,
검사 실패 시 보수적으로 `allow` 를 유지한다(검사 장애가 게시를 막지 않도록).

## 바닐라(비-React) — `<script>`

```html
<span id="report-slot"></span>
<script src="https://moderate.example.com/report-button.js"></script>
<script>
  ModerationDesk.init({
    target: '#report-slot',
    subjectType: 'comment', subjectId: 'c_123',
    publishableKey: 'pk_...', endpoint: 'https://moderate.example.com'
  })
</script>
```

ESM/CJS 빌드는 `react`/`react-dom` 이 external(peer)이고, IIFE 빌드(`dist/report-button.js`)는
둘을 인라인해 단일 파일로 동작한다. `ModerationDesk.mount(...)` 은 `{ unmount, container }` 를
반환한다.

## 클라이언트만 — 직접 호출

```ts
import { createModerationDeskClient } from '@moderationdesk/widget'

const md = createModerationDeskClient({ publishableKey: 'pk_...', endpoint })
await md.submitReport({ subjectType: 'post', subjectId: 'p1', reason: '스팸/광고' })
const { verdict } = await md.check('작성 중 텍스트')
```

## 데모

```bash
pnpm --filter @moderationdesk/api run start:dev      # 로컬 API(:4092, PGlite 폴백)
pnpm --filter @moderationdesk/widget run dev:demo    # 데모(:5290)
```

## exports

| import | 내용 |
| --- | --- |
| `@moderationdesk/widget` | `ReportButton` · `ModerationBadge` · `useModerationCheck` · `createModerationDeskClient` · `mount`/`init` |
| `@moderationdesk/widget/react` | React 컴포넌트만(`ReportButton`) |
| `@moderationdesk/widget/vanilla` | 바닐라 로더(`mount`/`init`) |
