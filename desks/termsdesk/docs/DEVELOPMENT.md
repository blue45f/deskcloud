# DEVELOPMENT — TermsDesk

포트폴리오 공통 컨벤션은 `~/WebstormProjects/DEVELOPMENT.md`·`CONTRIBUTING.md`를 따릅니다.

## 환경

- Node **>=22.12.0**, pnpm **11.4.0**(`packageManager` 필드 = 단일 소스).
- `corepack enable && pnpm install`.
- 첫 설치 시 `ERR_PNPM_IGNORED_BUILDS`가 나면 `pnpm-workspace.yaml`의 `allowBuilds`에 추가.

## 실행

```bash
pnpm dev        # web :5270 + api :4070 (PGlite 임베드 → 제로 설정)
pnpm db:seed    # 데모 데이터 시드(멱등)
```

`DATABASE_URL`이 없으면 API는 PGlite 임베드 DB(`apps/api/.data/pglite`)로 동작하고,
self-hosted 모드 첫 부팅 시 데모 데이터(정책·버전·동의·API키·멤버·감사)를 시드합니다.

> 포트는 포트폴리오 내 다른 프로젝트와 겹치지 않도록 web **5270** / api **4070** 사용.

## 스크립트

| 스크립트                  | 의미                                                         |
| ------------------------- | ------------------------------------------------------------ |
| `dev`                     | `build:libs` 후 web+api 동시(watch)                          |
| `build`                   | 전 워크스페이스 빌드(토폴로지 순서)                          |
| `lint`                    | `eslint .`(루트 flat config)                                 |
| `typecheck`               | libs 빌드 후 워크스페이스별 `tsc`                            |
| `test`                    | 워크스페이스별 vitest(`--passWithNoTests`)                   |
| `format` / `format:check` | prettier                                                     |
| **`verify`**              | `format:check → lint → typecheck → test → build` (CI 게이트) |
| `db:seed`                 | 데모 시드                                                    |

## 구조

```
apps/web/src/
  app/        AppProviders · RootLayout · RequireAuth · Theme/Confirm Provider · queryClient
  router/     createBrowserRouter
  pages/      Landing · Login · Dashboard · Policies · PolicyDetail · VersionDetail/Editor
              · Consents · SubjectHistory · Audit · ApiKeys · Demo · Settings · NotFound
  components/ ui(Radix+cva 프리미티브) · layout(Sidebar/Topbar) · feature(Timeline/DiffView) · common(a11y)
  services/   api(ky) · auth · policies · consents · admin  (TanStack Query 훅)
  hooks/ utils/ styles/
apps/api/src/
  config · db(schema·migrations·database.service·seed) · common · core
  auth · policies · consents · public · audit · apikeys · members · export · health
packages/shared/src/   constants · hash · schemas(zod) · dto
packages/sdk/src/      index(vanilla) · react(ConsentGate)
```

## 컨벤션

- **Conventional Commits**(commitlint). 헤더 ≤100, 본문 라인 ≤100. 스코프:
  `api|web|sdk|shared|deploy|docs|ci|configs|deps|security|workspace`.
- husky: pre-commit(lint-staged: eslint --fix + prettier) · commit-msg(commitlint) ·
  pre-push(verify).
- 네이티브 다이얼로그 금지(`no-restricted-globals`) → `useConfirm()`/toast.
- 게시본 불변식·append-only를 깨는 변경 금지(증거 무효화).

## React Compiler (후속)

포트폴리오 표준(babel-plugin-react-compiler)은 Vite 8 + plugin-react 6 에서
`@rolldown/plugin-babel` + `reactCompilerPreset()`로 연결합니다(현재 미연결, 의존성은 유지).

## 테스트

vitest(+ jsdom, @testing-library/react). SSR/포커스 등 jsdom 한계 영역은 e2e(Playwright)로.
