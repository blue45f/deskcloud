# RealtimeDesk

멀티테넌트 **실시간(WebSocket pub/sub + presence) as a service**. SurveyDesk·TermsDesk의 자매
프로젝트로, 같은 형제 앱 생태계 컨벤션을 따릅니다. 외부 테넌트가 가입하면 두 개의 키를 받습니다.

- **publishable 키(`pk_…`)** — 브라우저용. WS 핸드셰이크로 연결하고, 채널을 구독(subscribe)하고,
  presence(채널 참여자)를 조회합니다. Origin allowlist 검사를 통과해야 합니다.
- **secret 키(`sk_…`)** — 서버용. REST(또는 소켓)로 메시지를 publish/broadcast 하고, 어드민
  (테넌트 단건·키 회전·사용량)을 호출합니다. DB에는 **해시로만 저장**됩니다.

> RealtimeDesk는 실시간 **전달(pub/sub)·presence·최근 메시지 히스토리**만 담당합니다.
> 각 테넌트가 자신의 채널·구독자를 소유합니다(`tenantId` 로 격리).

## 스택

- pnpm 워크스페이스 · Node ≥ 24 · pnpm 11 · TypeScript 6
- **apps/api** — NestJS 11 + Drizzle ORM · 자체 ZodValidationPipe · helmet · throttler ·
  socket.io 게이트웨이(`@nestjs/platform-socket.io` + `WsAdapter`)
- **packages/shared** — Zod 스키마(이벤트·메시지 계약) · 도메인 타입 · 키 헬퍼 (api·web·sdk 공유)
- DB: `DATABASE_URL` 있으면 PostgreSQL, 비어 있으면 **PGlite 임베드 폴백**(Postgres·Docker 불필요)

## 도메인 (멀티테넌트 — `tenantId` 로 격리)

- **Tenant**: `{ id, name, publishableKey(pk_), secretKeyHash, corsOrigins[], plan, usage{messages,
connections}, createdAt }`. pk는 평문 노출(브라우저), sk는 해시 저장(분실 시 회전).
- **Message**: `{ id, tenantId, channel, event, data(jsonb), publishedAt }` — append-only.
  채널당 최근 N건을 히스토리로 보관(`REALTIME_HISTORY_LIMIT`).
- **Presence**: 인메모리(채널별 참여자 집합). 영속화하지 않음.

## REST API

전역 프리픽스 `/api`, Swagger `/api/docs`, `/health` 는 프리픽스 제외.

| 메서드 | 경로                             | 설명                                         | 인증                            |
| ------ | -------------------------------- | -------------------------------------------- | ------------------------------- |
| POST   | `/api/tenants`                   | 가입 → pk·sk 키 발급(sk는 응답에 1회만 평문) | 공개(throttled)                 |
| POST   | `/api/publish`                   | `{channel,event,data}` 브로드캐스트 + 영속화 | `X-Realtime-Key: sk_`           |
| GET    | `/api/channels/:channel/history` | 채널 최근 N개 메시지                         | `X-Realtime-Key: pk_` (+Origin) |
| GET    | `/api/admin/tenant`              | 내 테넌트 단건(키 회전·사용량 포함)          | sk\_ 또는 `X-Admin-Token`       |
| POST   | `/api/admin/tenant/rotate-keys`  | 키 회전(새 pk·sk 발급)                       | sk\_ 또는 `X-Admin-Token`       |
| GET    | `/api/admin/tenant/usage`        | 사용량(messages·connections·cap)             | sk\_ 또는 `X-Admin-Token`       |

## WebSocket (socket.io · `WsAdapter`)

- 마운트 경로: `REALTIME_PATH`(기본 `/realtime`) — 게이트웨이 뒤에서도 **정확 매칭**(트레일링
  슬래시 금지)되도록 명시.
- **핸드셰이크 인증**: `auth.key`(또는 `?key=`)의 pk + `Origin` 검사. 잘못된 pk/Origin이면 거부.
- 테넌트별 네임스페이스: `tenantId` 는 pk로 해석. 채널 이름은 테넌트 범위로 격리.
- 메시지(클라이언트 → 서버): `subscribe`/`unsubscribe`(채널), `presence`(채널 참여자 조회).
- 이벤트(서버 → 클라이언트): publish된 `message`(`{channel,event,data,id,publishedAt}`),
  presence 변경(`presence:join`/`presence:leave`).

## 로컬 실행

```bash
cp .env.example .env
pnpm install
pnpm dev            # build:libs 후 api 워치 (PGlite 폴백 → DB 불필요)
# → http://localhost:4092/api/docs (Swagger), ws: http://localhost:4092/realtime
```

데모 테넌트(self-hosted 자동 시드): `pk_demo` / `sk_demo`, `corsOrigins: ['*']`.

## 검증 게이트

```bash
pnpm run verify     # typecheck + test + build
```

## 안전

- 다른 레포 절대 건드리지 않음. **neon.tech URL 금지** — 로컬은 PGlite(빈 `DATABASE_URL`)
  또는 qa-postgres(`:5433`, db `realtimedesk`).
- 포트는 FREE 하이포트만(기본 API 4092). 띄운 서버는 반드시 종료.
