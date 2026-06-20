# spa-seo-gateway Development Guide

## 개요
이 프로젝트는 아키텍처 문서 정합성, 코드 변경 범위, CI 게이트를 함께 관리합니다.

## 필수 검증 흐름
- 아키텍처 문서 점검을 선행합니다.
- 타입/린트/테스트/빌드 검증을 완료합니다.
- PR 병합 전 증적을 남깁니다.

## 최소 실행 커맨드
- `pnpm run dev`
- `pnpm run build`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run verify`
- `pnpm run ci`

## 아키텍처 변경 규칙
1. 도메인 경계와 공유 타입 계약 변경은 `docs/ARCHITECTURE.md`에서 먼저 반영합니다.
2. 계약 변경이 API/스키마에 영향을 주면 문서와 테스트 계획을 함께 갱신합니다.
3. `pnpm run verify`는 `validate:architecture`가 선행된 상태여야 합니다.

## 보안 응답 헤더 (게이트웨이)
게이트웨이는 모든 응답에 기본 보안 헤더를 부여합니다 (`apps/gateway/src/security-headers.ts`, `buildApp()` 의 `onSend` 훅).
- 전역: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-DNS-Prefetch-Control: off`
- `/admin/*` 추가: `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Resource-Policy: same-origin`
- CSP 는 의도적으로 미설정(렌더 출력이 임의 origin SPA 를 미러링하므로). HSTS 는 CDN/프록시에서 종단.
- 회귀 테스트: `tests/gateway-security-headers.test.ts`. 헤더 추가/변경 시 함께 갱신.
- 배포 시크릿/티어 정본은 `docs/DEPLOYMENT.md` §0 참고.

## 접근성 — SPA 라우트 전환 (admin-frontend)
admin 콘솔은 클라이언트 라우팅(react-router) SPA 라서, 라우트 전환이 full page load 가 아닙니다. 보조 기술(스크린리더)·키보드 사용자에게 "페이지가 바뀌었다"는 신호를 명시적으로 줘야 합니다 (WCAG 2.4.3 Focus Order / 4.1.3 Status Messages).

- **라우트 안내(route announcer)**: `apps/admin-frontend/src/components/RouteAnnouncer.tsx` 가 Layout chrome 에 한 번 마운트됩니다. visually-hidden(`sr-only`) `role="status" aria-live="polite"` 영역으로, 라우트가 바뀔 때마다 `a11y.routeChanged`(`{page}` 치환) 안내를 SR 이 읽어 줍니다.
- **포커스 이동**: 전환 시 포커스를 `#main-content`(skip-link 타깃, `<main tabIndex={-1}>`)로 옮겨 키보드 탭 순서가 새 본문 최상단부터 재시작합니다. 단, **초기 마운트에서는 포커스를 강탈하지 않습니다**(사용자 의도 포커스 보존 + 초기 로드는 SR 이 문서 제목을 이미 읽음).
- **문서 제목**: 매 라우트마다 `document.title` 을 현재 nav 항목 라벨 + `app.title` 로 갱신(탭/북마크/SR 컨텍스트).
- 로직은 `src/lib/useRouteAnnouncer.ts` 훅에 집중되어 있고, i18n 키(`a11y.routeChanged`, `a11y.routeUnknown`, `app.title`)는 ko/en 양쪽에 존재해야 합니다. 회귀 테스트: `src/__tests__/components/RouteAnnouncer.test.tsx`.
- 새 페이지/라우트를 추가하면 `NAV_ITEMS`(`src/lib/nav.ts`)에 `labelKey` 와 함께 등록하면 안내·제목이 자동으로 따라옵니다 — RouteAnnouncer 는 별도 수정 불필요.

## PR 체크리스트
- 변경 범위 요약
- 영향 받는 도메인
- 실행한 검증 명령어 및 결과
- 회귀 확인 항목

