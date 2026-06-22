# DEPLOY — 프로덕션 배포

`deploy/stack` 번들로 14개 API 서비스(13개 기능 Desk + `@desk/platform`) + Caddy 게이트웨이를
**단일 도커 호스트에서 한 번에** 띄웁니다. 기본 DB 는 PGlite 임베드(외부 DB 불필요), 필요 시
Desk별로 Neon/PostgreSQL 로 승격합니다. TermsDesk 프로덕션은 이 번들에 포함하지 않고 별도
Vercel(web) + EC2(api) 스택으로 유지합니다.

> 번들 파일: [`../docker-compose.yml`](../docker-compose.yml) · [`../Caddyfile`](../Caddyfile) ·
> [`../.env.example`](../.env.example) · [`../gen-env.sh`](../gen-env.sh) · [`../deploy.sh`](../deploy.sh).
> 서비스 라우트는 [SERVICES.md](./SERVICES.md), 플랜·빌링은 [BUSINESS-MODEL.md](./BUSINESS-MODEL.md).

---

## 1. 사전 조건

- 번들은 **deskcloud 모노레포 루트를 빌드 컨텍스트로 참조**합니다(`build.context: ../..`). 따라서
  `~/WebstormProjects/deskcloud/deploy/stack` 안에서 실행해야 합니다.
- 각 Desk 레포에는 `apps/api/Dockerfile` + `.dockerignore` 가 있어야 합니다(번들이 이를 사용).
- Docker + docker compose v2(또는 v1 `docker-compose`).
- VM 권장 사양: 운영 최소는 **4 GB RAM** 부터 가능하지만, 로컬 Docker Desktop/Colima 에서
  14개 Desk 전체 첫 부팅까지 검증할 때는 **16–20 GB VM 메모리**를 권장합니다(아래 §7 풋프린트).

---

## 2. 원클릭 배포

```bash
cd ~/WebstormProjects/deskcloud/deploy/stack

# (a) .env 생성 — 모든 *_ADMIN_TOKEN 을 openssl rand -hex 32 로 채움
./gen-env.sh

# (b) 빌드 + 기동 + 각 Desk /health 헬스체크
./deploy.sh
```

또는 compose 직접:

```bash
./gen-env.sh && docker compose up -d --build
```

모노레포 루트에서는 같은 동작을 아래 스크립트로 실행한다.

```bash
pnpm deploy                  # build + up + 전체 gateway health
pnpm run verify:local-stack  # compose config + no-build 재기동 + health
pnpm run verify:live         # 운영 웹/라우트/대시보드/TermsDesk 검증
```

`deploy.sh` 는 서비스별 순차 build/up, 컨테이너 내부 `/health` 준비 대기, 게이트웨이(`<host>/`)
기동 대기, 14개 API 서비스의 `/<desk>/health` 200 확인을 수행합니다(PGlite 마이그레이션·시드까지
시간이 걸릴 수 있어 재시도 포함). `./deploy.sh --no-build` 는 빌드 생략,
`BASE_URL=https://… ./deploy.sh` 는 외부 도메인으로 헬스체크.

로컬 Colima 에서 전체 스택 검증 시:

```bash
colima start --memory 20 --cpu 8
SERVICE_STABILIZE_DELAY=60 SERVICE_READY_RETRIES=150 ./deploy.sh --no-build
```

---

## 3. 환경변수 (.env)

`gen-env.sh` 가 채우는 토큰 외에, 도메인·CORS·(선택) DB 를 검토합니다.

