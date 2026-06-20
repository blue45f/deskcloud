# ChatDesk

멀티테넌트 **메시징(1:1 쪽지 DM + 그룹/룸 채팅) as a service**. 외부 앱(테넌트)이 가입하면
publishable(`pk_`)·secret(`sk_`) 키 한 쌍을 발급받아, 자신의 사용자(memberId)들을 위한
실시간 채팅·쪽지 기능을 임베드한다. SurveyDesk · RealtimeDesk · TermsDesk의 자매 프로젝트이며
같은 형제 앱 생태계 컨벤션(pnpm 워크스페이스 · NestJS+Drizzle · PGlite 폴백 · Zod 계약)을 따른다.

- **브라우저(pk)** — `memberId` 로 연결해 자신이 속한 대화에서 메시지를 주고받는다.
- **서버/어드민(sk)** — 대화 생성, 시스템 발송, 모더레이션(메시지 삭제), 사용량 조회.

## 스택

- **pnpm 워크스페이스** · Node ≥ 24 · pnpm 11 · TypeScript 6
- **apps/api** — NestJS 11 + Drizzle ORM + socket.io 게이트웨이(`/chat`). PGlite 폴백.
- **packages/shared** — Zod 스키마(메시지·대화 계약) · 도메인 타입 · 키 헬퍼. tsup 빌드.

## 빠른 시작 (Postgres·Docker 불필요)

```bash
pnpm install
pnpm run build:libs        # 공유 패키지(@chatdesk/shared) 빌드
pnpm --filter @chatdesk/api run dev   # API+WS 부팅 (PGlite 임베드 DB, 데모 시드)
```

부팅하면 `http://localhost:4094` 에 API 가, `/chat` 에 socket.io 가 뜨고
Swagger 는 `/api/docs`. self-hosted 모드는 첫 부팅 시 데모 테넌트(`pk_demo` / `sk_demo`,
corsOrigins `['*']`)와 DM·그룹 대화 + 샘플 메시지/리시트를 멱등 시드한다.

## REST 개요 (전역 프리픽스 `/api`, `/health` 제외)

| 메서드 · 경로 | 인증 | 설명 |
| --- | --- | --- |
| `POST /api/tenants` | 공개 | 가입 → pk·sk 발급(sk 평문 1회) |
| `POST /api/conversations` | pk 또는 sk | DM/그룹 대화 생성(DM 은 멤버쌍 dedupe) |
| `GET /api/conversations?memberId=` | pk | 내 대화 목록 + unread |
| `GET /api/conversations/:id/messages` | pk(멤버 범위) | 히스토리(before·limit 커서) |
| `POST /api/conversations/:id/messages` | pk(senderMemberId) | 메시지 발송(WS 브로드캐스트 + 영속화) |
| `POST /api/conversations/:id/read` | pk | 리시트 업데이트(unread 갱신) |
| `POST /api/members/token` | sk | 멤버 토큰 발급(강화 인증, 선택) |
| `GET /api/admin/conversations` | sk/admin | 대화 목록 |
| `POST /api/admin/conversations/:id/system-message` | sk/admin | 시스템 발송 |
| `DELETE /api/admin/messages/:id` | sk/admin | 메시지 모더레이션(삭제) |
| `GET/PUT /api/admin/tenant` · `POST .../rotate-keys` · `GET .../usage` | sk/admin | 테넌트 self-service |

## WebSocket (`/chat`, socket.io)

핸드셰이크에서 `auth: { key: pk_…, memberId }`(+ Origin) 로 인증한다. 연결 후 자신이 속한
대화 룸에 join 하고, 새 메시지(`message`)·타이핑(`typing`)·리시트(`read`)·presence(`presence:*`)
이벤트를 받는다. 비멤버 대화는 join 이 거부되고, 잘못된 pk/Origin 핸드셰이크는 거부된다.

```js
import { io } from 'socket.io-client'
const socket = io('http://localhost:4094', {
  path: '/chat',
  auth: { key: 'pk_demo', memberId: 'alice' },
})
socket.emit('join', { conversationId })
socket.on('message', (m) => console.log('new message', m))
```

## 검증 게이트

```bash
pnpm run verify   # typecheck + test + build
```

WS E2E 라이브 검증(서버가 떠 있어야 함):

```bash
node apps/api/scripts/verify-ws.mjs
```

## 안전

- 다른 레포 절대 건드리지 않음. **neon.tech URL 금지** — 로컬은 PGlite(빈 `DATABASE_URL`)
  또는 qa-postgres(`:5433`, DB 이름 `chatdesk`).
- 포트는 FREE 하이포트만(기본 API 4094). 띄운 서버는 반드시 종료.
