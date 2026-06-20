# Codex 핸드오프 — 약관 의뢰 중계(Brokerage)

> 이 문서를 Codex 작업 시작 시 먼저 읽히세요. 함께 볼 것: [docs/BROKERAGE.md](./BROKERAGE.md)(도메인),
> [docs/TOSS-INAPP.md](./TOSS-INAPP.md)(토스 인앱). 현재 `main` 기준 **기능 완성 + 라이브 배포 완료** 상태입니다.

## 0. 한 줄 상태

TermsDesk(약관 버전관리 SaaS, pnpm 모노레포)에 **약관 의뢰 중계 마켓플레이스**를 구축했고,
분쟁·검수 워크플로, 파일 첨부(참고자료·산출물 S3 저장), 공개 전문가 디렉터리/SEO까지 구현했다.
다음 작업은 "남은 작업"(§4)에서 고른다.

## 1. 구조 (어디에 무엇이)

- 모노레포: `apps/web`(Vite8+React19+Tailwind v4) · `apps/api`(NestJS11+Drizzle) · `packages/shared`(zod 계약) · `packages/sdk`. 스코프 `@termsdesk/*`.
- 브로커리지 공유 계약: `packages/shared/src/brokerage.ts`(enum·zod·DTO·라벨), `notification.ts`(알림). index.ts에서 export.
- API: `apps/api/src/brokerage/`(service+controller+module+test), `apps/api/src/notifications/`. DB: `apps/api/src/db/schema.ts` + `migrations.ts`(문자열 상수 배열, 새 마이그레이션은 **배열 끝에 append, 멱등 IF NOT EXISTS**). 현재 최신 마이그레이션 `0012_request_attachments`.
- 웹: `apps/web/src/pages/`(RequestsPage·RequestDetailPage·MarketplacePage·ExpertProfilePage·ModerationPage), `services/brokerage.ts`·`services/notifications.ts`(TanStack Query 훅), 라우트 `apps/web/src/router/index.tsx`, 네비 `components/layout/Sidebar.tsx`, 알림 종 `components/layout/NotificationBell.tsx`.
- 라우트: `/app/requests`·`/app/requests/:id`·`/app/marketplace`·`/app/expert`·`/app/moderation`.
  공개 라우트: `/experts`·`/experts/:id`.

## 2. 빌드·검증·커밋·푸시 (게이트)

```bash
pnpm run build:libs   # shared/sdk dist 갱신 — 소비자(api/web)는 dist 참조라 shared 수정 후 필수
pnpm run verify       # format:check + lint:ci(--max-warnings=0) + typecheck + test + build  (← 반드시 green)
```

- **dev 떠 있을 때 verify/build 금지**(api nest build가 dev dist 삭제). dev 포트 web `:5270`/api `:4070`, vite가 `/api`→4070 프록시. 데모 로그인 `admin@termsdesk.local` / `termsdesk-admin`(DEV 자동 프리필).
- 커밋: **commitlint scope-enum 화이트리스트** = `api, web, sdk, shared, deploy, docs, ci, configs, deps, security, workspace`. 그 외 스코프 거부. **본문 라인 ≤100자**. 스코프가 여러 개면 스코프별로 분할 커밋.
- pre-commit = lint-staged(eslint --fix + prettier) + `build:libs && typecheck`. pre-push = 풀 `verify`. 둘 다 통과해야 함.
- push 대상은 `main` 직접(이 repo는 PRIVATE, 로컬 verify가 게이트). push 시 Vercel이 web 자동 배포.

## 3. EC2 API 재배포 런북 (★ 필수·실수 잦음)

웹은 Vercel 자동배포지만 **API는 EC2에서 수동 재배포**해야 새 엔드포인트·마이그레이션이 라이브 적용됨.

- 접속: `ssh -i ~/.ssh/termsdesk_aws.pem ubuntu@3.107.235.143` (zsh서 변수에 ssh 통째로 넣지 말 것).
- 배포 구성: 레포 `/opt/termsdesk`, **루트 `docker-compose.yml`(번들 postgres) + untracked `docker-compose.override.yml`**(Neon DATABASE_URL·강 JWT_SECRET·`postgres` 프로필 비활성·api db의존 제거). DB = **Neon ap-southeast-1**(로컬 postgres 컨테이너 없음). 시크릿은 박스의 override.yml에만 있음(여기 미기재).
- caddy = **별도 `sibling-caddy` 컨테이너**(`/opt/sibling-caddy/Caddyfile.full` 마운트). 5개 시블링 백엔드 공존. **api만 건드리면 caddy/시블링 무영향**.
- 절차:
  ```bash
  ssh ... 'cd /opt/termsdesk && sudo git fetch origin && sudo git reset --hard origin/main'   # override.yml은 untracked라 보존됨
  ssh ... 'cd /opt/termsdesk && sudo docker compose build api'   # t3.micro라 ~15-20분, 스왑4G로 OK. ssh ServerAliveInterval 권장(연결 reset 방지)
  ssh ... 'cd /opt/termsdesk && sudo docker compose up -d --no-deps api'   # api만 재생성. 마이그레이션 부팅 자동 적용
  ```
