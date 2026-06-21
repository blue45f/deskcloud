# BUSINESS-MODEL — DeskCloud 비즈니스 모델

DeskCloud 의 수익 모델·플랜·한도·빌링 구현을 정리합니다. 플랜 정의는 `@desk/platform` 의
`packages/shared/src/plans.ts`(`PLAN_LIMITS`)가 **단일 소스**이며, 빌링 로직은
`packages/billing`(`@desk/billing`)에 있습니다.

> 서비스 라우트는 [SERVICES.md](./SERVICES.md), 배포는 [DEPLOY.md](./DEPLOY.md).

---

## 1. 플랫폼 플랜 (단일 소스: `PLAN_LIMITS`)

`@desk/platform` 이 정의하는 4단계 플랜입니다. 모든 Desk 가 `tenant.plan` 을 읽어 이 한도를
강제합니다(`checkLimit(plan, metric, current)` → `{ allowed, limit, remaining }`).

| 플랜           | 월 가격(KRW) | 월 가격(USD) |   좌석 | API 호출/월 | 이벤트/월 | 저장(MiB) | 배지 제거 |
| -------------- | -----------: | -----------: | -----: | ----------: | --------: | --------: | :-------: |
| **Free**       |           ₩0 |           $0 |      1 |      10,000 |     1,000 |       100 |     ✗     |
| **Pro**        |      ₩29,000 |          $19 |      5 |     200,000 |    50,000 |     5,000 |     ✓     |
| **Scale**      |      ₩99,000 |          $79 |     20 |   2,000,000 |   500,000 |    50,000 |     ✓     |
| **Enterprise** |    영업 문의 |    영업 문의 | 무제한 |      무제한 |    무제한 |    무제한 |     ✓     |

- `-1`(`UNLIMITED`) = 제한 없음(Enterprise 전 메트릭).
- 가격은 KRW/USD 둘 다 보관(국내·해외 표시). Enterprise 는 가격 0 = custom(영업 문의).
- `removableBadge`: 유료 특전 — "Powered by DeskCloud" 배지를 끌 수 있는지(아래 §5).
- 공개 가격표는 `GET /api/billing/plans` 가 이 맵을 그대로 노출하며, 통합 포털의 `/pricing` 페이지가
  이 API 를 **단일 소스**로 렌더합니다(하드코딩 금지).

---

## 2. Desk별 free 플랜 캡 (서비스 레벨)

플랫폼 플랜과 별개로, **각 기능 Desk 는 자기 도메인에 맞는 free 캡**을 따로 둡니다(코드의 상수,
env 로 오버라이드 가능). 초과 시 대부분 `402`(또는 RealtimeDesk 는 `429`)로 차단합니다.

| Desk           | free 캡                | 단위                  | 상수 / env                                                                          |
| -------------- | ---------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| ChangelogDesk  | 10,000                 | 월 호출               | `DEFAULT_FREE_MONTHLY_LIMIT` / `FREE_PLAN_MONTHLY_LIMIT`                            |
| ReviewDesk     | 500                    | 누적 제출(→402)       | `FREE_PLAN_LIMIT` / `FREE_PLAN_LIMIT`                                               |
| MediaDesk      | 100 MB + 500 파일      | 저장/개수(→402)       | `freePlanMaxBytes`·`freePlanMaxCount` / `FREE_PLAN_MAX_BYTES`·`FREE_PLAN_MAX_COUNT` |
| NotifyDesk     | 1,000                  | 누적 발송(→402)       | `DEFAULT_FREE_PLAN_CAP` / `FREE_PLAN_CAP`                                           |
| ModerationDesk | 1,000                  | 누적 검사(→402)       | `FREE_PLAN_LIMIT` / `FREE_PLAN_LIMIT`                                               |
| SearchDesk     | 1,000                  | 인덱스 문서           | `DEFAULT_FREE_PLAN_DOC_CAP` / `FREE_PLAN_DOC_CAP`                                   |
| RealtimeDesk   | 100,000 msg + 100 conn | 메시지/동시연결(→429) | `FREE_MESSAGE_CAP`·`FREE_CONNECTION_CAP`                                            |
| ChatDesk       | 100,000                | 메시지                | `FREE_MESSAGE_CAP`                                                                  |
| CommunityDesk  | 게시 소프트 캡         | 글 작성(→402)         | (서비스 상수)                                                                       |
| SurveyDesk     | N/A                    | (appId 기반, 캡 없음) | —                                                                                   |
| TermsDesk      | N/A                    | (org 스코프)          | —                                                                                   |

