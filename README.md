<div align="center">

# TermsDesk

**약관·정책 문서의 버전 관리와 변조 방지 게시 — SaaS 또는 사내 설치(self-hosted).**

회사가 가진 약관/정책을 등록하고 · 버전으로 관리하고 · 변조 없이 게시하고 ·
누가 어떤 버전에 언제 동의했는지 증명합니다.

</div>

---

## 무엇인가 / 무엇이 아닌가

TermsDesk는 회사가 **이미 보유한** 약관 문안을 **버전 관리·게시·감사**하는 시스템입니다.

- ✅ 약관/정책 문서의 **불변 버전 관리** + 버전 간 diff
- ✅ 게시 시 본문 **동결 + SHA-256 해시** (변조 방지)
- ✅ **append-only 동의 영수증**: 누가 / 어떤 버전(해시)에 / 언제 / 어떻게
- ✅ 변경 이력 **감사 로그**, RBAC, API 키, CSV 내보내기
- ✅ 게시본을 외부 앱에 전달하는 **임베드 SDK**(React `<ConsentGate>`)
- ✅ **SaaS**(멀티테넌트)와 **사내 설치**(self-hosted, 싱글테넌트) 동일 코드베이스

- ❌ 약관을 **대신 작성하지 않습니다**.
- ❌ 법률 자문/컴플라이언스 보증을 제공하지 않습니다. "기록·버전·증거 인프라"입니다.

## 빠른 시작 (제로 설정)

```bash
corepack enable
pnpm install
pnpm dev          # web :5270 · api :4070  (DATABASE_URL 없으면 PGlite 임베드 DB로 즉시 실행)
```

- 웹: http://localhost:5270 · API/Swagger: http://localhost:4070/api/docs
- 데모 로그인(self-hosted 첫 부팅 시 시드): `admin@termsdesk.local` / `termsdesk-admin`
- `pnpm dev`는 Postgres·Docker 없이 동작합니다(PGlite). 운영은 `DATABASE_URL`로 PostgreSQL 사용.

## 사내 설치 (self-hosted)

```bash
docker compose up --build      # postgres + api + web(nginx)
# → http://localhost:8080
```

데이터(약관·동의 기록)가 자체 인프라를 벗어나지 않습니다. 자세한 내용은
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 사이트에 붙이기 (연동)

게시한 약관은 **무인증 공개 엔드포인트**로 어느 사이트에서든 바로 씁니다 — 호스티드 페이지
(`/p/:orgSlug/:slug`)에 링크 한 줄이면 충분하고, 팝업이 필요하면 드롭인 위젯을 더합니다.

```html
<!-- ① 호스티드 약관 페이지 링크 (가장 간단) -->
<a href="https://terms.your-company.com/p/acme/terms-of-service">이용약관</a>

<!-- ② 또는 드롭인 팝업 위젯: 스크립트 한 번 + 트리거 -->
<script src="https://terms.your-company.com/api/public/embed.js" data-org="acme" defer></script>
<a href="#" data-termsdesk-policy="terms-of-service">이용약관</a>
```

iframe·인라인 fetch·스타일링·CORS/캐시, 그리고 동의를 증거로 남기는 React `<ConsentGate>`
연동까지는 [docs/INTEGRATION.md](docs/INTEGRATION.md) 참고. 대시보드 **연동 가이드**(`/app/guide`)
에서는 내 정책 slug·도메인이 채워진 코드를 바로 복사할 수 있습니다.

## SaaS 배포

Render Blueprint([render.yaml](render.yaml)): API(Docker) + Web(정적) + 관리형 Postgres.
`TERMSDESK_MODE=saas` 로 멀티테넌트 동작.

## 구조 (pnpm 모노레포)

```
apps/
  web/        Vite 8 + React 19 + TS 6 + Tailwind v4  — 대시보드
  api/        NestJS 11 + Drizzle (pg / PGlite)        — 레지스트리·게시·영수증·감사
packages/
  shared/     Zod 계약 · 도메인 상수 · content-hash    — api·web·sdk 공유
  sdk/        의존성 0 임베드 클라이언트 + React ConsentGate (tsup)
docs/         ARCHITECTURE · DEVELOPMENT · DEPLOYMENT · INTEGRATION · PRODUCT · DESIGN
```

## 핵심 불변식

**게시된 버전의 본문은 절대 바뀌지 않습니다.** 게시 시점에 렌더된 본문을 동결하고
SHA-256 해시를 박습니다. 동의 영수증은 이 해시를 가리키므로, "그 사용자가 정확히 어떤
문안에 동의했는지"를 사후에 증명·재현할 수 있습니다.

## 스크립트

| 스크립트       | 설명                                                       |
| -------------- | ---------------------------------------------------------- |
| `pnpm dev`     | web + api 동시 실행                                        |
| `pnpm build`   | 전 워크스페이스 빌드                                       |
| `pnpm verify`  | format:check → lint → typecheck → test → build (CI 게이트) |
| `pnpm db:seed` | 데모 데이터 시드                                           |

## 기술 스택

pnpm 11 · TypeScript 6 · React 19 · Vite 8 · Tailwind v4 · Radix · TanStack Query ·
NestJS 11 · Drizzle ORM · PostgreSQL / PGlite · Zod · tsup
