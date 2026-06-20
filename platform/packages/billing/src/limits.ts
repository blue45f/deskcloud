import { PLANS, UNLIMITED, type Plan } from '@desk/shared'

/**
 * 플랜 한도 — 데이터 우선(per-Desk 확장 가능) 모델.
 *
 * 설계: 각 Desk 마다 측정하는 메트릭이 다르다(SurveyDesk=responses, NotifyDesk=notifications,
 * SearchDesk=searches, MediaDesk=storageBytes/mediaCount …). 그래서 한도는 **고정 키가 아니라
 * Desk 가 자기 메트릭 키를 넘기는** 제네릭 맵으로 둔다. 공통 기능 플래그(removeBranding·
 * customDomain·webhooks)는 모든 Desk 공유.
 *
 * `-1`(UNLIMITED) = 제한 없음. 가격은 표시·체크아웃용(실제 청구 없음 — money-movement boundary).
 */

/** 모든 Desk 공통 불리언 기능 플래그(유료 특전). */
export interface PlanFeatures {
  /** 'Powered by DeskCloud' 배지 제거 가능(Free=false). */
  removeBranding: boolean
  /** 커스텀 도메인 연결 가능. */
  customDomain: boolean
  /** 아웃바운드 웹훅 사용 가능. */
  webhooks: boolean
}

/**
 * 단일 플랜 정의. `limits` 는 메트릭 키 → 한도(number, -1=무제한)의 임의 맵.
 * Desk 별 메트릭 키 집합을 제네릭 `M` 으로 좁힌다.
 */
export interface PlanDef<M extends string = string> {
  plan: Plan
  label: string
  /** 월 가격(원). 0 = 무료. enterprise 는 0(영업 문의). */
  priceKrwMonthly: number
  /** 월 가격(USD 센트). */
  priceUsdCentsMonthly: number
  /** 메트릭별 월 한도(또는 스냅샷 한도). -1 = 무제한. */
  limits: Readonly<Record<M, number>>
  /** 공통 기능 플래그. */
  features: PlanFeatures
  /** 메트릭 단위 초과 과금 단가(원/단위) — 미터드 빌링용(선택). */
  overagePerUnitKrw?: Readonly<Partial<Record<M, number>>>
}

/** Desk 한 곳의 전체 플랜 카탈로그(plan → 정의). */
export type PlanCatalog<M extends string = string> = Readonly<Record<Plan, PlanDef<M>>>

/**
 * Desk 가 자기 메트릭으로 플랜 카탈로그를 만든다.
 * 4개 플랜(free/pro/scale/enterprise)을 모두 정의해야 한다(타입으로 강제).
 *
 * @example
 * const surveyPlans = defineDeskPlans({
 *   free:  { label: 'Free',  priceKrwMonthly: 0,      limits: { responses: 100 },   features: { removeBranding: false, ... } },
 *   pro:   { label: 'Pro',   priceKrwMonthly: 29_000, limits: { responses: 10_000 }, features: { removeBranding: true,  ... } },
 *   ...
 * })
 */
export function defineDeskPlans<M extends string>(
  catalog: Record<Plan, Omit<PlanDef<M>, 'plan'>>
): PlanCatalog<M> {
  const out = {} as Record<Plan, PlanDef<M>>
  for (const plan of PLANS) {
    out[plan] = { plan, ...catalog[plan] }
  }
  return out as PlanCatalog<M>
}

/**
 * 카탈로그에서 한 플랜의 메트릭 한도를 조회. 키가 없으면 무제한으로 간주(Desk 가 추적하지 않는 메트릭).
 */
export function planLimit<M extends string>(
  catalog: PlanCatalog<M>,
  plan: Plan,
  metric: M
): number {
  const v = catalog[plan].limits[metric]
  return v === undefined ? UNLIMITED : v
}

/** 무제한 여부. */
export const isUnlimited = (limit: number): boolean => limit === UNLIMITED