```bash
# 게이트웨이 — 도메인 설정 시 Caddy 자동 HTTPS(Let's Encrypt). 비우면 평문 :80(로컬/IP).
DESKCLOUD_DOMAIN=desk.example.com
ACME_EMAIL=ops@example.com

# 호스트 포트(공동배치 충돌 시 변경 — 예: termsdesk EC2)
HTTP_PORT=80
HTTPS_PORT=443

# 모든 Desk 가 CORS/쿠키에 쓸 기본 출처(도메인 있으면 https://<도메인>)
WEB_ORIGIN=https://desk.example.com
TZ=Asia/Seoul
DESK_API_MEM_LIMIT=8g
NODE_OPTIONS=--max-old-space-size=512

# per-service 어드민 토큰(X-Admin-Token 헤더와 일치) — gen-env.sh 가 자동 생성
SURVEYDESK_ADMIN_TOKEN=…
CHANGELOGDESK_ADMIN_TOKEN=…
# … (13개 기능 Desk + DESKPLATFORM_ADMIN_TOKEN)

# (선택) 빌링 — TEST/STUB 전용. 실제 결제 없음(BUSINESS-MODEL.md §5/§7)
DESK_BILLING_PROVIDER=stub

# (선택) per-Desk 외부 DB — 비우면 PGlite 유지
# SURVEYDESK_DATABASE_URL=postgresql://…
```

- `gen-env.sh` 는 기존 `.env` 를 덮어쓰지 않습니다(`--force` 로만). 토큰 확인: `grep ADMIN_TOKEN .env`.
- `WEB_ORIGIN` 이 비어 있으면 `http://localhost` 기본값. 임베드 위젯 교차출처는 각 API 의
  `enableCors(origin:true)` + 테넌트 CORS allowlist 가 담당하므로 위젯은 도메인 무관하게 동작합니다.

---

## 4. 게이트웨이 라우팅 맵

`<host>` = `DESKCLOUD_DOMAIN` 설정 시 `https://<도메인>`, 아니면 `http://<서버IP 또는 localhost>`.
모든 Desk API 는 컨테이너 내부에서 글로벌 프리픽스 `/api`(헬스 `/health`)로 동작하고, Caddy 가
서브패스를 strip 합니다.

```
<host>/                       → "DeskCloud gateway OK" (게이트웨이 자체 헬스)
<host>/survey/api/...         <host>/survey/health        → surveydesk
<host>/ad/api/...             <host>/ad/health            → addesk
<host>/authdesk/api/...       <host>/authdesk/health      → authdesk
<host>/file/api/...           <host>/file/health          → filedesk
<host>/changelog/api/...      <host>/changelog/health     → changelogdesk
<host>/review/api/...         <host>/review/health        → reviewdesk
<host>/media/api/...          <host>/media/health         → mediadesk
<host>/notify/api/...         <host>/notify/health        → notifydesk
<host>/moderation/api/...     <host>/moderation/health    → moderationdesk
<host>/search/api/...         <host>/search/health        → searchdesk
<host>/community/api/...      <host>/community/health     → communitydesk
<host>/platform/api/...       <host>/platform/health      → deskplatform

# WebSocket Desk — REST 는 위와 동일, WS 핸드셰이크는 정확 경로:
<host>/realtime/api/...       <host>/realtime/health      → realtimedesk (REST)
ws(s)://<host>/realtime/socket.io                         → realtimedesk (socket.io)
<host>/chat/api/...           <host>/chat/health          → chatdesk     (REST)
ws(s)://<host>/chat/socket.io                             → chatdesk     (socket.io)
```

각 Desk Swagger: `<host>/<desk>/api/docs`. 위젯 IIFE 로더: `<host>/<desk>/<widget>.js`
(예: `<host>/changelog/changelog-widget.js`).

### 동작 원리

- **일반 Desk**: Caddy `handle_path /<desk>/*` 가 `/<desk>` 프리픽스를 **strip** → 업스트림이
  `/api/...`·`/health` 를 그대로 받음.
- **WebSocket Desk(realtime/chat)**: 아래 §8 WS 함정 참고.

---

## 5. 라이브로 가기 (도메인 + HTTPS)

1. DNS A 레코드를 서버 IP 로(`desk.example.com → x.x.x.x`).
2. `.env` 에 `DESKCLOUD_DOMAIN=desk.example.com`, `ACME_EMAIL=...`, `WEB_ORIGIN=https://desk.example.com`.
3. `docker compose up -d --build` (또는 `./deploy.sh`).
4. Caddy 가 Let's Encrypt 인증서를 자동 발급(80/443 인바운드 열려 있어야 함).
5. 확인: `curl https://desk.example.com/` → `DeskCloud gateway OK`, 그리고
   `BASE_URL=https://desk.example.com ./deploy.sh --no-build` 로 전 Desk 헬스 그린.