> **설계 의도**: 캡이 도메인마다 다른 건 의도된 것입니다 — "월 호출"이 의미 있는 Desk 도 있고
> "누적 저장량"이 의미 있는 Desk 도 있어, 각자 가장 자연스러운 단위로 무료 한도를 겁니다.
> 운영 시 Pro 이상으로 올리면 `tenant.plan` 기준 플랫폼 한도(§1)로 확장됩니다.

---

## 3. 과금 단계 (usage-based overage)

- **소프트/하드 캡**: `@desk/billing` 의 `checkLimit` 이 사용량 대비 한도를 평가하고, 초과 시
  `upgradeUrl` 을 동반해 차단(하드) 또는 경고(소프트)합니다.
- **미터드 오버리지**: `computeOverage()` 유틸이 한도 초과분을 단가로 환산합니다. 현재 구현은
  **계산까지만**(스캐폴드) — 실제 청구 연동은 결제 어댑터가 TEST/STUB 라 활성화돼 있지 않습니다.
- **권장 정책**: Free 는 하드 캡(초과 시 업그레이드 유도), Pro/Scale 는 한도 초과분을
  usage-based 오버리지(예: API 호출 1만 건당 추가 과금)로 부드럽게 흡수 — 갑작스러운 차단보다
  매끄러운 확장.

---

## 4. 번들 & 셀프호스트 라이선스

DeskCloud 는 단품(Desk 개별 구독) 외에 두 가지 패키징을 제공합니다.

### (a) DeskCloud 번들

여러 Desk 를 한 계정으로 묶어 쓰는 SaaS 번들. `deploy/stack` 가 13개 기능 Desk + 플랫폼 코어를
한 호스트에서 한 번에 띄우므로(서브패스 게이트웨이), 한 도메인 아래 `/survey`·`/changelog`·… 전부를 단일
청구로 운영합니다. 번들 고객은 통합 포털(`/platform`)에서 Desk 전반의 사용량·구독을 한 화면에서
관리합니다.

### (b) 셀프호스트 라이선스

`deploy/stack` 번들을 고객 인프라에 그대로 배포(`docker compose up`)하는 모델. 기본 DB 가
PGlite 라 외부 의존 없이 단일 VM 에서 동작하고, 필요 시 Desk별로 Neon/PostgreSQL 로 승격합니다
([DEPLOY.md](./DEPLOY.md)). 셀프호스트 모드(`*_MODE=self-hosted`)에서는 글로벌 `X-Admin-Token`
으로 어드민이 가능하고, 데모 테넌트(`pk_demo`/`sk_demo`)가 시드됩니다. 셀프호스트는 "배지 제거"를
유료 라이선스 조건으로 거는 자연스러운 지점입니다.

---

## 5. 빌링 동작 (@desk/billing)

빌링 코어는 NestJS 무관 순수 로직 + 얇은 Nest 어댑터(`./nest` 서브엔트리)로 분리돼 있습니다.

### 결제 어댑터 (Toss / Stripe — TEST/STUB 전용)

- `packages/billing/src/{stub,toss,stripe}-adapter.ts` — 공통 어댑터 인터페이스(`createCheckout`,
  `verifyWebhook`)를 stub/toss/stripe 가 구현.
- 환경변수 `DESK_BILLING_PROVIDER`(stub | toss | stripe, **기본 stub**).
- **중요(자금 이동 안전)**: 어댑터는 **TEST/STUB 모드 전용**입니다. 실제 Toss/Stripe 시크릿 키는
  코드/배포에 절대 넣지 않으며(`DESK_BILLING_TEST_KEY=test_placeholder_no_real_charges`),
  체크아웃·웹훅은 가짜 URL·가짜 결정만 반환합니다. **실제 자금 이동은 없습니다.** 라이브 결제로
  전환하려면 finance 결정 + 실제 키 주입 + 어댑터 라이브화가 별도로 필요합니다.

### 플랜 → 한도 집행

1. 테넌트는 `tenant.plan`(free/pro/scale/enterprise)을 가집니다.
2. Desk 가 공개 호출을 받을 때마다 `UsageMeter` 가 메트릭(api_calls/events/storage_mb/seats)을
   기록합니다.