/** 다음 상위 플랜(업그레이드 유도용). enterprise 위는 없음(null). */
export function nextPlanUp(plan: Plan): Plan | null {
  const i = PLANS.indexOf(plan)
  return i >= 0 && i < PLANS.length - 1 ? PLANS[i + 1]! : null
}

/* -------------------------------------------------------------------------- */
/* DeskCloud 표준 카탈로그 — 모든 Desk 가 공유하는 "수퍼셋" 메트릭의 단일 소스.       */
/* 각 Desk 는 이 중 자기 메트릭만 읽거나, defineDeskPlans 로 자기 카탈로그를 만든다.   */
/* vendor/plan-limits.ts 로도 단일파일 벤더링된다(드리프트 방지).                    */
/* -------------------------------------------------------------------------- */

/** DeskCloud 표준 메트릭 키(모든 Desk 메트릭의 합집합). */
export const DESK_METRICS = [
  'responses', // SurveyDesk/ReviewDesk: 수집 응답·리뷰
  'notifications', // NotifyDesk: 발송 알림
  'searches', // SearchDesk: 검색 쿼리
  'storageBytes', // MediaDesk: 저장 바이트
  'mediaCount', // MediaDesk: 미디어 자산 수
  'seats', // 공통: 팀 좌석
  'projects', // 공통: 프로젝트·앱 수
] as const
export type DeskMetric = (typeof DESK_METRICS)[number]

export const DESK_PLANS: PlanCatalog<DeskMetric> = defineDeskPlans<DeskMetric>({
  free: {
    label: 'Free',
    priceKrwMonthly: 0,
    priceUsdCentsMonthly: 0,
    limits: {
      responses: 100,
      notifications: 1_000,
      searches: 5_000,
      storageBytes: 100 * 1024 * 1024, // 100 MiB
      mediaCount: 50,
      seats: 1,
      projects: 1,
    },
    features: { removeBranding: false, customDomain: false, webhooks: false },
  },
  pro: {
    label: 'Pro',
    priceKrwMonthly: 29_000,
    priceUsdCentsMonthly: 1_900,
    limits: {
      responses: 10_000,
      notifications: 100_000,
      searches: 500_000,
      storageBytes: 5 * 1024 * 1024 * 1024, // 5 GiB
      mediaCount: 5_000,
      seats: 5,
      projects: 10,
    },
    features: { removeBranding: true, customDomain: false, webhooks: true },
    // 응답/알림 초과는 단위당 소액 과금(미터드). 표시·계산용 — 실제 청구 없음.
    overagePerUnitKrw: { responses: 5, notifications: 1 },
  },
  scale: {
    label: 'Scale',
    priceKrwMonthly: 99_000,
    priceUsdCentsMonthly: 7_900,
    limits: {
      responses: 100_000,
      notifications: 2_000_000,
      searches: 10_000_000,
      storageBytes: 50 * 1024 * 1024 * 1024, // 50 GiB
      mediaCount: 100_000,
      seats: 20,
      projects: 100,
    },
    features: { removeBranding: true, customDomain: true, webhooks: true },
    overagePerUnitKrw: { responses: 3, notifications: 1 },
  },
  enterprise: {
    label: 'Enterprise',
    priceKrwMonthly: 0, // 영업 문의(custom)
    priceUsdCentsMonthly: 0,
    limits: {
      responses: UNLIMITED,
      notifications: UNLIMITED,
      searches: UNLIMITED,
      storageBytes: UNLIMITED,
      mediaCount: UNLIMITED,
      seats: UNLIMITED,
      projects: UNLIMITED,
    },
    features: { removeBranding: true, customDomain: true, webhooks: true },
  },
})

/** DeskCloud 표준 카탈로그에서 기능 플래그 조회. */
export function planFeatures(plan: Plan): PlanFeatures {
  return DESK_PLANS[plan].features
}
