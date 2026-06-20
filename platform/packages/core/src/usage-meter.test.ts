import { beforeEach, describe, expect, it } from 'vitest'

import { InMemoryUsageStore } from './memory-stores'
import { UsageMeter, resolvePeriod } from './usage-meter'

describe('UsageMeter', () => {
  let meter: UsageMeter

  beforeEach(() => {
    meter = new UsageMeter(new InMemoryUsageStore())
  })

  it("resolvePeriod: 'current' → 이번 달 UTC YYYY-MM", () => {
    expect(resolvePeriod('current')).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
    expect(resolvePeriod('2025-03')).toBe('2025-03')
  })

  it('record 누적 + getMetric', async () => {
    expect(await meter.record('t1', 'api_calls')).toBe(1)
    expect(await meter.record('t1', 'api_calls', 4)).toBe(5)
    expect(await meter.getMetric('t1', 'api_calls')).toBe(5)
  })

  it('record n<=0 은 증가 없이 현재값 반환', async () => {
    await meter.record('t1', 'events', 3)
    expect(await meter.record('t1', 'events', 0)).toBe(3)
    expect(await meter.record('t1', 'events', -5)).toBe(3)
  })

  it('getUsage: 모든 메트릭(미기록은 0)', async () => {
    await meter.record('t1', 'api_calls', 2)
    await meter.record('t1', 'events', 7)
    const u = await meter.getUsage('t1')
    expect(u.api_calls).toBe(2)
    expect(u.events).toBe(7)
    expect(u.storage_mb).toBe(0)
    expect(u.seats).toBe(0)
  })

  it('테넌트·기간 격리', async () => {
    await meter.record('t1', 'api_calls', 5, '2025-01')
    await meter.record('t2', 'api_calls', 9, '2025-01')
    expect(await meter.getMetric('t1', 'api_calls', '2025-01')).toBe(5)
    expect(await meter.getMetric('t2', 'api_calls', '2025-01')).toBe(9)
    expect(await meter.getMetric('t1', 'api_calls', '2025-02')).toBe(0)
  })

  it('reset: 단일 메트릭 / 기간 전체', async () => {
    await meter.record('t1', 'api_calls', 5)
    await meter.record('t1', 'events', 3)
    await meter.reset('t1', 'current', 'api_calls')
    expect(await meter.getMetric('t1', 'api_calls')).toBe(0)
    expect(await meter.getMetric('t1', 'events')).toBe(3)
    await meter.reset('t1')
    expect(await meter.getMetric('t1', 'events')).toBe(0)
  })

  it('checkAllowed: free 한도 대비 집행', async () => {
    // free api_calls 한도 10_000
    await meter.record('t1', 'api_calls', 9_999)
    const ok = await meter.checkAllowed('t1', 'free', 'api_calls')
    expect(ok).toEqual({ allowed: true, used: 9_999, limit: 10_000, remaining: 1 })

    await meter.record('t1', 'api_calls', 1) // 10_000
    const blocked = await meter.checkAllowed('t1', 'free', 'api_calls')
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('checkAllowed: enterprise 무제한은 항상 허용', async () => {
    await meter.record('t1', 'api_calls', 9_999_999)
    const r = await meter.checkAllowed('t1', 'enterprise', 'api_calls')
    expect(r.allowed).toBe(true)
  })
})
