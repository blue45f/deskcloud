# DeskCloud — 개발자 문서

> **DeskCloud** 는 앱이라면 반복해서 만들게 되는 공통 기능들(약관·설문·체인지로그·리뷰·
> 미디어·알림·모더레이션·실시간·검색·커뮤니티·채팅)을 **드롭인 멀티테넌트 SaaS** 로 떼어낸
> 패밀리입니다. 신규 앱은 자기 DB·자기 백엔드를 짜는 대신, 발급받은 **publishable 키 한 줄**로
> 위젯을 임베드하면 끝입니다.

이 문서는 `deploy/stack`(DeskCloud 의 중앙 배포/운영 허브) 레포에 들어 있습니다. 각 Desk
서비스 자체의 코드/README 가 1차 소스이며, 이 문서는 그것을 **횡단 정리**한 개발자 핸드북입니다.

> 📍 **현재 라이브/배포 상태와 풀스택 라이브까지 남은 단계**는 [STATUS.md](./STATUS.md) 참조.
> 포털은 이미 라이브입니다 → https://desk-platform.vercel.app

---

## 1. DeskCloud 가 무엇인가

하나의 앱을 만들 때마다 거의 항상 다시 짜게 되는 것들이 있습니다 — "법적 약관 동의 받기",
"사용자 피드백 모으기", "What's new 띄우기", "별점·후기 받기", "이미지 업로드/리사이즈",
"알림 보내기", "신고 받고 모더레이션하기", "실시간으로 밀어주기", "검색창 달기", "게시판 만들기",
"채팅 붙이기", "광고 슬롯 달기", "인증 위임하기", "파일 레지스트리 붙이기". DeskCloud 는 이 14가지를 **각각 독립한 멀티테넌트 SaaS 마이크로서비스("Desk")**
로 만들어 두고, 어떤 앱이든 **외부 고객으로 가입(self-serve)** 해서 키를 받고 위젯을 꽂으면
바로 쓰게 합니다.

- **14개 기능 Desk** + **1개 플랫폼 코어**(`@desk/platform`) = 15개 서비스
- 전부 같은 **공유 해부학(shared anatomy)** 을 따릅니다 (아래 §3)
- 운영 번들은 **PGlite 임베드**(외부 DB 불필요) — 13개 기능 Desk + 플랫폼 코어를 한 호스트에서 기동
- 운영 시 특정 Desk 만 **Neon/PostgreSQL** 로 승격 가능

---

## 2. "한 줄 임베드" 모델

소비자(형제 앱)는 백엔드를 새로 만들지 않습니다. publishable 키와 엔드포인트만 주면 위젯이
자기 일을 합니다. 두 가지 임베드 경로가 있습니다.

**(a) React 컴포넌트** — 형제 앱이 React면 단일파일 벤더 컴포넌트를 복사해 마운트:

```tsx
import { FeedbackWidget } from "./components/feedback/FeedbackWidget";

// 환경변수 미설정 시 렌더되지 않아 앱에 무해 — env-gated 패턴이 표준.
{
  import.meta.env.VITE_SURVEYDESK_URL && (
    <FeedbackWidget
      appId="myapp"
      endpoint={import.meta.env.VITE_SURVEYDESK_URL}
    />
  );
}
```

**(b) 바닐라 `<script>` 로더** — 어떤 사이트든(정적 HTML 포함) 게이트웨이가 서빙하는
IIFE 번들 한 줄:

```html
<script src="https://desk.example.com/changelog/changelog-widget.js"></script>
<script>
  ChangelogDesk.init({
    publishableKey: "pk_demo",
    endpoint: "https://desk.example.com/changelog",
  });
</script>
```

각 Desk 의 정확한 컴포넌트명·스크립트 파일명·전역 객체명·임베드 스니펫은
[SERVICES.md](./SERVICES.md) 에 정리돼 있습니다.

---

## 3. 공유 해부학 (모든 Desk 가 따르는 패턴)

14개 Desk + 플랫폼 코어는 의도적으로 **같은 구조**를 공유합니다. 하나를 이해하면 전부 이해됩니다.

