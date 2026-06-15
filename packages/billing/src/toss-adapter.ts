import { randomUUID } from 'node:crypto'

import { type Plan } from '@desk/shared'

import type {
  BillingAdapter,
  CheckoutRequest,
  CheckoutSession,
  NormalizedWebhookEvent,
  SubscriptionStatus,
  WebhookVerifyInput,
} from './adapter'
import { verifyStubSignature } from './stub-adapter'

/**
 * Toss Payments 어댑터 — **TEST/STUB 전용**. 실제 Toss API·시크릿 키 절대 호출 안 함.
 * 실제 연동 시 이 자리에서 `@tosspayments/payment-sdk` 빌링키/자동결제를 호출하지만,
 * 지금은 환경의 플레이스홀더 키만 읽고 가짜 체크아웃 URL·인메모리 구독만 다룬다.
 */
export interface TossAdapterOptions {
  /** TEST 시크릿 키(플레이스홀더). 'test_sk_…' 가 아니면 거부(실키 사고 방지). */
  testSecretKey?: string
  /** 웹훅 서명 헤더 검증값(스텁). */
  webhookSecret?: string
  /** 체크아웃 베이스 URL(가짜). */
  checkoutBase?: string
}

export class TossBillingAdapter implements BillingAdapter {
  readonly provider = 'toss' as const
  private readonly subs = new Map<string, Plan>()
  private readonly opts: Required<TossAdapterOptions>

  constructor(options: TossAdapterOptions = {}) {
    const testSecretKey = options.testSecretKey ?? 'test_sk_toss_placeholder'
    // 안전장치: live 키('live_…') 차단. TEST 모드만 허용.
    if (!testSecretKey.startsWith('test_')) {
      throw new Error('TossBillingAdapter 는 TEST 키만 허용합니다(test_…). 실제 키 금지.')
    }
    this.opts = {
      testSecretKey,
      webhookSecret: options.webhookSecret ?? 'toss-stub-ok',
      checkoutBase: options.checkoutBase ?? 'https://test.tosspayments.test/checkout',
    }
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const sessionId = `toss_test_${randomUUID()}`
    this.subs.set(req.tenantId, req.plan)
    const url = new URL(this.opts.checkoutBase)
    url.searchParams.set('sessionId', sessionId)
    url.searchParams.set('successUrl', req.successUrl)
    url.searchParams.set('cancelUrl', req.cancelUrl)
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

  /** Toss 웹훅 검증(STUB) — 헤더 `x-toss-signature` 매칭 후 정규화. */
  verifyWebhook(input: WebhookVerifyInput): NormalizedWebhookEvent | null {
    return verifyStubSignature(input, 'x-toss-signature', this.opts.webhookSecret, this.provider)
  }
}
