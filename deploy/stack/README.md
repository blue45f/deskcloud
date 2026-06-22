# DeskCloud — 통합 운영 배포 번들

DeskCloud 패밀리의 14개 API 서비스(13개 기능 Desk + `@desk/platform`)를 **단일 도커 호스트에서
한 번에** 띄우는 배포 번들입니다. 각 서비스는 NestJS API(`apps/api`)이며, 기본은 **PGlite 임베드
DB**(외부 DB 불필요)로 동작하고, **Caddy 게이트웨이**가 단일 도메인 서브패스로 리버스 프록시합니다.
TermsDesk 의 `deploy/aws` 도커 패턴(멀티스테이지 Dockerfile + Caddy 자동 HTTPS)을 미러링했지만,
TermsDesk 프로덕션은 별도 Vercel(web) + EC2(api) 스택으로 유지됩니다.

이 번들은 현재 모노레포 루트(`../..`)를 빌드 컨텍스트로 참조하므로
`~/WebstormProjects/deskcloud/deploy/stack` 안에서 실행해야 합니다.

---

## 개발자 문서 (`docs/`)

DeskCloud 패밀리 전체의 개발자 핸드북은 [`docs/`](./docs/) 에 있습니다.

| 문서                                               | 내용                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [docs/README.md](./docs/README.md)                 | **개요** — DeskCloud 가 무엇인가, 공유 해부학, 한 줄 임베드 모델, 외부 고객 온보딩(pk/sk·CORS·사용량), 문서 인덱스             |
| [docs/SERVICES.md](./docs/SERVICES.md)             | **Desk별 레퍼런스** — 15개 서비스의 공개/어드민 라우트, 임베드 스니펫(React + `<script>`), 어드민/포털, 데모 키                |
| [docs/BUSINESS-MODEL.md](./docs/BUSINESS-MODEL.md) | **비즈니스 모델** — 플랜(Free/Pro/Scale/Enterprise)·Desk별 캡·오버리지·번들/셀프호스트·빌링(Toss/Stripe 어댑터·배지)·가격 전략 |
| [docs/DEPLOY.md](./docs/DEPLOY.md)                 | **배포** — 이 번들의 원클릭 절차·게이트웨이 라우팅 맵·라이브 전환·Neon 전환·리소스 풋프린트·WebSocket 함정                     |
| [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md)           | **형제 앱 생태계** — 13개 앱의 env-gated 위젯 소비·`/design`·시드 테스트 계정·배포된 Desk 가리키기                             |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)       | **개발 가이드** — 아무 Desk 나 로컬 빌드/실행/테스트·nest-build caveat·공유 컨벤션·새 Desk 추가·벤더링                         |

---

## 한 줄 배포

```bash
cd ~/WebstormProjects/deskcloud/deploy/stack
./gen-env.sh && docker compose up -d --build
```

또는 헬스체크까지 한 번에:

```bash
./gen-env.sh && ./deploy.sh
```

모노레포 루트에서는 같은 검증을 pnpm 스크립트로 실행할 수 있습니다.

```bash
pnpm run verify:local-stack   # compose config + 기존 이미지 재기동 + gateway health
pnpm deploy                   # 이미지 빌드 + 순차 기동 + 전체 health
```

전체 14개 API 서비스를 로컬 Docker Desktop/Colima VM 에서 한 번에 검증할 때는 `./deploy.sh` 를 권장합니다.
서비스를 하나씩 띄우고 각 컨테이너 내부 `/health` 준비 상태를 기다리므로, raw
`docker compose up -d --build` 보다 첫 부팅 피크를 다루기 쉽습니다. Colima 기준 전체 스택 검증은
20 GB VM 메모리에서 확인했습니다:

```bash
colima start --memory 20 --cpu 8
```

