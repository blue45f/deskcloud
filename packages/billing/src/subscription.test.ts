import { describe, expect, it } from 'vitest'

import {
  applyEvent,
  canTransition,
  emptySubscription,
  isSubscriptionActive,
  nextStatus,
  SubscriptionTransitionError,
} from './subscription'

describe('구독 상태 머신', () => {
  it('none → incomplete → active (정상 체크아웃 플로우)', () => {
    expect(nextStatus('none', 'checkout_started')).toBe('incomplete')
    expect(nextStatus('incomplete', 'activated')).toBe('active')
  })

  it('active → past_due → active (결제 실패→복구)', () => {
    expect(nextStatus('active', 'payment_failed')).toBe('past_due')
    expect(nextStatus('past_due', 'payment_recovered')).toBe('active')
  })

  it('active → canceled → active (취소→재활성)', () => {
    expect(nextStatus('active', 'canceled')).toBe('canceled')
    expect(nextStatus('canceled', 'reactivated')).toBe('active')
  })

  it('불가 전이는 throw', () => {
    expect(() => nextStatus('none', 'payment_recovered')).toThrow(SubscriptionTransitionError)
    expect(canTransition('none', 'payment_recovered')).toBe(false)
    expect(canTransition('active', 'canceled')).toBe(true)
  })

  it('past_due 는 활성 취급', () => {
    expect(isSubscriptionActive('active')).toBe(true)
    expect(isSubscriptionActive('past_due')).toBe(true)
    expect(isSubscriptionActive('canceled')).toBe(false)
    expect(isSubscriptionActive('none')).toBe(false)
  })
})

describe('applyEvent (순수 함수)', () => {
  it('activated 시 plan 승급 + active', () => {
    const sub = emptySubscription('t1', 'stub')
    const after = applyEvent(applyEvent(sub, { event: 'checkout_started', plan: 'pro' }), {
      event: 'activated',
      plan: 'pro',
      providerSubscriptionId: 'sub_123',
      periodEnd: '2026-07-15',
    })
    expect(after.status).toBe('active')
    expect(after.plan).toBe('pro')
    expect(after.providerSubscriptionId).toBe('sub_123')
    expect(after.periodEnd).toBe('2026-07-15')
  })

  it('canceled 시 Free 복귀 + cancelAtPeriodEnd', () => {
    let sub = emptySubscription('t1', 'stub')
    sub = applyEvent(sub, { event: 'activated', plan: 'scale' })
    expect(sub.plan).toBe('scale')
    const canceled = applyEvent(sub, { event: 'canceled' })
    expect(canceled.status).toBe('canceled')
    expect(canceled.plan).toBe('free')
    expect(canceled.cancelAtPeriodEnd).toBe(true)
  })

  it('원본 불변(순수)', () => {
    const sub = emptySubscription('t1', 'stub')
    applyEvent(sub, { event: 'activated', plan: 'pro' })
    expect(sub.status).toBe('none')
    expect(sub.plan).toBe('free')
  })

  it('웹훅이 none 에서 바로 활성화 가능(incomplete 스킵)', () => {
    const sub = emptySubscription('t1', 'stripe')
    const after = applyEvent(sub, { event: 'activated', plan: 'pro' })
    expect(after.status).toBe('active')
    expect(after.plan).toBe('pro')
  })
})
