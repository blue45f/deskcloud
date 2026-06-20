import { describe, expect, it } from 'vitest'

import {
  PLAN_IDS,
  PLAN_LIMITS,
  PLAN_PRICES_KRW,
  UNLIMITED,
  formatPlanLimit,
  isPlanId,
  isUnlimited,
  withinLimit,
} from './plans'
import { updateOrgPlanSchema } from './schemas'

describe('PLAN_LIMITS 매트릭스', () => {
  it('티어 수치가 B2B 플랜 스펙과 일치한다 (free 2/3/1/1k · pro 5/20/3/50k · team 20/∞/10/500k)', () => {
    expect(PLAN_LIMITS.free).toEqual({
      members: 2,
      policies: 3,
      apiKeys: 1,
      apiCallsPerMonth: 1_000,
    })
    expect(PLAN_LIMITS.pro).toEqual({
      members: 5,
      policies: 20,
      apiKeys: 3,
      apiCallsPerMonth: 50_000,
    })
    expect(PLAN_LIMITS.team).toEqual({
      members: 20,
      policies: UNLIMITED,
      apiKeys: 10,
      apiCallsPerMonth: 500_000,
    })
  })

  it('상위 티어는 모든 축에서 하위 티어 이상이다 (무제한 = Infinity 취급)', () => {
    const widen = (n: number) => (isUnlimited(n) ? Number.POSITIVE_INFINITY : n)
    const axes = ['members', 'policies', 'apiKeys', 'apiCallsPerMonth'] as const
    for (const axis of axes) {
      expect(widen(PLAN_LIMITS.pro[axis])).toBeGreaterThanOrEqual(widen(PLAN_LIMITS.free[axis]))
      expect(widen(PLAN_LIMITS.team[axis])).toBeGreaterThanOrEqual(widen(PLAN_LIMITS.pro[axis]))
    }
  })

  it('데모 가격이 0(free) → 49,000(pro) → 149,000(team)으로 단조 증가한다', () => {
    expect(PLAN_PRICES_KRW).toEqual({ free: 0, pro: 49_000, team: 149_000 })
  })
})

describe('한도 판정 헬퍼', () => {
  it('withinLimit: -1(무제한)은 항상 통과, 그 외엔 current < limit', () => {
    expect(withinLimit(UNLIMITED, 1_000_000)).toBe(true)
    expect(withinLimit(3, 2)).toBe(true)
    expect(withinLimit(3, 3)).toBe(false)
    expect(withinLimit(3, 4)).toBe(false)
  })

  it('formatPlanLimit: 무제한·천 단위 구분 표기', () => {
    expect(formatPlanLimit(UNLIMITED)).toBe('무제한')
    expect(formatPlanLimit(10_000)).toBe('10,000')
  })

  it('isPlanId 는 free|pro|team 만 허용한다', () => {
    for (const id of PLAN_IDS) expect(isPlanId(id)).toBe(true)
    expect(isPlanId('enterprise')).toBe(false)
    expect(isPlanId(undefined)).toBe(false)
  })
})

describe('updateOrgPlanSchema (zod)', () => {
  it('유효한 플랜만 통과한다', () => {
    expect(updateOrgPlanSchema.parse({ plan: 'pro' })).toEqual({ plan: 'pro' })
    expect(updateOrgPlanSchema.safeParse({ plan: 'business' }).success).toBe(false)
    expect(updateOrgPlanSchema.safeParse({}).success).toBe(false)
  })
})
