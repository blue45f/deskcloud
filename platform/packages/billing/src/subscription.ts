import { type Plan } from '@desk/shared'

import type { BillingProvider } from './adapter'

/**
 * 구독 모델 + 상태 머신.
 *
 * 상태 전이(웹훅·체크아웃·취소가 트리거):
 *
 *   none ──checkout──▶ incomplete ──activated──▶ active
 *                                                  │  ├──past_due──▶ active (payment_recovered)
 *                                                  │  └──canceled──▶ canceled ──reactivated──▶ active
 *   (체크아웃 실패) incomplete ──failed──▶ canceled
 *
 * 'none' = 구독 없음(Free). 결제 성공 시 active + plan 승급, 취소 시 free 복귀.
 */

export const SUBSCRIPTION_STATUSES = [
  'none', // 구독 없음(Free 기본)
  'incomplete', // 체크아웃 시작, 결제 확인 전
  'active', // 활성(유료)
  'past_due', // 결제 실패, 유예 중(아직 활성 취급)
  'canceled', // 취소됨(기간 말 Free 복귀)
] as const
export type SubscriptionStatusValue = (typeof SUBSCRIPTION_STATUSES)[number]

/** 상태 전이 이벤트. */
export const SUBSCRIPTION_EVENTS = [
  'checkout_started',
  'activated',
  'payment_failed',
  'payment_recovered',
  'canceled',
  'reactivated',
] as const
export type SubscriptionEvent = (typeof SUBSCRIPTION_EVENTS)[number]

/** 구독 레코드(영속). */
export interface Subscription {
  tenantId: string
  plan: Plan
  status: SubscriptionStatusValue
  provider: BillingProvider
  /** 제공자측 구독 식별자(스텁은 가짜). */
  providerSubscriptionId: string | null
  /** 현재 청구 주기 종료(취소 시 이 시점까지 유지). */
  periodEnd: string | null
  /** 기간 말 취소 예약 여부. */
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

/** 활성으로 간주되는 상태(서비스 접근 허용). */
export function isSubscriptionActive(status: SubscriptionStatusValue): boolean {
  return status === 'active' || status === 'past_due'
}

/** 상태 머신 — 허용된 전이만 정의. 키 부재 = 전이 불가. */
const TRANSITIONS: Record<SubscriptionStatusValue, Partial<Record<SubscriptionEvent, SubscriptionStatusValue>>> = {
  none: {
    checkout_started: 'incomplete',
    activated: 'active', // 웹훅이 incomplete 를 건너뛰고 바로 활성화할 수도 있음
  },
  incomplete: {
    activated: 'active',
    payment_failed: 'canceled',
    canceled: 'canceled',
  },
  active: {
    payment_failed: 'past_due',
    canceled: 'canceled',
    activated: 'active', // 멱등(플랜 변경 등)
  },
  past_due: {
    payment_recovered: 'active',
    activated: 'active',
    canceled: 'canceled',
  },
  canceled: {
    reactivated: 'active',
    activated: 'active',
    checkout_started: 'incomplete',
  },
}

export class SubscriptionTransitionError extends Error {
  constructor(
    readonly from: SubscriptionStatusValue,
    readonly event: SubscriptionEvent
  ) {
    super(`구독 상태 전이 불가: ${from} --${event}-->`)
    this.name = 'SubscriptionTransitionError'
  }
}

/** 전이 가능 여부. */
export function canTransition(
  from: SubscriptionStatusValue,
  event: SubscriptionEvent
): boolean {
  return TRANSITIONS[from][event] !== undefined
}

/** 다음 상태 계산(불가 시 throw). */
export function nextStatus(
  from: SubscriptionStatusValue,
  event: SubscriptionEvent
): SubscriptionStatusValue {
  const to = TRANSITIONS[from][event]
  if (to === undefined) throw new SubscriptionTransitionError(from, event)
  return to
}

/** 새 구독(없음/Free) 기본값. */
export function emptySubscription(tenantId: string, provider: BillingProvider): Subscription {
  const now = new Date().toISOString()
  return {
    tenantId,
    plan: 'free',
    status: 'none',
    provider,
    providerSubscriptionId: null,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 이벤트를 적용해 새 구독 상태를 반환(순수 함수, 원본 불변).
 * activated 시 plan 승급, canceled 시 cancelAtPeriodEnd 표시(plan 은 기간 말 Free 로 — 별도 처리).
 */
export interface ApplyEventInput {
  event: SubscriptionEvent
  /** activated/reactivated 시 적용할 플랜. */
  plan?: Plan
  providerSubscriptionId?: string | null
  periodEnd?: string | null
}

export function applyEvent(sub: Subscription, input: ApplyEventInput): Subscription {
  const status = nextStatus(sub.status, input.event)
  const now = new Date().toISOString()
  const next: Subscription = { ...sub, status, updatedAt: now }

  switch (input.event) {
    case 'checkout_started':
      if (input.plan) next.plan = input.plan
      if (input.providerSubscriptionId !== undefined)
        next.providerSubscriptionId = input.providerSubscriptionId
      next.cancelAtPeriodEnd = false
      break
    case 'activated':
    case 'reactivated':
      if (input.plan) next.plan = input.plan
      if (input.providerSubscriptionId !== undefined)
        next.providerSubscriptionId = input.providerSubscriptionId
      if (input.periodEnd !== undefined) next.periodEnd = input.periodEnd
      next.cancelAtPeriodEnd = false
      break
    case 'canceled':
      // 기간 말 취소 — 즉시 Free 로 떨어뜨린다(스텁/단순화). periodEnd 유지.
      next.cancelAtPeriodEnd = true
      next.plan = 'free'
      break
    case 'payment_failed':
    case 'payment_recovered':
      // 플랜 유지, 상태만 전이.
      break
  }
  return next
}
