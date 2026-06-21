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
| Console entry   | `/dashboard?desk=seo-gateway`, `/dashboard?desk=remote-devtools` |
| Microsite       | `/desks/seo-gateway`, `/desks/remote-devtools`                   |

렌더링 핫패스와 WebSocket/CDP 세션 처리는 각각의 데이터플레인을 보존한다. 이것은 별도
운영을 뜻하지 않는다. 성능과 상태 관리가 중요한 런타임만 유지하고, 고객이 보는 운영 경계는
DeskCloud control-plane으로 통합한다.

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
- `pnpm --filter @desk/web test`가 Workspace Desk 계약을 검증한다.
- `pnpm run verify:developer-desks`가 두 데이터플레인을 루트에서 검증한다.
