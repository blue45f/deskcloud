# DeskCloud — unified monorepo

DeskCloud SaaS 패밀리를 하나의 pnpm 모노레포로 통합한 저장소. 구성요소는 원본 레포의
**git 히스토리를 보존**한 채 `git subtree` 로 합쳐졌습니다.

## 구조

| 경로                      | 출처 (origin)                                                   | 역할                                                                                                      |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `platform/`               | [desk-platform](https://github.com/blue45f/desk-platform)       | `@desk/platform` 멀티테넌트 + 빌링 코어 (`packages/{shared,core,billing}` · `apps/{api,web}` · `vendor/`) |
| `desks/<name>/`           | 각 Desk origin 레포                                             | **통합된 16 Desk** (아래)                                                                                 |
| `packages/deskcloud-sdk/` | [deskcloud-sdk](https://github.com/blue45f/deskcloud-sdk)       | 공개 npm SDK `@heejun/deskcloud` (`pk_` browser client + `sk_` server/admin client)                       |
| `deploy/stack/`           | [deskcloud-deploy](https://github.com/blue45f/deskcloud-deploy) | 14개 API + Caddy 통합 배포 하네스(docker compose, Caddyfile, deploy/gen-env scripts)                      |

흡수된 Desk(16): `seo-gateway`(`SEOGatewayDesk`, Fastify 렌더) · `remote-devtools`(`RemoteDevTools`, CDP/세션 리플레이) · `addesk` · `authdesk` · `changelogdesk` · `chatdesk` · `communitydesk` ·
`filedesk` · `mediadesk` · `moderationdesk` · `notifydesk` · `realtimedesk` · `reviewdesk` · `searchdesk` · `surveydesk` · `termsdesk`(가장 성숙·Vercel+EC2). 대부분 NestJS+Drizzle+PGlite / Vite+React 동질 스택.
provenance는 `MIGRATION.lock` + 각 origin 레포 `pre-monorepo` 태그.

### 통합 경계

동질적인 제품·배포·SDK 표면은 이 모노레포 안으로 통합합니다. 공개 SDK는 `packages/deskcloud-sdk`
안에서 계속 `@heejun/deskcloud`로 publish 가능한 독립 패키지 경계를 유지하고, 배포 하네스는
`deploy/stack` 안에서 `.env`를 Git 추적 밖에 둔 채 운영합니다.

- **IN** — `seo-gateway`와 `remote-devtools`는 개발자 도구형 Desk로 deskcloud workspace 안에서
  통합 운영합니다. `remote-devtools/devtools-frontend`는 299MB 벤더 프론트엔드라 큰 자산으로
  명시 보관하지만, 소스/콘솔/문서/요금 메타데이터는 모노레포에서 함께 검증합니다.
- **OUT** — `@heejun/web-config-preset`(DeskCloud보다 넓은 소비자), `aidigestdesk`(일반 서비스 성격). OUT 레포/서비스는 `@desk/*` 또는 `@heejun/deskcloud` 를 발행 caret로 소비합니다.

  `aidigestdesk`는 SaaS 운영 경로가 아니라 독립 서비스 성격으로, 모노레포 내부 런타임 통합은 제외했습니다.

## 통합 목표 (방향)

1. **아키텍처 표준화** — `@desk/*` 코어/계약 정렬, Fastify(seo) 발산 화해
2. **단일 요금/빌링** — 각자 요금제 폐기, 공유 플랜 + Desk별 PlanLimit·미터 오버리지 (최대한 저렴하게)
3. **단일 어드민/Ops 콘솔** — 표준 어드민 폐기, 공용 오퍼레이터 셸 + Desk별 도메인 패널
4. **디자인 패밀리** — 공유 DNA(OKLCH 토큰·셸·내비·배지) + Desk별 액센트/캐릭터 (균질화 아님)

플랜: 아키텍처 와이어링 = `docs/INTEGRATION-PLAN.md` · 모노레포 구축/마이그레이션 =
`docs/MONOREPO-CONSOLIDATION-PLAN.md` · 운영 콘솔 기준 =
`docs/ADMIN-CONSOLE-OPERATIONS.md` · 개발자 도구형 Desk 통합 운영 =
`docs/DEVELOPER-DESKS-INTEGRATED-OPERATIONS.md` · 개발자 문서/튜토리얼 기준 =
`docs/DEVELOPER-DOCS-BENCHMARK.md` · 플랫폼 DB 구조 =
`platform/docs/DATA_MODEL.md`.

## 개발

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm lint && pnpm test   # Turborepo (test는 직렬)
pnpm build:sdk                                           # @heejun/deskcloud SDK
pnpm run verify:developer-desks                          # SEOGatewayDesk + RemoteDevTools
pnpm run verify:production                               # 통합 운영점검( manifest/parity + 라우트 + Dashboard )
pnpm run verify:production:full                          # TermsDesk 런타임 포함 통합 운영점검
pnpm compose:config                                      # deploy/stack compose 검증
pnpm deploy:no-build                                     # deploy/stack 기존 이미지 재기동+헬스체크
```

**상태**: 물리 통합(16 Desk + platform + SDK + deploy stack) 완료. `deploy/stack/.env`는 Git 추적
밖에 두고, 기존 sibling 저장소는 검증 후 archive 보관 경로로 이동합니다.
