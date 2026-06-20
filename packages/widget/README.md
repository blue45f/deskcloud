# @notifydesk/widget

NotifyDesk 임베드 알림 위젯 — 알림 **벨 + 미읽음 배지 + 접근성 인박스 드롭다운**.
publishable(`pk_`) 키로 사용자가 자기 인박스만 읽고 읽음 처리한다(브라우저 노출 안전).
의존성은 `react`(peer)뿐, 외부 CSS 프레임워크 0(스코프 `.nd-*` 스타일).

> 알림 **발송**·어드민은 서버에서 secret(`sk_`) 키 + [`@notifydesk/sdk`](../sdk) 를 쓴다.

## React

```tsx
import { NotificationBell } from '@notifydesk/widget'

function Topbar() {
  return (
    <NotificationBell
      recipientId="user_42"
      publishableKey="pk_…"
      endpoint="https://notify.example.com"
      onNotificationClick={(n) => router.push(`/inbox/${n.id}`)}
    />
  )
}
```

벨이 주기적으로 미읽음 카운트를 폴링해 배지를 갱신한다(기본 30초). 패널을 열면 인박스를
불러오고 미읽음을 읽음 처리한다. 개별 알림 클릭 시 해당 알림만 읽음 처리 후
`onNotificationClick` 콜백이 호출된다.

### Props

| prop | 기본 | 설명 |
| --- | --- | --- |
| `recipientId` | — | 알림 받을 사용자 식별자(필수). |
| `publishableKey` | — | `pk_…` 키(필수, 브라우저 안전). |
| `endpoint` | — | API 베이스 URL(필수). |
| `align` | `'right'` | 드롭다운 정렬(`'left'` \| `'right'`). |
| `accent` / `accentInk` | `#2f5fe0` / `#fff` | 배지·포커스 강조색과 그 위 텍스트색. |
| `label` | `'알림'` | 벨 접근성 라벨 · 패널 제목. |
| `pollIntervalMs` | `30000` | 미읽음 폴링 주기(ms). `0` 이하면 끔. |
| `limit` | `20` | 인박스 목록 최대 건수(서버 최대 100). |
| `maxBadge` | `99` | 배지 최대 숫자(초과 시 `N+`). |
| `onNotificationClick` | — | 알림 클릭(읽음 처리 후) 콜백. |
| `onUnreadChange` | — | 미읽음 수 변화 콜백(파비콘 배지 등). |
| `fetch` / `client` | — | 커스텀 fetch · 주입 클라이언트(SSR/테스트). |

## 바닐라(비-React)

빌드된 IIFE(`dist/notify-widget.js`, react 인라인)를 `<script>` 로 붙이면 된다.

```html
<div id="notify-bell"></div>
<script src="https://notify.example.com/notify-widget.js"></script>
<script>
  NotifyDesk.init({
    target: '#notify-bell',
    recipientId: 'user_42',
    publishableKey: 'pk_…',
    endpoint: 'https://notify.example.com',
  })
</script>
```

ESM 소비자는 `@notifydesk/widget/vanilla` 의 `mount(options)` → `handle.unmount()` 를 쓴다.

## 접근성

- 벨은 `aria-haspopup="dialog"` · `aria-expanded` · 미읽음 수를 포함한 `aria-label`.
- 패널은 `role="dialog"` + 포커스 트랩(Tab 순환) · Esc 닫기 · 바깥 클릭 닫기 · 닫을 때 벨로 포커스 복귀.
- `:focus-visible` 만 또렷한 링(마우스 클릭엔 링 없음), `prefers-reduced-motion` 존중.
- 본문 대비 ≥ 4.5:1, 배지/큰 텍스트 ≥ 3:1. 그라디언트 텍스트·글래스모피즘·사이드스트라이프 없음.

## 데모

```bash
# 1) API (시드된 pk_demo 테넌트)
NOTIFYDESK_MODE=self-hosted pnpm --filter @notifydesk/api run dev

# 2) 위젯 데모 (http://127.0.0.1:5298)
pnpm --filter @notifydesk/widget run dev:demo
```
