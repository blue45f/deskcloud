# @chatdesk/widget

ChatDesk 임베드 채팅 위젯 — 형제 앱에 떠 있는 채팅 런처 + 패널(대화 목록·메시지 스레드·작성기).
`pk + memberId` 로 실시간 메시징(타이핑·읽음 리시트·presence·unread). React 컴포넌트 +
바닐라 IIFE 로더. 의존성은 `react`(peer)·`@chatdesk/sdk`(socket.io-client)뿐, 외부 CSS 프레임워크 0.

## React

```tsx
import { ChatWidget } from '@chatdesk/widget'

<ChatWidget
  publishableKey="pk_…"
  endpoint="https://chat.example.com"
  memberId="alice"
  memberName="Alice"      // 선택
  accent="#2f5fe0"        // 선택
  position="bottom-right" // 선택
/>
```

우하단 런처(+unread 배지) → 패널: 대화 목록(미리보기·unread) → 메시지 스레드(히스토리 + 라이브 +
타이핑 + 읽음 리시트 + presence) + 작성기(엔터 발송, 타이핑 전송).

## 바닐라 (비-React 사이트)

```html
<script src="https://chat.example.com/chat-widget.js"></script>
<script>
  ChatDesk.init({
    publishableKey: 'pk_…',
    endpoint: 'https://chat.example.com',
    memberId: 'alice',
  })
</script>
```

또는 명령형: `const handle = ChatDesk.mount({ … }); handle.unmount()`.

## 단일 파일 벤더링

npm publish 가 막힌 동안에는 `apps-vendor/ChatWidget.tsx` 를 호스트 앱에 그대로 복붙한다
(의존성: `react` + `socket.io-client`). 동작/디자인은 `<ChatWidget>` 과 동일.

## 접근성

focus-visible · prefers-reduced-motion · 포커스 트랩 · Esc 닫기 · 키보드 · 새 메시지
aria-live(polite) · 대비 ≥4.5:1 · 그라디언트 텍스트/글래스모피즘 없음.

## 빌드 / 데모

```bash
pnpm --filter @chatdesk/widget run build       # tsup(ESM/CJS/d.ts) + vite IIFE(dist/chat-widget.js)
pnpm --filter @chatdesk/widget run test        # vitest
pnpm --filter @chatdesk/widget run dev:demo    # 로컬 데모(:5199, API :4094 필요)
```
