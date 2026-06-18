import { randomUUID } from 'node:crypto'

import { type Plan } from '@desk/shared'

import { verifyStubSignature } from './stub-adapter'

import type {
  BillingAdapter,
  CheckoutRequest,
  CheckoutSession,
  NormalizedWebhookEvent,
  SubscriptionStatus,
  WebhookVerifyInput,
} from './adapter'

/**
 * Stripe 어댑터 — **TEST/STUB 전용**. 실제 Stripe API·시크릿 키 절대 호출 안 함.
 * 실제 연동 시 `stripe.checkout.sessions.create` / `stripe.webhooks.constructEvent` 를 쓰지만,
 * 지금은 플레이스홀더 키만 읽고 가짜 체크아웃 URL·인메모리 구독만 다룬다.
 */
export interface StripeAdapterOptions {
  /** TEST 시크릿 키(플레이스홀더). 'sk_test_…' 가 아니면 거부(실키 사고 방지). */
  testSecretKey?: string
  /** 웹훅 서명 시크릿(스텁). */
  webhookSecret?: string
  /** 체크아웃 베이스 URL(가짜). */
  checkoutBase?: string
}

export class StripeBillingAdapter implements BillingAdapter {
  readonly provider = 'stripe' as const
  private readonly subs = new Map<string, Plan>()
  private readonly opts: Required<StripeAdapterOptions>

  constructor(options: StripeAdapterOptions = {}) {
    const testSecretKey = options.testSecretKey ?? 'sk_test_stripe_placeholder'
    // 안전장치: live 키('sk_live_…') 차단. TEST 모드만 허용.
    if (!testSecretKey.startsWith('sk_test_')) {
      throw new Error('StripeBillingAdapter 는 TEST 키만 허용합니다(sk_test_…). 실제 키 금지.')
    }
    this.opts = {
      testSecretKey,
      webhookSecret: options.webhookSecret ?? 'whsec_stub_ok',
      checkoutBase: options.checkoutBase ?? 'https://checkout.stripe.test/pay',
    }
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const sessionId = `cs_test_${randomUUID()}`
    this.subs.set(req.tenantId, req.plan)
    const url = new URL(`${this.opts.checkoutBase}/${sessionId}`)
    url.searchParams.set('success_url', req.successUrl)
    url.searchParams.set('cancel_url', req.cancelUrl)
    url.searchParams.set('plan', req.plan)
    return {
      provider: this.provider,
      sessionId,
      checkoutUrl: url.toString(),
      plan: req.plan,
      charged: false,
    }
  }

  async getSubscription(tenantId: string): Promise<SubscriptionStatus> {
    const plan = this.subs.get(tenantId)
    return {
      tenantId,
      plan: plan ?? 'free',
      status: plan && plan !== 'free' ? 'active' : 'none',
      provider: this.provider,
    }
  }

  async cancel(tenantId: string): Promise<SubscriptionStatus> {
    this.subs.delete(tenantId)
    return { tenantId, plan: 'free', status: 'canceled', provider: this.provider }
  }

  /** Stripe 웹훅 검증(STUB) — 헤더 `stripe-signature` 매칭 후 정규화. */
  verifyWebhook(input: WebhookVerifyInput): NormalizedWebhookEvent | null {
    return verifyStubSignature(input, 'stripe-signature', this.opts.webhookSecret, this.provider)
  }
}

/** 플랜을 가짜 Stripe Price ID 로 매핑(연동 시 실제 price_… 로 교체). */
export function stripePriceIdForPlan(plan: Plan): string {
  return `price_test_${plan}`
}