```
<desk>/                          예) surveydesk, changelogdesk, reviewdesk …
├─ packages/shared               순수 Zod 스키마 · 도메인 타입 · 상수(플랜 한도)
├─ apps/api                      NestJS 11 + Drizzle ORM
│  ├─ 전역 프리픽스 /api · 헬스 /health · Swagger /api/docs
│  └─ DB: DATABASE_URL 있으면 PostgreSQL, 없으면 PGlite 폴백(부팅 마이그레이터+시드)
├─ apps/web                      Vite + React 어드민 콘솔 (+ /design 리빙 스타일가이드)
├─ packages/widget | packages/sdk  React 컴포넌트 + 바닐라 IIFE 로더(전역 객체)
└─ apps-vendor                   단일파일 벤더 위젯(npm publish 막혀 복붙용)
```

공통 규약:

| 항목              | 규약                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| **외부 온보딩**   | `POST /api/tenants` → publishable 키(`pk_…`) + secret 키(`sk_…`, 1회 노출) |
| **공개 인증**     | publishable 키 + per-tenant **CORS allowlist**(Origin 검사, `*`=전체 허용) |
| **어드민 인증**   | secret 키(`sk_…`) 또는 글로벌 `X-Admin-Token`(self-hosted)                 |
| **사용량 미터링** | 호출마다 `usageCount` 증가 · **free 플랜 캡** 초과 시 차단(소프트/하드)    |
| **데모 테넌트**   | self-hosted 부팅 시 `pk_demo` / `sk_demo` 멱등 시드                        |
| **DB**            | Drizzle + PGlite 폴백 · 부팅 마이그레이터(`MIGRATIONS[]`, 멱등)            |
| **빌드**          | `nest build`(= nest/tsc) — **tsx 가 아님**. dev 는 `nest start --watch`    |
| **검증 게이트**   | `pnpm run verify` = typecheck + test + build                               |

> **인증 헤더는 Desk 마다 이름이 다릅니다.** 일부는 `x-pk`/`x-sk`, 일부는
> `Authorization: Bearer pk_…`, 일부는 `X-Realtime-Key`/`X-Chat-Key` 를 씁니다.
> 정확한 헤더명은 [SERVICES.md](./SERVICES.md) 의 Desk별 표를 보세요.

---

## 4. 외부 고객 온보딩 (pk / sk / CORS / 사용량)

외부 온보딩형 Desk(changelog/review/media/notify/moderation/realtime/search/community/chat/
platform)는 누구나 셀프서브로 가입합니다:

```bash
# 1) 가입 — publishable + secret 키 발급(secret 은 응답에 1회만 평문 노출)
curl -X POST https://desk.example.com/changelog/api/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","corsOrigins":["https://app.acme.com"]}'
# → { "tenant": {...}, "publishableKey": "pk_live_…", "secretKey": "sk_live_…" }

# 2) 프론트 임베드 — pk 로 위젯이 읽기/수집. Origin 이 corsOrigins 에 있어야 통과.
# 3) 서버/어드민 — sk 로 CRUD·게시·검수·집계. sk 는 절대 브라우저에 노출 금지.
```

- **publishable 키(`pk_…`)**: 평문 저장, 브라우저 안전. **Origin 이 테넌트 CORS allowlist 에
  일치**해야 동작.
- **secret 키(`sk_…`)**: SHA-256 해시로만 저장(평문 미저장). 가입·키회전 응답에서 **1회만** 노출.
- **사용량**: 공개 호출마다 카운트가 올라가고, **free 플랜 캡** 초과 시 차단(`402` 등) — Desk별
  캡 값은 [BUSINESS-MODEL.md](./BUSINESS-MODEL.md).
- **키 회전**: `POST .../admin/tenant/rotate-keys` 로 새 pk/sk 발급(기존 즉시 무효, sk 1회 노출).

> **데모로 바로 써보기**: 모든 Desk 는 `pk_demo` / `sk_demo` 데모 테넌트(`corsOrigins: ['*']`)가
> 시드돼 있어 가입 없이 즉시 호출됩니다.

