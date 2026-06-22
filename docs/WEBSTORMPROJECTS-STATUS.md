# WebstormProjects 통합 상태 리포트

최종 확인: 2026-06-22 KST

이 문서는 `/Users/hjunkim/WebstormProjects` 하위 프로젝트를 DeskCloud 통합본 관점에서
확인한 운영 상태를 요약한다. 실제 admin 토큰 값은 저장하지 않는다. 토큰 원문과 계정별
운영 검증 로그는 Git 제외 경로인 `.local/admin-accounts.md`에만 보관한다.

## 통합 기준

- 기준 저장소: `/Users/hjunkim/WebstormProjects/deskcloud`
- 운영 웹 URL: `https://desk-platform.vercel.app`
- 운영 API/런타임: Vercel 프론트가 EC2 `https://16.176.210.195.nip.io`의
  DeskPlatform API로 연결된다.
- 패키지 매니저/빌드 오케스트레이션: `pnpm@11.4.0` + Turborepo

## 통합된 Desk

DeskCloud 통합본은 다음 16개 Desk를 `desks/*` 워크스페이스로 포함한다.

| Desk           | workspace path          | 운영 확인 경로           |
| -------------- | ----------------------- | ------------------------ |
| TermsDesk      | `desks/termsdesk`       | `/desks/termsdesk`       |
| SurveyDesk     | `desks/surveydesk`      | `/desks/surveydesk`      |
| ChangelogDesk  | `desks/changelogdesk`   | `/desks/changelogdesk`   |
| ReviewDesk     | `desks/reviewdesk`      | `/desks/reviewdesk`      |
| MediaDesk      | `desks/mediadesk`       | `/desks/mediadesk`       |
| NotifyDesk     | `desks/notifydesk`      | `/desks/notifydesk`      |
| ModerationDesk | `desks/moderationdesk`  | `/desks/moderationdesk`  |
| RealtimeDesk   | `desks/realtimedesk`    | `/desks/realtimedesk`    |
| SearchDesk     | `desks/searchdesk`      | `/desks/searchdesk`      |
| CommunityDesk  | `desks/communitydesk`   | `/desks/communitydesk`   |
| ChatDesk       | `desks/chatdesk`        | `/desks/chatdesk`        |
| AdDesk         | `desks/addesk`          | `/desks/addesk`          |
| AuthDesk       | `desks/authdesk`        | `/desks/authdesk`        |
| FileDesk       | `desks/filedesk`        | `/desks/filedesk`        |
| SEOGatewayDesk | `desks/seo-gateway`     | `/desks/seo-gateway`     |
| RemoteDevTools | `desks/remote-devtools` | `/desks/remote-devtools` |

`termsdesk`와 `surveydesk`의 예전 최상위 원본 폴더는 정리되어 있고, 통합본은
DeskCloud 내부 workspace로 남아 있다. `spa-seo-gateway`, `remote-devtools`는 워크스페이스와
연결되어 있으며, `aidigestdesk`는 운영 상 일반 서비스 성격으로 workspace 제외 대상이다.

## WebstormProjects 최상위 폴더 분류

| 폴더                   | 상태                          | 비고                                       |
| ---------------------- | ----------------------------- | ------------------------------------------ |
| `deskcloud`            | 통합 운영 루트                | `pnpm` + Turborepo 기준 저장소             |
| `spa-seo-gateway`      | 통합됨, sibling 원본 보관     | 통합 경로 `desks/seo-gateway`              |
| `remote-devtools`      | 통합됨, sibling 원본 보관     | 통합 경로 `desks/remote-devtools`          |
| `aidigestdesk`         | 분리 운영, sibling 원본 보관  | 모노레포 workspace 제외                    |
| `termsdesk`            | 최상위 원본 정리됨            | 통합 경로 `desks/termsdesk`                |
| `surveydesk`           | 최상위 원본 정리됨            | 통합 경로 `desks/surveydesk`               |
| `_archive`             | 보관 영역                     | 활성 통합 소스 아님                        |
| `PromptMarket`         | 별도 제품 저장소              | DeskCloud 기능으로 자동 흡수하지 않음      |
| `family-care-platform` | 별도 제품 저장소              | DeskCloud 기능으로 자동 흡수하지 않음      |
| `heejun`               | 별도 포트폴리오/사이트 저장소 | 일부 UI/문서 패턴 참고 가능                |
| `web-config-preset`    | 설정 프리셋 저장소            | 향후 공유 ESLint/Prettier 정리 후보        |
| `orbit-ui`             | 디자인 시스템 후보 저장소     | 필요 시 UI 토큰/컴포넌트 참고              |
| 기타 제품 저장소       | 별도 제품 경계 유지           | 현재 DeskCloud workspace에 직접 포함 안 함 |

