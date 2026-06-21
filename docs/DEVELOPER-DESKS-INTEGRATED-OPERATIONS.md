# Developer Desks Integrated Operations

`SEOGatewayDesk`와 `RemoteDevTools`는 분리 운영하지 않는다. 두 서비스는
`deskcloud` 모노레포의 정식 Workspace Desk로 유지하고, 운영자는 DeskCloud 콘솔에서
가입회사, 서비스 도메인, 키, 사용량, 플랜, 빌링 상태를 함께 관리한다.

## 운영 결정

| 항목            | 결정                                                             |
| --------------- | ---------------------------------------------------------------- |
| Source of truth | `/Users/hjunkim/WebstormProjects/deskcloud`                      |
| Workspace path  | `desks/seo-gateway`, `desks/remote-devtools`                     |
| Public product  | `SEOGatewayDesk`, `RemoteDevTools`                               |
| Control-plane   | DeskCloud tenant, service origin allowlist, usage, plan, billing |
| Data-plane      | SEO Fastify renderer, RemoteDevTools NestJS/TypeORM CDP gateway  |
| API manifest    | `/api/workspace-desks`, `/api/workspace-desks/:id`               |
| Console entry   | `/dashboard?desk=seo-gateway`, `/dashboard?desk=remote-devtools` |
| Microsite       | `/desks/seo-gateway`, `/desks/remote-devtools`                   |

렌더링 핫패스와 WebSocket/CDP 세션 처리는 각각의 데이터플레인을 보존한다. 이것은 별도
운영을 뜻하지 않는다. 성능과 상태 관리가 중요한 런타임만 유지하고, 고객이 보는 운영 경계는
DeskCloud control-plane으로 통합한다.

## 통합 운영 원칙

`SEOGatewayDesk`와 `RemoteDevTools`는 제품, 콘솔, 과금, 사용량 관점에서 DeskCloud의
일급 Desk이다. 다만 런타임 특성이 달라 데이터플레인을 억지로 `platform/apps/api` 안으로
이식하지 않는다.

| 구분          | DeskCloud control-plane                                 | 각 Desk data-plane                              |
| ------------- | ------------------------------------------------------- | ----------------------------------------------- |
| 계정/권한     | 가입회사 테넌트, pk/sk 키, origin allowlist             | 렌더 admin token, SDK/WS 세션 credential        |
| 서비스 도메인 | 콘솔의 service origin 등록과 운영 감사                  | Site origin, route rule, org/origin namespace   |
| 사용량/요금   | 테넌트 월간 사용량, 플랜 한도, billing 상태             | render job, cache hit/miss, debug session event |
| 배포 검증     | `pnpm run verify:developer-desks`, 카탈로그 계약 테스트 | Fastify renderer, NestJS gateway, rrweb replay  |
| 운영 진입점   | `/dashboard?desk=...`, `/desks/...`                     | 내부 패널과 runtime-specific admin API          |

이 경계 때문에 통합 운영이 가능하다. 운영자는 DeskCloud에서 고객, 도메인, 키, 사용량을
통제하고, 각 런타임은 성능·세션 상태·전용 어댑터만 책임진다.

## 운영 준비도 체크

운영 콘솔의 `Desk 운영 허브`는 카탈로그의 `deskReadiness()` 계약을 사용해 아래 기준을
표시한다.

| Desk           | 반드시 확인할 항목                                                                               | 상태 의미                                       |
| -------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| SEOGatewayDesk | 원본 SPA origin, 통합 `/seo-gateway` route, cache/SWR, admin token                               | 검색 봇 트래픽을 통합 gateway로 보낼 준비       |
| RemoteDevTools | SDK origin allowlist, 통합 `/remote-devtools` WS gateway, org/origin namespace, 외부 연동 secret | 디버깅 세션과 리플레이를 테넌트별로 격리할 준비 |

`설정 필요` 항목은 고객 서비스 도메인이나 secret이 실제 운영 환경마다 달라서 남겨 둔
체크포인트다. `통합됨`은 DeskCloud 라우팅/카탈로그/워크스페이스 계약이 이미 적용된
상태이고, `관찰`은 배포 후 사용량·캐시·세션 상태를 운영자가 계속 봐야 하는 항목이다.

## 루트 명령

분리된 sibling repo로 이동하지 말고 루트에서 실행한다.

```bash
pnpm run build:developer-desks
pnpm run typecheck:developer-desks
pnpm run test:developer-desks
pnpm run verify:developer-desks
```

로컬 개발 서버도 루트에서 실행한다.

```bash
pnpm run dev:seo-gateway
pnpm run dev:remote-devtools:internal
pnpm run dev:remote-devtools:external
```

## 운영 라우팅

운영 웹 포털은 `https://desk-platform.vercel.app`의 마이크로사이트와 콘솔을 사용한다.
실제 API, 렌더, SDK, WebSocket 라우트는 통합 배포 게이트웨이에서 아래 경로로 묶는다.

| Desk           | Gateway path       | 대표 확인 항목                         |
| -------------- | ------------------ | -------------------------------------- |
| SEOGatewayDesk | `/seo-gateway`     | render route, cache, metrics, admin UI |
| RemoteDevTools | `/remote-devtools` | SDK bundle, internal API, WS gateway   |

카탈로그 계약상 두 Desk는 `liveUrl`을 노출하지 않는다. 공개 페이지의 스니펫도 standalone
`remote-devtools.vercel.app` 같은 과거 URL이 아니라 `VITE_API_BASE_URL` 기반 DeskCloud
통합 엔드포인트를 사용한다.

플랫폼 API는 workspace Desk manifest를 공개한다. 콘솔과 API가 서로 다른 gateway path나
source-of-truth를 말하지 않도록 `@desk/shared`의 `WORKSPACE_DESK_MANIFEST`를 단일 계약으로
사용한다.

```bash
curl "$VITE_API_BASE_URL/api/workspace-desks"
curl "$VITE_API_BASE_URL/api/workspace-desks/remote-devtools"
curl "$VITE_API_BASE_URL/api/workspace-desks/seo-gateway"
```

## 원본 저장소 처리

`/Users/hjunkim/WebstormProjects/spa-seo-gateway`와
`/Users/hjunkim/WebstormProjects/remote-devtools`는 더 이상 일상 개발 source of truth가
아니다. 운영 전환 확인 뒤에는 읽기 전용 보관 또는 archive 대상으로 취급한다.

원본 저장소를 즉시 삭제하지 않는 이유는 provenance, rollback, 과거 배포 설정 확인 때문이다.
새 기능, 버그 수정, 문서 변경, 검증 명령은 `deskcloud`에서만 수행한다.

## 통합 완료 기준

- `pnpm-workspace.yaml`에 두 Desk와 하위 패키지가 포함되어 있다.
- `platform/apps/web/src/data/deskCatalog.ts`에서 두 Desk의 `integrationMode`가
  `workspace`이다.
- `/dashboard?desk=seo-gateway`, `/dashboard?desk=remote-devtools`가 DeskCloud 콘솔
  표면으로 연결된다.
- `/desks/seo-gateway`, `/desks/remote-devtools`가 standalone URL 대신 통합 엔드포인트를
  설명한다.
- `/api/workspace-desks/seo-gateway`, `/api/workspace-desks/remote-devtools`가
  `workspace_integrated` 상태와 `liveUrl: null`을 반환한다.
- `pnpm --filter @desk/web test`가 Workspace Desk 계약을 검증한다.
- `pnpm --filter @desk/api test`가 API manifest 계약을 검증한다.
- `pnpm run verify:developer-desks`가 두 데이터플레인을 루트에서 검증한다.
