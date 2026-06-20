import { describe, expect, it } from 'vitest'

import { createBillingAdapter, shouldShowBadge } from './factory'
import { StripeBillingAdapter, stripePriceIdForPlan } from './stripe-adapter'
import { StubBillingAdapter, normalizeEvent } from './stub-adapter'
import { TossBillingAdapter } from './toss-adapter'

import type { BillingAdapter } from './adapter'

const ADAPTERS: { name: string; make: () => BillingAdapter; sigHeader: string; sig: string }[] = [
  {
    name: 'stub',
    make: () => new StubBillingAdapter(),
    sigHeader: 'x-stub-signature',
    sig: 'stub-ok',
  },
  {
    name: 'toss',
    make: () => new TossBillingAdapter(),
    sigHeader: 'x-toss-signature',
    sig: 'toss-stub-ok',
  },
  {
    name: 'stripe',
    make: () => new StripeBillingAdapter(),
    sigHeader: 'stripe-signature',
    sig: 'whsec_stub_ok',
  },
]

describe.each(ADAPTERS)('$name 어댑터 (TEST/STUB, 실제 청구 없음)', ({ make, sigHeader, sig }) => {
  it('체크아웃은 charged:false + 유효한 checkoutUrl', async () => {
    const a = make()
    const cs = await a.createCheckout({
      tenantId: 't1',
      plan: 'pro',
      successUrl: 'http://localhost:6091/billing?ok=1',
      cancelUrl: 'http://localhost:6091/billing?cancel=1',
    })
    expect(cs.charged).toBe(false)
    expect(cs.plan).toBe('pro')
    expect(cs.checkoutUrl).toMatch(/^https?:\/\//)
    expect(cs.sessionId).toBeTruthy()
  })

  it('구독 생성→조회→취소', async () => {
    const a = make()
    expect((await a.getSubscription('t1')).status).toBe('none')
    await a.createCheckout({ tenantId: 't1', plan: 'pro', successUrl: 'x', cancelUrl: 'y' })
    expect((await a.getSubscription('t1')).status).toBe('active')
    const canceled = await a.cancel('t1')
    expect(canceled.plan).toBe('free')
    expect(canceled.status).toBe('canceled')
  })

  it('웹훅 검증 — 올바른 서명이면 정규화 이벤트, 틀리면 null', () => {
    const a = make()
    const body = JSON.stringify({ type: 'subscription.activated', tenantId: 't1', plan: 'pro' })
    const ok = a.verifyWebhook({ rawBody: body, headers: { [sigHeader]: sig } })
    expect(ok).not.toBeNull()
    expect(ok!.event).toBe('activated')
    expect(ok!.tenantId).toBe('t1')
    expect(ok!.plan).toBe('pro')

    const bad = a.verifyWebhook({ rawBody: body, headers: { [sigHeader]: 'wrong' } })
    expect(bad).toBeNull()
  })
})

describe('실키 차단(안전장치)', () => {
  it('Toss live 키는 거부', () => {
    expect(() => new TossBillingAdapter({ testSecretKey: 'live_sk_real' })).toThrow()
  })
  it('Stripe live 키는 거부', () => {
    expect(() => new StripeBillingAdapter({ testSecretKey: 'sk_live_real' })).toThrow()
  })
  it('Stripe TEST 키는 허용', () => {
    expect(() => new StripeBillingAdapter({ testSecretKey: 'sk_test_ok' })).not.toThrow()
  })
})

describe('normalizeEvent — 제공자 타입 매핑', () => {
  it('Stripe customer.subscription.deleted → canceled', () => {
    const ev = normalizeEvent({ type: 'customer.subscription.deleted', tenantId: 't1' }, 'stripe')
    expect(ev!.event).toBe('canceled')
  })
  it('Toss PAYMENT_CONFIRMED → activated', () => {
    const ev = normalizeEvent({ type: 'PAYMENT_CONFIRMED', tenantId: 't1', plan: 'scale' }, 'toss')
    expect(ev!.event).toBe('activated')
    expect(ev!.plan).toBe('scale')
  })
  it('알 수 없는 타입/누락 tenantId → null', () => {
    expect(normalizeEvent({ type: 'nope', tenantId: 't1' }, 'stub')).toBeNull()
    expect(normalizeEvent({ type: 'subscription.activated' }, 'stub')).toBeNull()
  })
})

describe('createBillingAdapter 팩토리', () => {
  it('provider 별 어댑터 생성', () => {
    expect(createBillingAdapter('stub').provider).toBe('stub')
    expect(createBillingAdapter('toss').provider).toBe('toss')
    expect(createBillingAdapter('stripe').provider).toBe('stripe')
  })
})

describe('shouldShowBadge', () => {
  it('Free 는 배지 노출, 유료는 숨김', () => {
    expect(shouldShowBadge('free')).toBe(true)
    expect(shouldShowBadge('pro')).toBe(false)
    expect(shouldShowBadge('scale')).toBe(false)
    expect(shouldShowBadge('enterprise')).toBe(false)
  })
})

describe('stripePriceIdForPlan', () => {
  it('플랜별 가짜 price id', () => {
    expect(stripePriceIdForPlan('pro')).toBe('price_test_pro')
  })
})
