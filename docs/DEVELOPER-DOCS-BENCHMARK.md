# DeskCloud Developer Docs Benchmark

이 문서는 DeskCloud 개발자 문서를 계속 고도화할 때 쓰는 기준이다. 비교 대상은
공식 문서 구조가 안정적인 Stripe, Vercel, Supabase다.

## Benchmark Sources

| 제품     | 기준으로 삼을 점                                                                        | 출처                                                                        |
| -------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Stripe   | API reference와 quickstart를 분리하고, REST 리소스·HTTP code·auth 경계를 명확히 둔다.   | https://docs.stripe.com/api, https://docs.stripe.com/quickstarts.md         |
| Vercel   | Getting Started, Production Checklist, REST API, Monorepo, Environment 섹션을 분리한다. | https://vercel.com/docs                                                     |
| Supabase | Start, Products, Manage, Reference를 분리하고 framework quickstart/tutorial을 제공한다. | https://supabase.com/docs, https://supabase.com/docs/guides/getting-started |

## DeskCloud Documentation Shape

DeskCloud 문서는 아래 여섯 축을 모두 가져야 한다.

1. **Quickstart** — 5분 안에 가입회사 테넌트 생성, 키 발급, 첫 SDK 호출을 끝낸다.
2. **Tutorials** — 가입회사/서비스 도메인 등록, 첫 Desk SDK 붙이기, workspace Desk 운영 검증을
   별도 흐름으로 둔다.
3. **API Reference** — `method`, `path`, `auth`, `purpose`를 표 형태로 유지한다.
4. **Operations Runbook** — origin allowlist, key rotation, usage/billing, workspace manifest parity를
   운영 체크리스트로 둔다.
5. **Service Reference** — 각 Desk의 gateway path, primary metric, recommended plan, data model,
   domain isolation을 같은 데이터 소스에서 보여준다.
6. **Workspace Desk Boundary** — `seo-gateway`, `remote-devtools`, `aidigestdesk`는 별도 제품 URL이
   아니라 `workspace_integrated` manifest로 검증한다.

## Required API Reference Rows

웹 문서의 `/docs#api-reference` 표는 최소 아래 엔드포인트를 포함해야 한다.

| Method | Path                                  | Auth            | Purpose                      |
| ------ | ------------------------------------- | --------------- | ---------------------------- |
| GET    | `/api/billing/plans`                  | public          | 가격표와 플랜 한도           |
| POST   | `/api/tenants`                        | public          | 테넌트 생성과 키 발급        |
| GET    | `/api/tenant`                         | Bearer `sk_`    | 현재 테넌트 조회             |
| PUT    | `/api/tenant`                         | Bearer `sk_`    | 회사명과 origin allowlist    |
| POST   | `/api/tenant/rotate-keys`             | Bearer `sk_`    | secret key 회전              |
| GET    | `/api/usage`                          | Bearer `sk_`    | 월간 사용량                  |
| GET    | `/api/workspace-desks`                | public          | workspace Desk manifest      |
| GET    | `/api/workspace-desks/:id`            | public          | 단일 workspace Desk manifest |
| POST   | `/api/v1/apps/:appId/visits/ping`     | public          | 방문 이벤트 집계             |
| GET    | `/api/v1/apps/:appId/inquiries/admin` | `X-Admin-Token` | 문의 운영 보드               |

## Production Documentation Checklist

- `/docs#tutorials`가 가입회사 생성, 첫 SDK 호출, workspace Desk 검증 흐름을 제공한다.
- `/docs#api-reference`가 공개 API와 보호 API의 auth 경계를 구분한다.
- `/docs#production-checklist`가 Vercel 프록시, EC2 gateway, CORS allowlist, secret key 보관,
  workspace manifest parity를 검증 항목으로 가진다.
- `/dashboard#workspace-desks`가 `/api/workspace-desks` 운영 응답과 정적 catalog parity를 표시한다.
- `/desks/seo-gateway`, `/desks/remote-devtools`는 과거 독립 운영 URL이 아니라 DeskCloud
  `gatewayPath`, `adminPath`, `micrositePath`를 안내한다.

## Regression Gates

문서/콘솔을 수정하면 최소 아래를 돌린다.

```bash
pnpm --filter @desk/web test
pnpm --filter @desk/web typecheck
pnpm --filter @desk/web build
pnpm exec eslint apps/web/src/pages/DocsPage.tsx apps/web/src/pages/DashboardPage.tsx
curl -L https://desk-platform.vercel.app/api/workspace-desks
```

운영 배포 후에는 `desk-platform.vercel.app`의 새 번들에 `workspace_integrated`,
`/api/workspace-desks`, `SEOGatewayDesk`, `RemoteDevTools` 문자열이 포함되는지 확인한다.