## 운영 검증 결과

2026-06-22 KST 기준으로 다음 검증을 완료했다.

| 구분                  | 명령/대상                                                                | 결과                                                |
| --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| 전체 모노레포 검증    | `pnpm run verify`                                                        | 통과, 119 tasks successful                          |
| 운영 통합 검증        | `pnpm run verify:production:full`                                        | 통과(route 52/52, dashboard 3/3, termsdesk 2/2)     |
| 개발자 Desk 집중 검증 | `pnpm run verify:developer-desks`                                        | 통과                                                |
| 보안 감사             | `pnpm --dir platform run audit:security`                                 | 통과                                                |
| Compose 설정          | `pnpm compose:config`                                                    | 통과                                                |
| 로컬 통합 배포        | `pnpm deploy`                                                            | 통과(14개 API + Caddy 순차 기동, 전체 `/health` OK) |
| 공백/패치 검증        | `git diff --check`                                                       | 통과                                                |
| 운영 헬스체크         | `https://16.176.210.195.nip.io/platform/health`                          | 200                                                 |
| 운영 manifest         | `https://desk-platform.vercel.app/api/workspace-desks`                   | 200                                                 |
| 운영 manifest parity  | `pnpm run verify:prod-platform`                                          | 통과                                                |
| 대표 마이크로사이트   | `/desks/seo-gateway`, `/desks/remote-devtools`                           | 200 및 렌더링 통과                                  |
| 공개 링크 이동        | `/catalog`에서 대표 2개 Desk 마이크로사이트 클릭                         | 통과                                                |
| 모바일 렌더링         | 홈, 카탈로그, 대표 2개 Desk 마이크로사이트                               | 통과                                                |
| Admin 계정 smoke      | owner/operator/support/auditor 권한, invalid token, originHost 필터 검증 | 통과                                                |

Browser plugin은 현재 세션에 제공되지 않아 Playwright + 로컬 Chrome으로 브라우저
검증을 수행했다. 검증 스크린샷은 Git 제외 경로 `.local/verification/`에 저장했다.

## Admin 계정 상태

운영 admin 계정은 다음 역할과 스코프로 발급되어 EC2 운영환경에 반영되어 있다.

| 계정 ID    | 역할     | 스코프                                                |
| ---------- | -------- | ----------------------------------------------------- |
| `owner`    | owner    | `admin:*`                                             |
| `operator` | operator | `inquiries:read`, `inquiries:write`, `workspace:read` |
| `support`  | support  | `inquiries:read`, `inquiries:write`                   |
| `auditor`  | auditor  | `inquiries:read`, `workspace:read`                    |

토큰 원문은 `.local/admin-accounts.md`와 `deploy/stack/.env`에만 있다. 두 파일은 Git에
포함하지 않는다.

## 운영 접근 규칙

- 공개 사용자는 `/`, `/catalog`, `/desks/:id`에서 Desk 카탈로그와 마이크로사이트를
  확인한다.
- `/dashboard#workspace-desks`는 현재 공개 접근 시 `/login`으로 리다이렉트된다.
  운영 콘솔은 로그인/권한이 필요한 표면으로 유지한다.
- 문의 admin API는 `X-Admin-Token`과 계정별 scope로 보호된다.
- 문의 데이터는 `appId`와 `originHost` 필터로 서비스 도메인 단위 격리를 지원한다.

## 남은 인프라 리스크

현재 운영 EC2의 `/opt/deskcloud`는 Git 저장소 체크아웃이 아니라 복사된 build context를
사용한다. 이번 배포에서는 `/opt/deskcloud/repos/desk-platform`의 shared workspace manifest를
현재 통합본과 맞추고 `deskplatform` 컨테이너만 재빌드했다. 운영 manifest parity는
`pnpm run verify:prod-platform`으로 검증한다. 이 명령은 source-of-truth의
`WORKSPACE_DESK_IDS`와 운영 `/api/workspace-desks`를 비교하고, AIDigestDesk가 workspace
Desk가 아니라 linked 독립 운영 항목으로 404를 반환하는지도 확인한다.

`deploy/stack`은 2026-06-22 KST에 로컬 Docker host 기준 `pnpm deploy`로 전체 빌드/기동/헬스체크를
통과했다. 운영 EC2가 여전히 복사된 build context를 쓰는 경우에는 이 저장소의 `deploy/stack`
체크아웃 기준으로 수렴시키는 작업이 남는다. 이 작업은 다른 서비스 컨테이너까지 영향이 있으므로
별도 배포 윈도우에서 진행해야 한다.
