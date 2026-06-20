import { describe, expect, it } from 'vitest'

import { checkLimit } from './enforce-limit'

describe('checkLimit — soft/hard cap', () => {
  it('한도 한참 아래면 allowed, softCapHit 없음', () => {
    const r = checkLimit({ plan: 'free' }, 'responses', 10) // free responses 100
    expect(r.allowed).toBe(true)
    expect(r.softCapHit).toBe(false)
    expect(r.hardCapHit).toBe(false)
    expect(r.remaining).toBe(90)
    expect(r.upgradeUrl).toBeUndefined()
  })

  it('80% 임박이면 softCapHit + upgradeUrl(차단 아님)', () => {
    const r = checkLimit({ plan: 'free' }, 'responses', 85) // 85/100 = 0.85
    expect(r.allowed).toBe(true)
    expect(r.softCapHit).toBe(true)
    expect(r.upgradeUrl).toContain('plan=pro')
    expect(r.suggestedPlan).toBe('pro')
  })

  it('Free 한도 도달 = hard-cap 차단', () => {
    const r = checkLimit({ plan: 'free' }, 'responses', 100)
    expect(r.allowed).toBe(false)
    expect(r.hardCapHit).toBe(true)
    expect(r.reason).toContain('업그레이드')
    expect(r.upgradeUrl).toContain('plan=pro')
  })

  it('유료(Pro) 한도 초과 = soft-cap 허용(매출 우선) + 경고', () => {
    const r = checkLimit({ plan: 'pro' }, 'responses', 10_001) // pro responses 10_000
    expect(r.allowed).toBe(true) // 차단하지 않음(미터드 오버리지)
    expect(r.hardCapHit).toBe(false)
    expect(r.softCapHit).toBe(true)
    expect(r.suggestedPlan).toBe('scale')
  })

  it('allowSoftOverage=false 면 유료도 hard-cap 차단', () => {
    const r = checkLimit({ plan: 'pro' }, 'responses', 10_001, { allowSoftOverage: false })
    expect(r.allowed).toBe(false)
    expect(r.hardCapHit).toBe(true)
  })

  it('enterprise 무제한은 항상 allowed, 경고 없음', () => {
    const r = checkLimit({ plan: 'enterprise' }, 'responses', 9_999_999)
    expect(r.allowed).toBe(true)
    expect(r.softCapHit).toBe(false)
    expect(r.limit).toBe(-1)
    expect(r.remaining).toBe(-1)
  })

  it('upgradeUrlBase 커스터마이즈', () => {
    const r = checkLimit({ plan: 'free' }, 'responses', 100, { upgradeUrlBase: '/account/billing' })
    expect(r.upgradeUrl).toContain('/account/billing?plan=pro')
  })

  it('softCapRatio 조정', () => {
    const tight = checkLimit({ plan: 'free' }, 'responses', 55, { softCapRatio: 0.5 })
    expect(tight.softCapHit).toBe(true)
    const loose = checkLimit({ plan: 'free' }, 'responses', 55, { softCapRatio: 0.9 })
    expect(loose.softCapHit).toBe(false)
  })
})
