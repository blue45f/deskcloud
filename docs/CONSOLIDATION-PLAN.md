# DeskCloud 통합 실행 플랜 (Consolidation — Execution Edition)

> 이 문서는 `docs/MONOREPO-CONSOLIDATION-PLAN.md`(흡수/마이그레이션 메커니즘)와
> `docs/INTEGRATION-PLAN.md`(아키텍처 와이어링)를 잇는 **실행 에디션**이다.
> 물리 통합은 끝났다는 전제에서, "지금 무엇을 어떤 순서로 출하하나"에만 집중한다.

## 0. 진단: 물리 통합은 끝났고, 진짜 문제는 "이중 소스 + 드리프트"

`git subtree` 흡수로 트리는 이미 합쳐졌다. 남은 위험은 **모노레포 사본과 스탠드얼론 origin
레포가 동시에 살아 있어 생기는 드리프트**다. Desk별 현황:

- **desk-platform** — 스탠드얼론 없음. `deskcloud/platform` 이 단독 캐노니컬(정합 완료).
  추가 동기화 부담 없음.
- **remote-devtools** — **이미 정합(2026-06-24 적대적 검증)**. raw 차이 ~3717개 중 ~98%가
  vendored `devtools-frontend` Chrome 포크(standalone 4753 vs deskcloud 4692). 노이즈 제거 후
  실소스 56개는 **전부 prettier 포맷 · 통합 shim(base-path/@desk 리네임) · dependabot 버전드리프트**.
  실기능(a11y·DeskCloud 위젯·seed·ReplayComments 마이그·policies→termsdesk)은 deskcloud에 이미
  존재하고, `SessionPreviewCard.test`는 deskcloud가 오히려 AHEAD. **동기화 백로그 없음**
  (raw 오버레이하면 통합 shim 퇴행). 스탠드얼론 신규 커밋은 사실상 dependabot뿐.
- **termsdesk** — **이미 정합(2026-06-24 적대적 검증)**. 27파일 차이는 전부 통합 어댑테이션
  (base-path · `apps/web/src/config/urls.ts` shim · scoped manifest/SW)이고, 스탠드얼론의 실제 변경
  (`05409fc` seed-admin fix)은 deskcloud에 byte-identical. verify GREEN(api 103/103·web 47/47).
  **동기화 불필요**(`apps/web/src/config/` 보존 대상).
- **aidigestdesk** — 별도 플랫폼(GH Pages / Toss in-app, SaaS 빌링 없음).
  **이번 커밋에서 트리에서 제거**했고, 캐노니컬은 스탠드얼론 `blue45f/aidigestdesk` 단독 운영.

## 1. 전략 결정: 캐노니컬 = 모노레포, 배포는 앱별 분리 유지

- **소스는 deskcloud 하나로 수렴**한다 → 드리프트 원천을 제거. 스탠드얼론 레포는
  cutover까지 미러로 두되, 신규 작업은 모노레포에서 한다.
- **배포는 앱별 타깃을 유지**한다. 각 앱은 자기 Vercel/Render/EC2 타깃을 그대로 쓰고,
  Turbo `--filter` 로 **변경분만 빌드**한다(모노레포라고 전부 한 번에 배포하지 않는다).
- `deploy/stack`(Caddy + docker compose)은 **셀프호스트 대안**으로 보존한다.

## 2. 단계별 실행 (각 단계 독립 출하·롤백 가능)

### Phase 0 — 드리프트 점검 (완료: 동기화 백로그 없음)

- ✅ `aidigestdesk` 제거(별도 플랫폼, 스탠드얼론 단독).
- ✅ 실행 플랜 문서화(이 문서).
- ✅ **termsdesk 드리프트 검증** — 차이 27파일 전부 통합 shim, 실내용 이미 정합 → 동기화 불필요(verify GREEN).
- ✅ **remote-devtools 드리프트 검증** — raw 3717개 중 98% vendored 포크, 실소스 56개 전부
  포맷/shim/dependabot → 동기화 불필요(deskcloud가 일부 AHEAD).