3. `checkLimit(plan, metric, current)` 이 `PLAN_LIMITS`(§1)와 비교해 허용/차단을 판단.
   Nest 측에서는 `UsageLimitGuard` + `@EnforceLimit('metric')` + `UsageLimitResolver`(Desk 가
   주입)로 선언적 집행이 가능합니다.

### 구독 상태 머신

- 상태: `active` | `canceled` | `none`.
- 이벤트: `subscription_created` · `payment_succeeded` · `subscription_canceled` 등.
- `applyEvent()` / `nextStatus()` 가 상태 전이. 웹훅(stub/toss/stripe)은 서명 검증
  (`verifyWebhook`) 후 동일 정규화 형태로 상태에 반영됩니다.
- 구독은 테넌트당 1개(`subscriptions` 테이블, 1:1).

### "Powered by DeskCloud" 배지

- `shouldShowBadge(plan)` — Free 플랜(removableBadge=false)은 표시, Pro/Scale/Enterprise 는
  제거 가능.
- 컴포넌트: `apps/web/src/PoweredByDeskCloud.tsx`(`<PoweredByDeskCloud hidden={removeBranding} />`).
- 마케팅 훅: 무료 사용자의 위젯 푸터에 배지가 노출돼 자연 유입을 만들고, 유료 전환 시 제거 가능 —
  Vercel/Netlify 식 무료-티어 바이럴 루프.

---

## 6. 가격 전략 · 타깃 고객

### 포지셔닝

"앱마다 다시 짜는 공통 기능을, 키 한 줄로." 약관·설문·체인지로그·리뷰·미디어·알림·모더레이션·
실시간·검색·커뮤니티·채팅 — 각각을 별도 SaaS(Typeform / LaunchNotes / Trustpilot / Cloudinary /
Knock / Algolia / Stream / …)로 사면 비싸고 통합이 제각각입니다. DeskCloud 는 **하나의 일관된
멀티테넌트 패턴**(pk/sk · CORS · 위젯 · 포털)으로 이 전부를 묶어, 한 줄 임베드와 단일 청구를 줍니다.

### 가격 전략

- **Free-first / land-and-expand**: 후한 Free 캡(§2)으로 도입 마찰 제거 → 사용량이 늘면 Pro/Scale 로
  자연 확장.
- **단일 소스 가격표**: `GET /api/billing/plans` 가 진실의 원천 — 포털·문서·위젯이 전부 같은 값을
  읽어 가격 드리프트를 막음.
- **배지 바이럴**: 무료 위젯의 "Powered by DeskCloud" 가 신규 유입 채널.
- **번들 할인 + 셀프호스트 라이선스**: 여러 Desk 를 묶으면 단품 합보다 저렴, 데이터 주권이 중요한
  고객은 셀프호스트.

### 타깃 고객

| 세그먼트               | 무엇을 사는가                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| 인디 해커 / 1인 개발자 | 백엔드 없이 Free 캡으로 위젯만 꽂아 빠르게 출시                                            |
| 스타트업               | 약관·리뷰·알림·검색 등 여러 Desk 를 번들로, 통합 포털에서 관리                             |
| 형제 앱 생태계(자체)   | 13개 앱이 SurveyDesk FeedbackWidget 등을 env-gated 로 소비([ECOSYSTEM.md](./ECOSYSTEM.md)) |
| 데이터 주권 필요 기업  | 셀프호스트 라이선스(`deploy/stack`)로 자체 인프라 배포                                     |

---

## 7. 빌링 안전 체크리스트 (운영 전 필독)

- [ ] `DESK_BILLING_PROVIDER` 는 stub(또는 TEST) — 실제 결제 전 라이브 키 금지.
- [ ] 실제 Toss/Stripe 시크릿 키는 코드·`.env`·이미지에 들어가지 않음.
- [ ] 라이브 결제 전환은 **finance 결정 + 어댑터 라이브화**가 선행(코드만으로 켜지 않음).
- [ ] `DESK_KEY_PEPPER` 는 배포마다 강한 무작위 값(secret 키 해시 솔트).
- [ ] 환불/분쟁정산/보증금 캡처류는 "결정만 기록"하고 실제 자금 이동은 별도 wiring 필요(스텁).
