import { describe, expect, it } from 'vitest'

import { UNLIMITED } from './constants'
import { PLAN_LIMITS, checkLimit, isUnlimited, limitFor } from './plans'

describe('plans', () => {
  it('모든 플랜이 PlanLimit 을 가진다', () => {
    expect(PLAN_LIMITS.free.seats).toBe(1)
    expect(PLAN_LIMITS.pro.seats).toBe(5)
    expect(PLAN_LIMITS.enterprise.seats).toBe(UNLIMITED)
  })

  it('limitFor: 메트릭별 한도', () => {
    expect(limitFor('free', 'api_calls')).toBe(10_000)
    expect(limitFor('pro', 'events')).toBe(50_000)
    expect(limitFor('enterprise', 'storage_mb')).toBe(UNLIMITED)
  })

  it('checkLimit: 한도 내/초과', () => {
    expect(checkLimit('free', 'api_calls', 9_999)).toEqual({
      allowed: true,
      limit: 10_000,
      remaining: 1,
    })
    expect(checkLimit('free', 'api_calls', 10_000)).toEqual({
      allowed: false,
      limit: 10_000,
      remaining: 0,
    })
  })

  it('checkLimit: 무제한 플랜은 항상 허용', () => {
    const r = checkLimit('enterprise', 'api_calls', 9_999_999)
    expect(r.allowed).toBe(true)
    expect(isUnlimited(r.limit)).toBe(true)
    expect(r.remaining).toBe(UNLIMITED)
  })

  it('Free 는 배지 제거 불가, 유료는 가능', () => {
    expect(PLAN_LIMITS.free.removableBadge).toBe(false)
    expect(PLAN_LIMITS.pro.removableBadge).toBe(true)
  })
})
