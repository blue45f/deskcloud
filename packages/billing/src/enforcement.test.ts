import { describe, expect, it } from 'vitest'

import { enforce } from './enforcement'
import { StubBillingAdapter } from './stub-adapter'

describe('enforce', () => {
  it('한도 내면 allowed, reason 없음', () => {
    const r = enforce('free', 'api_calls', 100)
    expect(r.allowed).toBe(true)
    expect(r.reason).toBeUndefined()
    expect(r.remaining).toBe(9_900)
  })

  it('한도 도달이면 거절 + 업그레이드 사유', () => {
    const r = enforce('free', 'events', 1_000) // free events 한도 1_000
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('업그레이드')
  })

  it('enterprise 무제한은 항상 allowed', () => {
    expect(enforce('enterprise', 'api_calls', 9_999_999).allowed).toBe(true)
  })
})

describe('StubBillingAdapter (실제 청구 없음)', () => {
  it('체크아웃은 charged:false, success URL 리다이렉트', async () => {
    const a = new StubBillingAdapter()
    const cs = await a.createCheckout({
      tenantId: 't1',
      plan: 'pro',
      successUrl: 'http://localhost:6091/billing/success',
      cancelUrl: 'http://localhost:6091/billing/cancel',
    })
    expect(cs.charged).toBe(false)
    expect(cs.checkoutUrl).toContain('stub_session=')
    expect(cs.sessionId.startsWith('cs_test_')).toBe(true)
  })

  it('구독 생성·조회·취소', async () => {
    const a = new StubBillingAdapter()
    expect((await a.getSubscription('t1')).status).toBe('none')
    await a.createCheckout({
      tenantId: 't1',
      plan: 'pro',
      successUrl: 'x',
      cancelUrl: 'y',
    })
    const sub = await a.getSubscription('t1')
    expect(sub.plan).toBe('pro')
    expect(sub.status).toBe('active')
    const canceled = await a.cancel('t1')
    expect(canceled.plan).toBe('free')
    expect(canceled.status).toBe('canceled')
  })
})