- **교훈**: 큰 raw diff는 "standalone-ahead"가 아니라 **vendored 벌크 + 통합 shim + dependabot 노이즈**다.
  동기화 전 반드시 diff 분류(내용 vs shim)할 것 — raw 오버레이는 통합을 퇴행시킨다.
- **재구성**: 따라서 Phase 0의 진짜 과제는 "코드 머지"가 아니라 **거버넌스**다. 스탠드얼론 레포에
  신규 작업(주로 dependabot)이 계속 쌓이면 deskcloud가 시간이 지나며 뒤처진다. 결정: 신규 개발을
  deskcloud로 단일화(스탠드얼론은 동결/자동머지만) → Phase 1 배포 재배선 → archive.

### Phase 1 — 배포 재배선

- 각 Vercel/Render 프로젝트를 **deskcloud 루트 + Root Directory**(앱별 경로)로 재설정.
- 앱당 1개씩 **프리뷰 검증 후 prod 스왑**. 한 번에 전부 바꾸지 않는다(롤백 폭 최소화).

### Phase 2 — control-plane 중복 제거

- 공통 제어면을 `@desk/core`(auth · tenancy · API 키 `pk_`/`sk_`) 와
  `@desk/billing`(plans · usage metering) 으로 모은다. **billing 은 현재 STUB → 실구현**.
- **데이터플레인은 네이티브 유지**: termsdesk content-hash, remote-devtools CDP/rrweb
  TypeORM, seo-gateway Fastify 렌더는 그대로 둔다(억지로 공유화하지 않는다).

### Phase 3 — 단일 어드민 + 디자인 패밀리

- 단일 어드민 셸 + SSO.
- 공유 OKLCH 토큰 기반 디자인 패밀리. **Tailwind 강제 이식 금지**(자체 토큰 시스템 보존).

### Phase 4 — 셀프호스트 + 정리

- `deploy/stack` 셀프호스트 prod 경로 문서화.
- 미사용 스캐폴드 Desk는 `desks/_incubator/` 로 강등.

## 3. 사용자 결정/게이트 (되돌리기 어려움 — 명시 승인 후 실행)

| 게이트                      | 내용                                                     | 트리거                 |
| --------------------------- | -------------------------------------------------------- | ---------------------- |
| 스탠드얼론 레포 archive     | desk-platform/remote-devtools/termsdesk origin 레포 동결 | soak 1~2주 후          |
| 라이브 도메인 스왑          | 프로덕션 도메인을 deskcloud 배포로 전환                  | Phase 1 프리뷰 검증 후 |
| remote-devtools 백엔드 전환 | Render 백엔드로 이전                                     | 별도 승인              |

## 4. 중복 제거 매트릭스 (공유 vs 네이티브)

| 관심사                  | 공유로 추출(@desk/\*)            | Desk 네이티브 유지                                    |
| ----------------------- | -------------------------------- | ----------------------------------------------------- |
| 인증/테넌시             | ✅ `@desk/core` (auth · tenancy) | —                                                     |
| API 키 (`pk_`/`sk_`)    | ✅ `@desk/core`                  | —                                                     |
| 요금제/미터링           | ✅ `@desk/billing` (STUB→실구현) | —                                                     |
| 어드민 셸/SSO           | ✅ 단일 셸 (Phase 3)             | Desk별 도메인 패널                                    |
| 디자인 토큰             | ✅ 공유 OKLCH                    | Desk별 액센트/캐릭터                                  |
| content-hash 불변 저장  | —                                | ✅ termsdesk                                          |
| CDP/rrweb 세션 리플레이 | —                                | ✅ remote-devtools (TypeORM)                          |
| SSR/프리렌더            | —                                | ✅ seo-gateway (Fastify)                              |
| 배포 타깃               | —                                | ✅ 앱별 Vercel/Render/EC2 + `deploy/stack` 셀프호스트 |
