# DeskCloud — unified monorepo

DeskCloud SaaS 패밀리를 하나의 pnpm 모노레포로 통합한 저장소. 구성요소는 원본 레포의
**git 히스토리를 보존**한 채 `git subtree` 로 합쳐졌습니다.

## 구조

| 경로 | 출처 (origin) | 역할 |
| --- | --- | --- |
| `platform/` | [desk-platform](https://github.com/blue45f/desk-platform) | `@desk/platform` 멀티테넌트 + 빌링 코어 (`packages/{shared,core,billing}` · `apps/{api,web}` · `vendor/`) |
| `desks/seo-gateway/` | [spa-seo-gateway](https://github.com/blue45f/spa-seo-gateway) | 다이내믹 렌더링 SEO 게이트웨이 (이미 saas 멀티테넌트 모드) |
| `desks/<name>/` *(예정)* | 동질 백엔드 14 Desk + aidigestdesk | 흡수 배치 — `docs/MONOREPO-CONSOLIDATION-PLAN.md` §5 |

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
pnpm -r build && pnpm -r typecheck && pnpm -r test
```

원본 레포는 그대로 유지되며, 이 모노레포는 추가본입니다(되돌리기 안전). push/원격 생성은 명시 요청 시에만.
