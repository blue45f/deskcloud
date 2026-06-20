# @realtimedesk/widget

RealtimeDesk 임베드 위젯. **`<PresenceBar>`** 는 채널에 누가 있는지(실시간 아바타 스택 +
카운트)를 보여주고, **`useRealtime(channel)`** 훅은 presence·연결 상태·최근 메시지를
리액티브 상태로 노출한다.

> 의존성: `react`(peer) + `@realtimedesk/sdk`(client) + `socket.io-client`. 외부 CSS 프레임워크 0
> (모든 규칙은 `.rt-*` 스코프 CSS). 접근성: focus-visible · prefers-reduced-motion · aria-live ·
> 대비 ≥ 4.5:1.

## 설치

```bash
pnpm add @realtimedesk/widget react react-dom socket.io-client
```

## React — `<PresenceBar>`

```tsx
import { PresenceBar } from "@realtimedesk/widget";

<PresenceBar
  channel="room:42"
  publishableKey="pk_…"
  endpoint="https://realtime.example.com"
/>;
```

같은 채널에 접속한 사람이 들어오고 나갈 때마다 아바타·카운트가 즉시 갱신된다.
`maxAvatars`, `accent`, `showStatus`, `formatCount`, `labelFor` 로 커스터마이즈한다.

## React — `useRealtime` 훅

```tsx
import { useRealtime } from "@realtimedesk/widget";

function Room() {
  const { status, presence, messages, connected } = useRealtime("room:42", {
    publishableKey: "pk_…",
    endpoint: "https://realtime.example.com",
    maxMessages: 50,
  });

  return (
    <div>
      <p>{connected ? "LIVE" : status}</p>
      <p>{presence.count}명 접속 중</p>
      <ul>
        {messages.map((m) => (
          <li key={m.id}>{JSON.stringify(m.data)}</li>
        ))}
      </ul>
    </div>
  );
}
```

## 바닐라(비-React) — IIFE 임베드

```html
<div id="presence"></div>
<script src="https://realtime.example.com/realtime-widget.js"></script>
<script>
  RealtimeDesk.init({
    target: "#presence",
    channel: "room:42",
    publishableKey: "pk_...",
    endpoint: "https://realtime.example.com",
  });
</script>
```

IIFE 빌드(`dist/realtime-widget.js`)는 react/react-dom·SDK·socket.io-client 를 인라인하므로
비-React 페이지도 단일 파일로 동작한다. `window.RealtimeDesk = { mount, init }`.

## 데모

```bash
pnpm --filter @realtimedesk/api run dev        # 로컬 API :4092 (PGlite, pk_demo 시드)
pnpm --filter @realtimedesk/widget run dev:demo # 데모 :5191
```

여러 탭에서 같은 채널로 열면 presence 카운트가 올라간다. 서버에서 sk 로 publish 하면
"최근 메시지" 로그에 실시간으로 찍힌다.

## 단일 파일 벤더링

npm publish 가 막힌 동안 형제 앱에 그대로 복붙해 쓸 수 있는 자급식 버전:
[`apps-vendor/PresenceBar.tsx`](../../apps-vendor/PresenceBar.tsx) (워크스페이스 의존 0,
`react` + `socket.io-client` 만 필요).