- 검증(재기동 ~50초 후. 12초는 부족→502 잠깐):
  ```bash
  curl -s https://termsdesk.vercel.app/api/marketplace -o /dev/null -w '%{http_code}\n'   # 401 = 라우트 있음(정상). 404면 미배포
  ssh ... 'sudo docker logs --tail 15 termsdesk-api-1 | grep 마이그레이션'                 # 새 마이그레이션 적용 확인
  ```
- 데모 데이터: 라이브 데모 마켓이 비면 데모 로그인 후 `POST /api/auth/demo` 재호출(ensureDemoOrg가 seedDemoBrokerage 멱등 실행).

## 4. 남은 작업 (사용자가 방향 선택 — 우선순위 높은 순)

1. **분쟁·검수 워크플로 심화 — 구현 완료**:
   - `0011_disputes`: `service_requests.flagged`/`dispute_note` + 분쟁 큐 인덱스.
   - 참여자 의뢰/메시지 이의제기(`POST /requests/:id/flag`) → 운영자 분쟁 큐 + 알림.
   - 검수 반려(`POST /requests/:id/request-revision`) → `delivered → in_progress` 재작업 요청.
   - 운영자 `adminUpdateRequest` 확장: 분쟁 해제, 강제 취소, 모의 에스크로 정산/환불 결정.
2. **파일 첨부 — 구현 완료**:
   - `0012_request_attachments`: 메시지/산출물 첨부 메타 + S3 object key.
   - `POST /requests/:id/attachments` 업로드, `GET /requests/:id/attachments/:attachmentId` 다운로드.
   - EC2 override에 `BROKERAGE_ATTACHMENTS_S3_*`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 설정.
   - AWS: 전용 버킷 `termsdesk-brokerage-attachments-945203151945-ap-southeast-2`, IAM 사용자 `termsdesk-attachments`(bucket `brokerage/*` Put/Get).
3. **실시간 알림·메시지**: WebSocket(Socket.IO). sibling-caddy의 `/socket.io` 경로 함정 주의(remote-devtools 전례: WsAdapter 정확매칭·no트레일링). 현재는 60초 폴링(`useUnreadCount`).
4. **공개 전문가 디렉터리·SEO — 구현 완료**:
   - 무인증 `GET /api/public/providers`, `GET /api/public/providers/:id`.
   - 웹 `/experts`, `/experts/:id` 공개 목록/상세 + 런타임 title/OG/canonical.
   - `/api/public/sitemap.xml`에 공개 디렉터리와 active 전문가 URL 동적 포함.
   - 연락처는 항상 비노출, active=false 단건은 404.

## 5. 함정 체크리스트

- **shared 수정 후 `pnpm run build:libs`** 안 하면 api/web가 옛 타입(dist) 참조.
- 폼 숫자(`valueAsNumber`) 빈값은 **NaN** → zod 거부. 선택 정수는 `optionalIntInRange`(shared, preprocess로 ''/null/NaN→undefined) 사용.
- `apps/api`는 eslint `consistent-type-imports` **off**(NestJS DI 깨짐). 주입 클래스는 **값 import**.
- import 순서 eslint `import-x/order` 알파벳(경로 기준). 위반 시 lint 실패.
- Tailwind v4: `@theme`(라이트)+`.dark{}` 오버라이드, base 리셋은 `@layer base`.
- dev 전용: `@heejun/deskcloud`가 `socket.io-client` 동적 import → vite `optimizeDeps.exclude: ['@heejun/deskcloud']`로 해결됨(건드리지 말 것).
- `.playwright-mcp/`는 .gitignore됨(브라우저 검증 아티팩트).
- 접근제어 불변식: 비참여자는 open 의뢰만 guest 열람, 그 외 404(존재 누설 금지). 운영자=첫(가장 오래된) org + member.manage. 전문가=활성 provider_profile.
- 금액/에스크로는 **결정·표시 전용, 실제 자금 이동 없음**(money-movement 경계). 실결제 구현 금지(mock만).
- 분쟁 정보(`flagged`/`disputeNote`)는 참여자·운영자에게만 노출한다. 마켓/guest 뷰에는 의뢰자 담당자명처럼 숨김.
- 첨부 파일은 API가 S3 객체를 프록시해 권한 재검사한다. S3 객체 URL을 클라이언트에 직접 노출하지 말 것. 루트키(`rootkey.csv`)는 앱/EC2에 넣지 말고 전용 IAM 키만 사용.

## 6. Codex 킥오프 프롬프트(붙여넣기용)

```
termsdesk 모노레포에서 약관 의뢰 중계 마켓플레이스를 이어서 고도화한다.
먼저 docs/CODEX-HANDOFF.md 와 docs/BROKERAGE.md 를 읽어 현재 상태·런북·함정을 파악하라.
작업: §4의 남은 작업 중 하나를 선택해 구현한다.
규칙: shared 수정 후 build:libs, 변경마다 pnpm run verify(green 필수), commitlint scope-enum 준수·본문≤100자,
스코프별 분할 커밋 후 main 푸시. API 변경(엔드포인트/마이그레이션)이면 §3 런북으로 EC2 재배포(--no-deps api)까지.
기존 brokerage.service 상태전이·notifications.notify·adminUpdateRequest 패턴을 그대로 확장하라.
```
