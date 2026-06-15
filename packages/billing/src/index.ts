// @desk/billing — 플랜·결제 어댑터(TEST/STUB 전용)·한도 집행·구독 상태 머신·오버리지.
// 모든 Desk 를 수익 상품으로 전환하는 빌링/수익화 레이어.

// 플랜(데이터 우선, per-Desk 확장 가능) + 기능 플래그
export * from './limits'

// 한도 집행 — soft/hard cap + upgradeUrl
export * from './enforce-limit'

// 미터드 오버리지 계산
export * from './overage'

// 구독 모델 + 상태 머신
export * from './subscription'

// 결제 어댑터 포트 + 구현(stub/toss/stripe, 모두 TEST/STUB)
export * from './adapter'
export * from './stub-adapter'
export * from './toss-adapter'
export * from './stripe-adapter'
export * from './factory'

// 레거시 단순 집행 헬퍼(STAGE 1 호환 — USAGE_METRICS 기반).
export { enforce, type EnforceResult } from './enforcement'

// 플랜 정의/한도는 shared 의 단일 소스를 재노출(빌링 소비자 편의).
export {
  PLANS,
  PLAN_LIMITS,
  limitFor,
  UNLIMITED,
  type Plan,
  type PlanLimit,
} from '@desk/shared'
