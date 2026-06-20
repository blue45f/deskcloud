import { describe, expect, it } from 'vitest'

import {
  PLAN_USER_LIMITS,
  UNLIMITED,
  isAtLimit,
  isUnlimited,
  metricLimit,
  planUserLimit,
  remainingQuota,
} from './constants'
import { buildUsageSummary } from './dto'

describe('plan limit helpers', () => {
  it('planUserLimit 은 플랜별 한도를 돌려준다', () => {
    expect(planUserLimit('free')).toBe(PLAN_USER_LIMITS.free)
    expect(planUserLimit('pro')).toBe(PLAN_USER_LIMITS.pro)
    expect(planUserLimit('enterprise')).toBe(UNLIMITED)
  })

  it('metricLimit 은 auth_users 만 플랜 한도, logins 는 무제한', () => {
    expect(metricLimit('free', 'auth_users')).toBe(PLAN_USER_LIMITS.free)
    expect(metricLimit('free', 'logins')).toBe(UNLIMITED)
  })

  it('isUnlimited 은 -1 표식만 true', () => {
    expect(isUnlimited(UNLIMITED)).toBe(true)
    expect(isUnlimited(0)).toBe(false)
    expect(isUnlimited(1000)).toBe(false)
  })

  it('isAtLimit — 무제한은 절대 막지 않고, 유한 한도는 used>=limit 에서 막는다', () => {
    expect(isAtLimit(999, 1000)).toBe(false)
    expect(isAtLimit(1000, 1000)).toBe(true)
    expect(isAtLimit(1001, 1000)).toBe(true)
    expect(isAtLimit(1_000_000, UNLIMITED)).toBe(false)
  })

  it('remainingQuota — 무제한은 -1, 유한은 max(0, limit-used)', () => {
    expect(remainingQuota(10, UNLIMITED)).toBe(UNLIMITED)
    expect(remainingQuota(300, 1000)).toBe(700)
    expect(remainingQuota(1500, 1000)).toBe(0)
  })
})

describe('buildUsageSummary', () => {
  it('메트릭별 used/limit/remaining 을 플랜에서 파생한다', () => {
    const summary = buildUsageSummary('t-1', 'free', { auth_users: 250, logins: 4200 })
    expect(summary.tenantId).toBe('t-1')
    expect(summary.plan).toBe('free')

    const authUsers = summary.metrics.find((m) => m.metric === 'auth_users')
    expect(authUsers).toEqual({
      metric: 'auth_users',
      used: 250,
      limit: PLAN_USER_LIMITS.free,
      remaining: PLAN_USER_LIMITS.free - 250,
    })

    const logins = summary.metrics.find((m) => m.metric === 'logins')
    expect(logins).toEqual({ metric: 'logins', used: 4200, limit: UNLIMITED, remaining: UNLIMITED })
  })

  it('enterprise 는 auth_users 도 무제한', () => {
    const summary = buildUsageSummary('t-2', 'enterprise', { auth_users: 9_999_999, logins: 0 })
    const authUsers = summary.metrics.find((m) => m.metric === 'auth_users')
    expect(authUsers?.limit).toBe(UNLIMITED)
    expect(authUsers?.remaining).toBe(UNLIMITED)
  })
})