`gen-env.sh` 가 `.env` 를 만들고 모든 `*_ADMIN_TOKEN` 을 `openssl rand -hex 32` 로 채웁니다.
도메인·HTTPS 를 쓰려면 `.env` 의 `DESKCLOUD_DOMAIN`, `ACME_EMAIL`, `WEB_ORIGIN` 을 채우세요
(비우면 평문 HTTP `:80` 으로 동작 — 로컬·IP 직접 접속용).

---

## 포함된 API 서비스 (14개, 전부 active)

이 번들은 TermsDesk 를 제외한 13개 기능 Desk 와 `@desk/platform` 코어를 포함합니다. 전체 제품군
15개 서비스의 레퍼런스는 [docs/SERVICES.md](./docs/SERVICES.md)를 보세요.

| Desk           | 컨테이너 서비스  | 게이트웨이 경로(REST 베이스) | 비고                           |
| -------------- | ---------------- | ---------------------------- | ------------------------------ |
| SurveyDesk     | `surveydesk`     | `/survey`                    | 멀티테넌트 설문·피드백         |
| AdDesk         | `addesk`         | `/ad`                        | 광고 슬롯·캠페인               |
| AuthDesk       | `authdesk`       | `/authdesk`                  | end-user 인증                  |
| FileDesk       | `filedesk`       | `/file`                      | 파일 업로드·레지스트리         |
| ChangelogDesk  | `changelogdesk`  | `/changelog`                 | 체인지로그/릴리스 노트         |
| ReviewDesk     | `reviewdesk`     | `/review`                    | 리뷰·평점                      |
| MediaDesk      | `mediadesk`      | `/media`                     | 미디어/업로드(sharp 선택)      |
| NotifyDesk     | `notifydesk`     | `/notify`                    | 알림·공지                      |
| ModerationDesk | `moderationdesk` | `/moderation`                | 콘텐츠 모더레이션              |
| RealtimeDesk   | `realtimedesk`   | `/realtime`                  | 실시간 pub/sub **(WebSocket)** |
| SearchDesk     | `searchdesk`     | `/search`                    | 검색                           |
| CommunityDesk  | `communitydesk`  | `/community`                 | 게시판·카페                    |
| ChatDesk       | `chatdesk`       | `/chat`                      | 메시징 DM+그룹 **(WebSocket)** |
| @desk/platform | `deskplatform`   | `/platform`                  | 중앙 계정·빌링 코어(BM)        |

> 최근 합류한 `addesk` · `authdesk` · `filedesk` 도 `apps/api` 빌드 경로와 헬스체크에 포함했습니다.
> 추후 새 Desk 를 추가하는 방법은 아래 "새 Desk 추가" 절과 `docker-compose.yml` · `Caddyfile` 의
> 주석 템플릿을 참고하세요.

### 게이트웨이 라우팅 맵 (Desk → URL)

`<host>` = `DESKCLOUD_DOMAIN` 설정 시 `https://<도메인>`, 아니면 `http://<서버IP 또는 localhost>`.

```
<host>/survey/api/...        <host>/survey/health        → surveydesk
<host>/ad/api/...            <host>/ad/health            → addesk
<host>/authdesk/api/...      <host>/authdesk/health      → authdesk
<host>/file/api/...          <host>/file/health          → filedesk
<host>/changelog/api/...     <host>/changelog/health     → changelogdesk
<host>/review/api/...        <host>/review/health        → reviewdesk
<host>/media/api/...         <host>/media/health         → mediadesk
<host>/notify/api/...        <host>/notify/health        → notifydesk
<host>/moderation/api/...    <host>/moderation/health    → moderationdesk
<host>/search/api/...        <host>/search/health        → searchdesk
<host>/community/api/...     <host>/community/health     → communitydesk
<host>/platform/api/...      <host>/platform/health      → deskplatform

# WebSocket Desk — REST 는 위와 동일, WS 핸드셰이크는 아래 정확 경로:
<host>/realtime/api/...      <host>/realtime/health      → realtimedesk (REST)
ws(s)://<host>/realtime/socket.io                        → realtimedesk (socket.io)
<host>/chat/api/...          <host>/chat/health          → chatdesk     (REST)
ws(s)://<host>/chat/socket.io                            → chatdesk     (socket.io)
```

