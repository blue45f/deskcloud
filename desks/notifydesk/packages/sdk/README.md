# @notifydesk/sdk

NotifyDesk 서버 SDK — 외부 백엔드가 **secret(`sk_`) 키**로 알림을 보내고 템플릿/테넌트를
관리하는 얇은 클라이언트. 런타임 의존성 0(전역 `fetch` 만 사용), 타입만
`@notifydesk/shared` 에서 가져온다. Node 18+ · 엣지 런타임 · Deno 호환.

> secret 키는 서버에서만. 브라우저(인박스 읽기·읽음 처리)는 publishable(`pk_`) 키 +
> [`@notifydesk/widget`](../widget) 을 쓴다.

## 설치

```bash
pnpm add @notifydesk/sdk
```

## 사용

```ts
import { createNotifyDeskClient } from '@notifydesk/sdk'

const notify = createNotifyDeskClient({
  secretKey: process.env.NOTIFYDESK_SECRET_KEY!, // sk_…
  endpoint: 'https://notify.example.com',
})

// 템플릿 발송 — 템플릿의 channels/subject/body 를 data 로 렌더
await notify.notify('user_42', {
  type: 'order.shipped',
  templateKey: 'order.shipped',
  data: { orderId: 'A-1024', tracking: 'KR123456' },
  email: 'user@example.com',
})

// 애드혹(템플릿 없이) 발송
await notify.notify('user_42', {
  type: 'system',
  title: '환영합니다',
  body: '가입을 축하해요!',
})
```

`notify()` 는 채널별 전달 결과(`deliveries`), 선호 설정으로 억제된 채널(`suppressed`),
무료 플랜 캡 초과 여부(`capExceeded`)를 담은 `NotifyResultDto` 를 돌려준다.

## 어드민 헬퍼

같은 secret 키로 템플릿 CRUD · 발송 로그 · 테넌트 조회가 가능하다.

```ts
await notify.createTemplate({
  key: 'order.shipped',
  channels: ['in_app', 'email'],
  subject: '주문 {{orderId}} 발송 완료',
  bodyTemplate: '{{orderId}} 가 발송되었습니다. 송장: {{tracking}}',
})

await notify.listTemplates()
await notify.getTenant()
await notify.sentLog({ offset: 0, limit: 50 })
```

## 에러 처리

API 가 4xx/5xx 를 돌려주면 `NotifyDeskError` 를 던진다(`status` · `detail` 보존).

```ts
import { NotifyDeskError } from '@notifydesk/sdk'

try {
  await notify.notify('user_42', { type: 'system', body: 'hi' })
} catch (e) {
  if (e instanceof NotifyDeskError && e.status === 429) {
    // 무료 플랜 캡 초과 등 — 재시도/업그레이드 안내
  }
}
```

## 옵션

| 옵션 | 설명 |
| --- | --- |
| `secretKey` | `sk_…` secret 키(필수). 형식이 아니면 생성 시 throw. |
| `endpoint` | API 베이스 URL(필수, 끝의 `/` 는 무시). |
| `fetch` | 커스텀 fetch(테스트·프록시·SSR). 기본 전역 fetch. |
| `timeoutMs` | 요청 타임아웃(ms, 선택). 호출별 `signal` 과 합쳐진다. |
