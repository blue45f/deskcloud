import { describe, expect, it } from 'vitest'

import { computeMetricOverage, computeOverage } from './overage'

describe('computeMetricOverage', () => {
  it('한도 이내면 오버리지 0', () => {
    const o = computeMetricOverage('pro', 'responses', 5_000) // pro responses 10_000
    expect(o.overUnits).toBe(0)
    expect(o.amountKrw).toBe(0)
  })

  it('초과분 × 단가 = 금액 (pro responses 단가 5원)', () => {
    const o = computeMetricOverage('pro', 'responses', 11_000) // 1000 초과
    expect(o.overUnits).toBe(1_000)
    expect(o.unitPriceKrw).toBe(5)
    expect(o.amountKrw).toBe(5_000)
  })

  it('단가 미설정 메트릭은 오버리지 0(예: searches)', () => {
    const o = computeMetricOverage('pro', 'searches', 999_999_999)
    expect(o.amountKrw).toBe(0)
  })

  it('무제한(enterprise)은 항상 0', () => {
    expect(computeMetricOverage('enterprise', 'responses', 9_999_999).amountKrw).toBe(0)
  })
})

describe('computeOverage — 인보이스', () => {
  it('기본료 + 메트릭별 오버리지 합산', () => {
    const inv = computeOverage('pro', { responses: 12_000, notifications: 100_500 })
    // responses 2000초과×5 = 10_000, notifications 500초과×1 = 500
    expect(inv.baseKrw).toBe(29_000)
    expect(inv.overageKrw).toBe(10_500)
    expect(inv.totalKrw).toBe(39_500)
    expect(inv.lines).toHaveLength(2)
  })

  it('초과 없으면 기본료만', () => {
    const inv = computeOverage('pro', { responses: 100, notifications: 10 })
    expect(inv.overageKrw).toBe(0)
    expect(inv.totalKrw).toBe(29_000)
    expect(inv.lines).toHaveLength(0)
  })

  it('Free 는 오버리지 단가 없음 → 0(hard-cap 으로 애초에 막힘)', () => {
    const inv = computeOverage('free', { responses: 999_999 })
    expect(inv.overageKrw).toBe(0)
    expect(inv.totalKrw).toBe(0)
  })
})