게이트웨이 자체 생존확인: `<host>/` → `DeskCloud gateway OK`.
각 Desk Swagger 문서: `<host>/<desk>/api/docs`.

#### 라우팅 동작 원리(중요)

- 모든 Desk API 는 컨테이너 내부에서 글로벌 프리픽스 `/api`(헬스는 `/health`)로 동작합니다.
- 일반 Desk: Caddy `handle_path /<desk>/*` 가 `/<desk>` 프리픽스를 **strip** 하여 업스트림이
  `/api/...`·`/health` 를 그대로 받습니다.
- **WebSocket Desk(realtime/chat)**: socket.io 는 컨테이너 안에서 서브패스(`/realtime/socket.io`,
  `/chat/socket.io`)에 **정확 매칭**으로 마운트됩니다(compose 의 `REALTIME_PATH`/`CHAT_PATH`).
  Caddy 는 WS 핸드셰이크 경로를 **strip 없이** 통과시켜 트레일링 슬래시 mismatch 를 막고,
  REST 경로만 `/<desk>` 를 strip 합니다. Caddy `reverse_proxy` 는 `Connection: Upgrade`
  WebSocket 헤더를 자동으로 통과시키므로 별도 헤더 설정이 필요 없습니다.

---

## 형제 앱에서 Desk 가리키기 (VITE\_<X>DESK_URL)

형제 앱(이력서/포트폴리오 등)의 빌드 환경변수를 게이트웨이로 향하게 합니다.
각 Desk SDK/위젯의 base URL 은 `<host>/<desk>` 형태입니다.

```bash
# 예) .env / Vercel 프로젝트 환경변수
VITE_SURVEYDESK_URL=https://desk.example.com/survey
VITE_CHANGELOGDESK_URL=https://desk.example.com/changelog
VITE_REVIEWDESK_URL=https://desk.example.com/review
VITE_REALTIMEDESK_URL=https://desk.example.com/realtime   # SDK 가 /socket.io 를 자동 부착
VITE_CHATDESK_URL=https://desk.example.com/chat
# … 나머지 Desk 동일
```

REST 호출은 `${VITE_<X>DESK_URL}/api/...`, 헬스는 `${VITE_<X>DESK_URL}/health`,
실시간은 socket.io 클라이언트에 `path: '/realtime/socket.io'`(chat 은 `/chat/socket.io`)를
지정합니다.

---

## 한 Desk 만 Neon/PostgreSQL 로 전환

기본은 PGlite 임베드(전용 도커 볼륨에 영구 저장)입니다. 특정 Desk 만 외부 DB 로 바꾸려면
`.env` 의 해당 `*_DATABASE_URL` 만 채우면 됩니다(비어 있으면 PGlite 유지).

```bash
# .env
SURVEYDESK_DATABASE_URL=postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/surveydesk?sslmode=require
```

```bash
docker compose up -d --build surveydesk   # 해당 서비스만 재기동
```

부팅 마이그레이터가 pg/PGlite 양쪽에 동일 스키마를 멱등 적용하므로 코드 변경은 없습니다.
(Neon 표준: 서비스별 free 프로젝트 · `ap-southeast-1` — 형제 레포 컨벤션과 동일.)

---

## 새 Desk 추가 (빌드 중이던 Desk 합류 등)

새 Desk 의 `apps/api` 가 준비되면:

1. 그 레포에 `apps/api/Dockerfile` 과 `.dockerignore` 가 있는지 확인(이 번들 패턴과 동일).
2. `docker-compose.yml` 의 주석 템플릿(`# foodesk:` 블록 + `# foodesk_data:` 볼륨)을
   복사·주석 해제하고 레포명/스코프(`@foodesk/api`)를 맞춥니다.