도메인을 비우면 `:80` 평문 HTTP 로 동작(로컬·IP 직접 접속·테스트용).

---

## 6. 한 Desk 만 Neon/PostgreSQL 로 전환

기본은 PGlite 임베드(전용 도커 볼륨 `<desk>_data:/data/pglite` 에 영구 저장). 특정 Desk 만 외부
DB 로 바꾸려면 해당 `*_DATABASE_URL` 만 채웁니다(비어 있으면 PGlite 유지).

```bash
# .env
SURVEYDESK_DATABASE_URL=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/surveydesk?sslmode=require
```

```bash
docker compose up -d --build surveydesk   # 해당 서비스만 재기동
```

부팅 마이그레이터가 pg/PGlite 양쪽에 **동일 스키마를 멱등 적용**하므로 코드 변경은 없습니다.
(Neon 표준: 서비스별 free 프로젝트 · `ap-southeast-1` — 형제 레포 컨벤션과 동일.)

---

## 7. 리소스 풋프린트

- **이미지**: Desk 당 `node:24-alpine` 런타임에 워크스페이스 복사 → 이미지 1개당 **~400–600 MB**.
  14개 → 디스크 **~6–9 GB**.
- **메모리**: 유휴 시 Desk 당 NestJS+PGlite **~120–200 MB** RSS. 14개 + Caddy 합산 **유휴 ~2.5–3 GB**,
  가벼운 부하 **~3.5 GB**. 운영 최소는 **4 GB RAM**(t3.medium / e2-medium) 부터 가능하지만,
  전체 14개 Desk 를 로컬 Docker Desktop/Colima 에서 첫 부팅까지 검증할 때는 마이그레이션·시드·Node
  시작 피크를 감안해 **16–20 GB VM 메모리**를 권장합니다. 2 GB VM 이면 일부 Desk 만 추려 기동.
- **CPU**: 유휴는 미미. 첫 부팅 시 PGlite 마이그레이션·시드로 잠깐 스파이크.
- **포트**: 호스트는 `80`/`443`(Caddy)만 노출. 각 API 는 컨테이너 네트워크 내부 `4000`(expose)만 —
  외부 직접 노출 없음.

`deploy.sh` 의 순차 기동 기본값은 `SERVICE_START_DELAY=5`, `SERVICE_READY_RETRIES=90`,
`SERVICE_STABILIZE_DELAY=45` 입니다. 느린 VM 이면 실행 시 환경변수로 늘릴 수 있습니다.

> **termsdesk EC2 공동배치 주의**: 그 박스는 이미 Caddy + 여러 백엔드를 호스팅합니다. 포트 80/443 ·
> Caddy vhost 충돌을 피하려면 `.env` 의 `HTTP_PORT`/`HTTPS_PORT` 를 바꾸고 기존 Caddy 상위
> 리버스 프록시로 이 스택을 묶거나, 별도 VM(권장)에 올리세요.

---

## 8. WebSocket 함정 (realtime / chat) — 중요

socket.io 는 서브패스 게이트웨이에서 트레일링 슬래시/프리픽스 mismatch 로 자주 깨집니다. 이 번들은
다음으로 해결합니다:

- **컨테이너 안에서 socket.io path 를 서브패스로 마운트**: compose 가 `REALTIME_PATH=/realtime/socket.io`,
  `CHAT_PATH=/chat/socket.io` 를 주입 → 업스트림 socket.io 가 그 경로에 **정확 매칭**으로 뜸.
- **Caddy 는 WS 핸드셰이크 경로를 strip 없이 통과**, REST 경로만 `/<desk>` strip:

