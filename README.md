# DeskCloud — unified monorepo

DeskCloud SaaS 패밀리를 하나의 pnpm 모노레포로 통합한 저장소. 구성요소는 원본 레포의
**git 히스토리를 보존**한 채 `git subtree` 로 합쳐졌습니다.

## 구조

| 경로            | 출처 (origin)                                             | 역할                                                                                                      |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `platform/`     | [desk-platform](https://github.com/blue45f/desk-platform) | `@desk/platform` 멀티테넌트 + 빌링 코어 (`packages/{shared,core,billing}` · `apps/{api,web}` · `vendor/`) |
| `desks/<name>/` | 각 Desk origin 레포                                       | **흡수된 16 Desk** (아래)                                                                                 |

흡수된 Desk(16): `seo-gateway`(Fastify 렌더) · `addesk` · `authdesk` · `changelogdesk` · `chatdesk` · `communitydesk` ·
`filedesk` · `mediadesk` · `moderationdesk` · `notifydesk` · `realtimedesk` · `reviewdesk` · `searchdesk` · `surveydesk` ·
`aidigestdesk`(api 없음·GH Pages) · `termsdesk`(가장 성숙·Vercel+EC2). 대부분 NestJS+Drizzle+PGlite / Vite+React 동질 스택.
provenance는 `MIGRATION.lock` + 각 origin 레포 `pre-monorepo` 태그.

### 통합 경계 — "부분-but-와이드"

동질적인 곳은 다 넣되 **비용 발산 아웃라이어는 sibling 레포로 분리**합니다
(근거: `docs/MONOREPO-CONSOLIDATION-PLAN.md`):

- **OUT** — `remote-devtools`(299MB 벤더 Chromium 포크 = 클론/CI/teleport 비용 킬러 → 격리됨) ·
  `deskcloud-sdk`(발행 `@heejun/deskcloud`) · `deskcloud-deploy`(배포 하네스·시크릿) ·
  `@heejun/web-config-preset`(DeskCloud보다 넓은 소비자). OUT 레포는 `@desk/*` 를 발행 caret 로 소비.

## 통합 목표 (방향)

1. **아키텍처 표준화** — `@desk/*` 코어/계약 정렬, Fastify(seo) 발산 화해
2. **단일 요금/빌링** — 각자 요금제 폐기, 공유 플랜 + Desk별 PlanLimit·미터 오버리지 (최대한 저렴하게)
3. **단일 어드민/Ops 콘솔** — 표준 어드민 폐기, 공용 오퍼레이터 셸 + Desk별 도메인 패널
4. **디자인 패밀리** — 공유 DNA(OKLCH 토큰·셸·내비·배지) + Desk별 액센트/캐릭터 (균질화 아님)

플랜: 아키텍처 와이어링 = `docs/INTEGRATION-PLAN.md` · 모노레포 구축/마이그레이션 = `docs/MONOREPO-CONSOLIDATION-PLAN.md`.

## 개발

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm lint && pnpm test   # Turborepo (test는 직렬)
```

**상태**: 물리 통합(16 Desk) + Stage 0 게이트(install/build/typecheck/lint/test) GREEN. 다음은 deploy cutover(라이브·게이트됨)와 아키텍처 와이어링(`docs/INTEGRATION-PLAN.md` P0~P5).

원본 레포는 그대로 유지·LIVE(미러-퍼스트, cutover까지 canonical). 이 모노레포는 추가본입니다(되돌리기 안전). push/원격 생성은 명시 요청 시에만.
