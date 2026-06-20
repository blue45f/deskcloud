# @realtimedesk/sdk

RealtimeDesk 클라이언트·서버 SDK. 브라우저는 **publishable 키(pk\_)** 로 채널을 구독·presence,
서버는 **secret 키(sk\_)** 로 publish 한다. 브라우저 클라이언트는 `socket.io-client` 를 얇게
감싸고, 서버 publisher 는 `fetch` 만 쓴다.

> 의존성: 런타임은 `socket.io-client`(peer) 하나. 타입은 `@realtimedesk/shared` 에서만 가져오며
> (node:crypto 를 쓰는 키 헬퍼는 브라우저 번들에 절대 포함되지 않음).

## 설치

```bash
pnpm add @realtimedesk/sdk socket.io-client
```

## 브라우저 — 구독 + presence (pk)

```ts
import { createRealtimeClient } from "@realtimedesk/sdk/client";

const rt = createRealtimeClient({
  publishableKey: "pk_…",
  endpoint: "https://realtime.example.com", // socket.io 는 /realtime 에 마운트됨(기본)
});

await rt.connect();

// 채널 메시지 구독
const sub = rt.subscribe("room:42", (msg) => {
  console.log(msg.event, msg.data); // { id, tenantId, channel, event, data, publishedAt }
});

// presence(누가 있는지) 실시간 — 스냅샷 + join/leave 마다 호출
rt.onPresence("room:42", (p) => {
  console.log(`${p.count}명`, p.members);
});

// presence 1회 조회(요청-응답)
const now = await rt.presence("room:42");

// 정리
sub.off(); // 콜백만 해제
await sub.unsubscribe(); // 채널 떠나기
rt.close(); // 연결 종료
```

핸드셰이크는 **pk + Origin** 으로 인증된다(테넌트별 CORS allowlist). 잘못된 키/Origin 이면
`connect()` 가 `RealtimeAckError` 로 reject 된다. 재연결 시 구독은 자동 복원된다.

## 서버 — publish (sk)

```ts
import { createPublisher } from "@realtimedesk/sdk/server";

const pub = createPublisher({
  secretKey: process.env.REALTIME_SECRET!, // sk_… — 절대 클라이언트에 노출 금지
  endpoint: "https://realtime.example.com",
});

const res = await pub.publish("room:42", "message", { text: "안녕하세요" });
// → POST /api/publish (X-Realtime-Key: sk_…)
// → { delivered: 3, message: { id, channel, event, data, publishedAt } | null }
```

## API

- `createRealtimeClient(opts) → RealtimeClient` — `connect()`, `subscribe(channel, cb)`,
  `onPresence(channel, cb)`, `presence(channel)`, `onStatus(cb)`, `onError(cb)`, `close()`.
- `createPublisher(opts) → RealtimePublisher` — `publish(channel, event, data?)`,
  `publishMessage(input)`.

## 경로 함정

socket.io 는 서버 `REALTIME_PATH`(기본 `/realtime`)에 **정확 매칭**으로 마운트된다. 게이트웨이
뒤에서는 SDK 의 `path` 옵션을 서버와 동일하게(트레일링 슬래시 없이) 맞춰야 핸드셰이크가 깨지지
않는다.