```caddy
handle /realtime/* {
    @ws path /realtime/socket.io*
    reverse_proxy @ws realtimedesk:4000      # WS: strip 없이 통과(정확 매칭)

    uri strip_prefix /realtime
    reverse_proxy realtimedesk:4000          # REST: /realtime strip → /api·/health
}
```

- `reverse_proxy` 는 `Connection: Upgrade` WebSocket 헤더를 **자동 통과**시키므로 별도 헤더 설정
  불필요.
- **클라이언트는 path 를 명시**해야 함: socket.io 클라이언트에 `path: '/realtime/socket.io'`
  (chat 은 `/chat/socket.io`). SDK(`@realtimedesk/sdk`, `@chatdesk/sdk`)는 `path` 옵션으로 전달.
- 흔한 증상: WS 가 polling 으로만 붙거나 404 → path mismatch 또는 트레일링 슬래시. 위 정확 매칭이
  이를 막습니다.

> **TermsDesk realtime 은 별도 스택**입니다. TermsDesk API 는 Socket.IO path 를 `/socket.io` 로
> 직접 마운트하므로, TermsDesk Caddy/Vercel rewrite 는 `/socket.io*` 를 API 업스트림으로 보내고
> SPA fallback 보다 먼저 매칭해야 합니다. 세션 사용자는 `GET /api/realtime/token` 으로 단기 토큰과
> `{ origin, path: "/socket.io" }` 를 받아 연결합니다.

---

## 9. 운영 커맨드

```bash
docker compose ps                      # 상태
docker compose logs -f surveydesk      # 로그
docker compose up -d --build           # 코드 변경 후 재빌드·재기동
docker compose restart caddy           # 게이트웨이만 재기동(Caddyfile 변경 후)
docker compose down                    # 중지(볼륨 보존)
docker compose down -v                 # 중지 + 데이터 볼륨 삭제(주의!)
```

각 Desk 의 PGlite 데이터는 `<desk>_data` 명명 볼륨(`/data/pglite`)에 영구 저장되어 재기동·재배포
시 보존됩니다.

---

## 10. 새 Desk 추가

새 Desk 의 `apps/api` 가 준비되면:

1. 그 레포에 `apps/api/Dockerfile` + `.dockerignore` 확인(번들 패턴과 동일).
2. `docker-compose.yml` 의 주석 템플릿(`# foodesk:` 블록 + `# foodesk_data:` 볼륨)을 복사·해제,
   레포명/스코프(`@foodesk/api`) 맞춤.
3. `Caddyfile` 에 `handle_path /foo/* { reverse_proxy foodesk:4000 }` 한 줄(WS Desk 면 realtime/chat
   블록 복사 + compose 에 `FOO_PATH=/foo/socket.io`).
4. `.env.example`/`.env` 에 `FOODESK_ADMIN_TOKEN` 추가(`./gen-env.sh --force` 로 재생성 가능).
5. `docker compose up -d --build foodesk` 로 합류.

새 Desk 자체를 템플릿에서 만드는 법은 [DEVELOPMENT.md](./DEVELOPMENT.md) 참고.

---

## 11. 형제 앱을 배포된 Desk 로 가리키기

형제 앱(Vite/Next)의 빌드 환경변수를 게이트웨이로 향하게 합니다. Desk SDK/위젯의 base URL 은
`<host>/<desk>` 형태:

```bash
VITE_SURVEYDESK_URL=https://desk.example.com/survey
VITE_CHANGELOGDESK_URL=https://desk.example.com/changelog
VITE_REVIEWDESK_URL=https://desk.example.com/review
VITE_REALTIMEDESK_URL=https://desk.example.com/realtime   # SDK 에 path:'/realtime/socket.io'
VITE_CHATDESK_URL=https://desk.example.com/chat           # SDK 에 path:'/chat/socket.io'
# … 나머지 Desk 동일
```

REST 는 `${VITE_<X>DESK_URL}/api/...`, 헬스는 `${VITE_<X>DESK_URL}/health`. 형제 앱들의 실제
소비 현황(env-gated 위젯 패턴)은 [ECOSYSTEM.md](./ECOSYSTEM.md).
