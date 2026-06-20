# @chatdesk/sdk

ChatDesk 클라이언트 SDK — 브라우저용 `ChatClient`(pk)와 서버용 `ChatAdmin`(sk).

- **브라우저**: `import { createChatClient } from '@chatdesk/sdk'` — socket.io 실시간 + REST 히스토리
- **서버(sk)**: `import { createChatAdmin } from '@chatdesk/sdk/admin'` — REST 만(socket.io 의존 0)

의존성: 브라우저 진입은 `socket.io-client`(peer/dep), 서버 admin 진입은 의존성 0(전역 fetch).
타입·상수는 `@chatdesk/shared` 공유.

## 브라우저 — ChatClient (pk + memberId)

```ts
import { createChatClient } from '@chatdesk/sdk'

const chat = createChatClient({
  publishableKey: 'pk_…',
  memberId: 'alice',
  endpoint: 'https://chat.example.com',
  // path: '/chat',           // 서버 CHAT_PATH 와 일치(기본 /chat)
  // memberToken: 'mt_…',     // 호스트 서버가 sk 로 발급한 강화 인증 토큰(선택)
})

await chat.connect()
const { items, totalUnread } = await chat.conversations()

const room = await chat.open(items[0].id) // 히스토리 로드 + WS join + 구독
room.messages                              // 초기 히스토리(오래된→최신)
const off = room.onMessage((m) => render(m))
room.onTyping((e) => showTyping(e))
room.onRead((e) => showReceipt(e))
room.onPresence((count, members) => showOnline(count))

await chat.send(room.conversationId, '안녕하세요!')
chat.typing(room.conversationId, true)     // 입력 중
await chat.markRead(room.conversationId)    // 최신까지 읽음

if (room.hasMore) await room.fetchOlder()   // 이전 페이지
await room.close()                          // 룸 나가기
chat.disconnect()
```

전역 구독(목록 unread 등): `chat.onMessage`, `chat.onStateChange`, `chat.onError`.

## 서버 — ChatAdmin (sk)

호스트 서버에서만 사용한다(secret 키는 브라우저 노출 금지).

```ts
import { createChatAdmin } from '@chatdesk/sdk/admin'

const admin = createChatAdmin({ secretKey: 'sk_…', endpoint: 'https://chat.example.com' })

const conv = await admin.createConversation({ kind: 'dm', memberIds: ['alice', 'bob'] })
await admin.systemSend(conv.id, '공지: 점검이 예정되어 있습니다.')
await admin.deleteMessage(messageId)         // 모더레이션(soft delete)
const token = await admin.issueMemberToken('alice') // 브라우저 강화 인증용
```

## 빌드

```bash
pnpm --filter @chatdesk/sdk run build      # ESM/CJS + d.ts
pnpm --filter @chatdesk/sdk run test       # vitest
```
