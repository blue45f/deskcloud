# DeskCloud Admin Console Operations

DeskCloud 운영 콘솔은 가입회사 테넌트를 중심으로 서비스 도메인, Desk, API 키,
사용량, 빌링을 한 화면에서 관리한다. `seo-gateway`, `remote-devtools`처럼
별도 runtime 특성을 가진 Desk도 control-plane은 DeskCloud 콘솔에서 통합한다. `aidigestdesk`는
일반 서비스 성격으로 DeskCloud SaaS 운영 경계 밖에 두며, 이 콘솔의 Workspace Desk 대상에
포함하지 않는다.

`SEOGatewayDesk`와 `RemoteDevTools`의 구체적인 루트 명령, 라우팅, 원본 저장소 처리
기준은 `docs/DEVELOPER-DESKS-INTEGRATED-OPERATIONS.md`를 따른다.

## 운영 단위

| 단위           | 역할                                                                |
| -------------- | ------------------------------------------------------------------- |
| Tenant         | 가입회사 계정, 플랜, publishable/secret key, 월간 사용량의 기준     |
| Service origin | 브라우저 SDK 호출을 허용하는 도메인 allowlist                       |
| Desk           | TermsDesk, SEOGatewayDesk, RemoteDevTools 같은 기능별 운영 표면     |
| Workspace Desk | 소스는 모노레포에 통합됐지만 별도 런타임/data-plane을 유지하는 Desk |
| Usage/Billing  | Desk별 primary metric을 테넌트 월간 한도와 결제 상태에 연결         |

## Workspace Desk 경계

| Desk           | Control-plane                               | Data-plane                                                     | 운영 콘솔 표면                                            |
| -------------- | ------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| SEOGatewayDesk | Tenant, origin, usage, plan limit, billing  | Fastify render gateway, Puppeteer pool, cache/SWR, SEO gates   | route rule, cache warm/invalidate, Lighthouse/VisualDiff  |
| RemoteDevTools | Tenant, origin, usage, billing, integration | NestJS/TypeORM CDP gateway, rrweb replay, S3, issue connectors | live session, replay queue, SDK domain, Jira/Slack/Sheets |

이 경계는 성능상 중요한 런타임을 억지로 NestJS/Drizzle 단일 형태로 합치지 않기 위한
의도적인 구조다. 대신 운영자 관점의 계정, 도메인, 키, 사용량, 빌링, 감사 표면은
DeskCloud 콘솔에 통합한다. `aidigestdesk`는 SaaS Workspace Desk가 아니므로 manifest,
dashboard, gateway, billing 경계에서 제외한다.

따라서 운영 원칙은 "분리 배포 금지"가 아니라 "분리 control-plane 금지"이다. SEO 렌더
게이트웨이와 CDP/rrweb 데이터플레인은 각자의 런타임을 유지할 수 있지만, 고객에게 보이는
관리 진입점과 요금 경계는 DeskCloud 하나로 고정한다.

## 전수 운영 점검 실행

루트에서 아래 순서로 통합 운영 상태를 반복 점검한다.

```bash
pnpm run verify:prod-platform    # workspace manifest parity
pnpm run verify:production      # 공개 라우트 + dashboard + manifest 통합 점검
pnpm run verify:prod-routes     # (선택) 공개 라우트만 정밀 추적
pnpm run verify:dashboard       # (선택) /dashboard#integration-verification, docs matrix
pnpm run verify:termsdesk       # (선택) TermsDesk 카탈로그 → 런타임 플로우
pnpm run verify:production:full # TermsDesk 런타임 포함 전체 통합 점검(termsdesk 런타임 가용 시)
pnpm run verify:live            # verify:production:full 별칭
```

`pnpm run verify:production`은 `verify:prod-platform`과 통합 점검 스크립트가 모두 통과하는지
확인한다. `./.local/verification/verify-production-summary.json`에는 마지막으로 실행된 점검 모드의
결과가 남는다.
추가로 `verify:prod-routes`, `verify:dashboard`, `verify:termsdesk`는 개별 증적 수집을 위해
별도 실행할 수 있다.
스크린샷은 `./.local/verification/*`에 `route-*`, `dashboard-*`, `termsdesk-*` 네이밍으로 저장된다.

## 콘솔 검증 항목

운영 배포 전후에는 최소한 아래 항목을 확인한다.

```bash
pnpm --filter @desk/web typecheck
pnpm --filter @desk/web build
pnpm --filter @desk/web test
pnpm run verify:developer-desks
```

브라우저에서는 다음 라우트를 확인한다.

```text
/dashboard?desk=seo-gateway
/dashboard?desk=remote-devtools
/desks/seo-gateway
/desks/remote-devtools
/docs
```

대시보드는 `dc-tenant-token`이 없으면 로그인 프리뷰 페이지로 이동한다. 콘솔 내부를
검증할 때는 로컬/스모크 테스트에서 `localStorage.dc-tenant-token`을 설정한 뒤
`Workspace Desk 통합 상태`, `통합 운영 콘솔`, `서비스 도메인 격리`가 모두 보이는지
확인한다.

## 성능 기준

웹 앱 루트에서는 Firebase Auth SDK를 정적으로 로드하지 않는다. `VITE_FIREBASE_*`
설정이 실제로 있고 인증 상태를 확인해야 할 때만 동적 import로 로드한다. 공개 카탈로그,
문서, 마이크로사이트 방문자가 Firebase 번들을 초기 chunk로 받지 않게 하기 위한 기준이다.

빌드 산출물에서 확인할 신호는 다음과 같다.

- `dist/assets/firebase-*.js`가 별도 chunk로 생성된다.
- 초기 `index-*.js` chunk가 500KB 경고를 넘지 않는다.
- `/signup`, `/login`, 상단 회원 인증 컨트롤은 설정이 없을 때도 친절한 설정 오류로 degrade한다.

## 배포 메모

현재 Vercel 프로젝트 `desk-platform`은 `platform/.vercel/project.json`에 연결되어 있다.
루트 모노레포 검증은 `/Users/hjunkim/WebstormProjects/deskcloud`에서 수행하고, 운영 웹
배포는 기존 프로젝트 연결을 유지하기 위해 `platform` 경로에서 실행한다.

```bash
cd /Users/hjunkim/WebstormProjects/deskcloud/platform
pnpm dlx vercel deploy --prod --yes
```

중첩 `platform/pnpm-workspace.yaml`, `platform/pnpm-lock.yaml`, `platform/turbo.json`은
장기적으로 루트 설정으로 흡수할 후보지만, Vercel root directory 전환이 끝나기 전에는
운영 배포 입력으로 쓰일 수 있다. 삭제는 Vercel 프로젝트 root를 루트 모노레포로 전환하고
운영 배포가 통과한 뒤 진행한다.