---

## 5. 문서 인덱스

| 문서                                     | 내용                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [SERVICES.md](./SERVICES.md)             | **Desk별 레퍼런스** — 퀵 레퍼런스 표 + 각 Desk 의 공개/어드민 라우트, 임베드 스니펫(React + `<script>`), 어드민/포털, 데모 키                                            |
| [BUSINESS-MODEL.md](./BUSINESS-MODEL.md) | **비즈니스 모델** — 플랜(Free/Pro/Scale/Enterprise) + Desk별 캡 + 오버리지 + 번들/셀프호스트 라이선스 + 빌링(Toss/Stripe 어댑터·배지) + 가격 전략·타깃                   |
| [DEPLOY.md](./DEPLOY.md)                 | **프로덕션 배포** — `deploy/stack` 번들(docker-compose + Caddy, PGlite/Neon), 원클릭 절차, 게이트웨이 라우팅 맵, 라이브 전환, Neon 전환, 리소스 풋프린트, WebSocket 함정 |
| [ECOSYSTEM.md](./ECOSYSTEM.md)           | **형제 앱 생태계** — 13개 앱이 DeskCloud 를 소비하는 법(env-gated 위젯 패턴), 앱별 `/design`·시드 테스트 계정·SurveyDesk 통합 현황, 배포된 Desk 로 앱 가리키기           |
| [DEVELOPMENT.md](./DEVELOPMENT.md)       | **개발 가이드** — 아무 Desk 나 로컬 빌드/실행/테스트(PGlite 기본·`pnpm dev`·`pnpm run verify`·nest-build caveat), 공유 컨벤션, 템플릿에서 새 Desk 추가, 벤더링 접근      |

### 관련 운영 파일 (이 레포 루트)

- [`../README.md`](../README.md) — 배포 번들 개요(13 기능 Desk + 플랫폼 코어 + Caddy 한방 기동)
- [`../docker-compose.yml`](../docker-compose.yml) — 13개 기능 Desk + 플랫폼 코어 + Caddy 오케스트레이션
- [`../Caddyfile`](../Caddyfile) — 단일 도메인 서브패스 라우팅 + WS 업그레이드
- [`../.env.example`](../.env.example) · [`../gen-env.sh`](../gen-env.sh) · [`../deploy.sh`](../deploy.sh)

---

## 6. 패밀리 한눈에

| Desk           | 기능                                  | 게이트웨이 경로 |  외부 온보딩   |
| -------------- | ------------------------------------- | --------------- | :------------: |
| TermsDesk      | 약관/정책 버전관리 + 동의 영수증      | (별도 배포)     | API Key(scope) |
| SurveyDesk     | 설문/피드백 수집                      | `/survey`       |   appId 기반   |
| ChangelogDesk  | 체인지로그/What's new                 | `/changelog`    |    ✅ pk/sk    |
| ReviewDesk     | 평점·리뷰·후기(testimonials)          | `/review`       |    ✅ pk/sk    |
| MediaDesk      | 업로드·변환·CDN 서빙                  | `/media`        |    ✅ pk/sk    |
| NotifyDesk     | 알림(인앱/이메일/웹푸시)              | `/notify`       |    ✅ pk/sk    |
| ModerationDesk | 콘텐츠 모더레이션 + 신고              | `/moderation`   |    ✅ pk/sk    |
| RealtimeDesk   | 실시간 pub/sub + presence (WS)        | `/realtime`     |    ✅ pk/sk    |
| SearchDesk     | 호스티드 검색 + ⌘K                    | `/search`       |    ✅ pk/sk    |
| CommunityDesk  | 게시판/카페/포럼                      | `/community`    |    ✅ pk/sk    |
| ChatDesk       | DM + 그룹 채팅 (WS)                   | `/chat`         |    ✅ pk/sk    |
| @desk/platform | 멀티테넌트 코어 + 빌링/BM + 통합 포털 | `/platform`     |    ✅ pk/sk    |

자세한 내용은 [SERVICES.md](./SERVICES.md) 로.
