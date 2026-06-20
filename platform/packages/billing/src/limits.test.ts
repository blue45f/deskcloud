import { describe, expect, it } from 'vitest'

import {
  DESK_PLANS,
  defineDeskPlans,
  isUnlimited,
  nextPlanUp,
  planFeatures,
  planLimit,
} from './limits'

describe('DESK_PLANS 카탈로그', () => {
  it('4개 플랜 모두 정의', () => {
    expect(Object.keys(DESK_PLANS).sort()).toEqual(['enterprise', 'free', 'pro', 'scale'])
  })

  it('한도가 플랜 따라 단조 증가(또는 무제한)', () => {
    expect(DESK_PLANS.free.limits.responses).toBeLessThan(DESK_PLANS.pro.limits.responses)
    expect(DESK_PLANS.pro.limits.responses).toBeLessThan(DESK_PLANS.scale.limits.responses)
    expect(isUnlimited(DESK_PLANS.enterprise.limits.responses)).toBe(true)
  })

  it('기능 플래그 — Free 는 branding 제거 불가, Pro+ 는 가능', () => {
    expect(planFeatures('free').removeBranding).toBe(false)
    expect(planFeatures('pro').removeBranding).toBe(true)
    expect(planFeatures('free').customDomain).toBe(false)
    expect(planFeatures('scale').customDomain).toBe(true)
    expect(planFeatures('free').webhooks).toBe(false)
    expect(planFeatures('pro').webhooks).toBe(true)
  })
})

describe('planLimit', () => {
  it('카탈로그에서 메트릭 한도 조회', () => {
    expect(planLimit(DESK_PLANS, 'free', 'seats')).toBe(1)
    expect(planLimit(DESK_PLANS, 'pro', 'seats')).toBe(5)
  })

  it('추적하지 않는 메트릭은 무제한', () => {
    // @ts-expect-error 일부러 카탈로그에 없는 키
    expect(planLimit(DESK_PLANS, 'free', 'unknown_metric')).toBe(-1)
  })
})

describe('defineDeskPlans (per-Desk 확장)', () => {
  it('Desk 가 자기 메트릭으로 카탈로그 생성', () => {
    const surveyPlans = defineDeskPlans<'responses' | 'seats'>({
      free: {
        label: 'Free',
        priceKrwMonthly: 0,
        priceUsdCentsMonthly: 0,
        limits: { responses: 100, seats: 1 },
        features: { removeBranding: false, customDomain: false, webhooks: false },
      },
      pro: {
        label: 'Pro',
        priceKrwMonthly: 19_000,
        priceUsdCentsMonthly: 1_500,
        limits: { responses: 10_000, seats: 5 },
        features: { removeBranding: true, customDomain: false, webhooks: true },
      },
      scale: {
        label: 'Scale',
        priceKrwMonthly: 59_000,
        priceUsdCentsMonthly: 4_900,
        limits: { responses: 100_000, seats: 20 },
        features: { removeBranding: true, customDomain: true, webhooks: true },
      },
      enterprise: {
        label: 'Enterprise',
        priceKrwMonthly: 0,
        priceUsdCentsMonthly: 0,
        limits: { responses: -1, seats: -1 },
        features: { removeBranding: true, customDomain: true, webhooks: true },
      },
    })
    expect(surveyPlans.free.plan).toBe('free')
    expect(planLimit(surveyPlans, 'pro', 'responses')).toBe(10_000)
  })
})

describe('nextPlanUp', () => {
  it('상위 플랜 반환, enterprise 위는 null', () => {
    expect(nextPlanUp('free')).toBe('pro')
    expect(nextPlanUp('pro')).toBe('scale')
    expect(nextPlanUp('scale')).toBe('enterprise')
    expect(nextPlanUp('enterprise')).toBeNull()
  })
})