3. `Caddyfile` 에 `handle_path /foo/* { reverse_proxy foodesk:4000 }` 한 줄 추가
   (WebSocket Desk 라면 realtime/chat 블록 패턴을 복사하고 compose 에 `FOO_PATH=/foo/socket.io`).
4. `.env.example` / `.env` 에 `FOODESK_ADMIN_TOKEN` 추가(`./gen-env.sh --force` 로 재생성 가능).
5. `docker compose up -d --build foodesk` 로 합류.

---

## 운영

```bash
docker compose ps                      # 상태
docker compose logs -f surveydesk      # 로그
docker compose up -d --build           # 코드 변경 후 재빌드·재기동
docker compose restart caddy           # 게이트웨이만 재기동(Caddyfile 변경 후)
docker compose down                    # 중지(볼륨 보존)
docker compose down -v                 # 중지 + 데이터 볼륨 삭제(주의)
```

각 Desk 의 PGlite 데이터는 `<desk>_data` 명명 볼륨(`/data/pglite`)에 영구 저장되어
재기동·재배포 시 보존됩니다.

---

## 리소스 풋프린트

- **이미지**: Desk 당 `node:24-alpine` 런타임에 전체 워크스페이스를 복사하는 방식이라
  이미지 1개당 대략 **~400–600 MB**(레포별 deps 차이). 14개 → 디스크 **~6–9 GB**.
- **메모리**: 유휴 시 Desk 당 NestJS+PGlite 약 **~120–200 MB** RSS. 14개 + Caddy 합산
  **유휴 ~2.5–3 GB**, 가벼운 부하에서 **~3.5 GB** 수준. 운영 최소는 **4 GB RAM** VM 부터
  가능하지만, 전체 14개 Desk 를 로컬 Docker Desktop/Colima 에서 첫 부팅까지 검증할 때는
  마이그레이션·시드·Node 시작 피크를 감안해 **16–20 GB VM 메모리**를 권장합니다.
  2 GB VM 이면 일부 Desk 만 추려 기동하세요.
- **CPU**: 유휴는 미미. 첫 부팅 시 PGlite 마이그레이션·시드로 잠깐 스파이크.
- **네트워크 포트**: 호스트는 `80`/`443`(Caddy)만 노출. 각 API 는 컨테이너 네트워크
  내부 `4000`(expose)만 — 외부 직접 노출 없음.

`deploy.sh` 의 순차 기동 기본값은 `SERVICE_START_DELAY=5`, `SERVICE_READY_RETRIES=90`,
`SERVICE_STABILIZE_DELAY=45` 입니다. 느린 VM 이면 실행 시 환경변수로 늘릴 수 있습니다:

```bash
SERVICE_STABILIZE_DELAY=60 SERVICE_READY_RETRIES=150 ./deploy.sh --no-build
```

> **termsdesk EC2 공동배치 주의**: 그 박스는 이미 Caddy + 여러 백엔드를 호스팅합니다.
> 포트 80/443 과 Caddy vhost 충돌을 피하려면 `.env` 의 `HTTP_PORT`/`HTTPS_PORT` 를 바꾸고
> 기존 Caddy 의 상위 리버스 프록시로 이 스택을 묶거나, 별도 VM(권장)에 올리세요.

---

## 파일 구성

```
deskcloud/deploy/stack/
├─ docker-compose.yml   # 14개 API 서비스 + Caddy 오케스트레이션(YAML 앵커로 공통값 공유)
├─ Caddyfile            # 단일 도메인 서브패스 라우팅 + WS 업그레이드(realtime/chat)
├─ .env.example         # per-Desk ADMIN_TOKEN · WEB_ORIGIN · (선택) DATABASE_URL
├─ gen-env.sh           # 강한 ADMIN_TOKEN 자동 생성 → .env
├─ deploy.sh            # build + up + 각 Desk /health 헬스체크
└─ README.md            # 이 문서
```

각 Desk 레포에는 `apps/api/Dockerfile` 과 `.dockerignore` 가 추가되어 있습니다(이 번들이 참조).
