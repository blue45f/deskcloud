import { randomUUID } from 'node:crypto'

import { PLANS, type Plan } from '@desk/shared'

import type {
  BillingAdapter,
  CheckoutRequest,
  CheckoutSession,
  NormalizedWebhookEvent,
  SubscriptionStatus,
  WebhookVerifyInput,
} from './adapter'
import type { SubscriptionEvent } from './subscription'

/**
 * 스텁 결제 어댑터 — 인메모리 가짜 결제. **실제 청구 절대 없음**.
 * 체크아웃은 successUrl 로 즉시 리다이렉트되는 가짜 URL 을 만들고, 구독 상태를 메모리에 기록한다.
 * Toss/Stripe 어댑터도 동일 인터페이스를 TEST 모드로만 구현한다.
 */
export class StubBillingAdapter implements BillingAdapter {
  readonly provider = 'stub' as const
  private readonly subs = new Map<string, Plan>()

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const sessionId = `cs_test_${randomUUID()}`
    // 스텁은 결제 성공을 가정하고 구독을 즉시 활성으로 기록(테스트 편의).
    this.subs.set(req.tenantId, req.plan)
    // success URL 에 가짜 세션 토큰을 붙여 "결제 완료" 흐름을 모사.
    const sep = req.successUrl.includes('?') ? '&' : '?'
    return {
      provider: this.provider,
      sessionId,
      checkoutUrl: `${req.successUrl}${sep}stub_session=${sessionId}`,
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

  /**
   * 웹훅 검증(STUB) — 서명 헤더 `x-stub-signature: stub-ok` 를 요구(실패면 null).
   * 바디는 JSON `{ type, tenantId, plan?, subscriptionId?, periodEnd? }`.
   */
  verifyWebhook(input: WebhookVerifyInput): NormalizedWebhookEvent | null {
    return verifyStubSignature(input, 'x-stub-signature', 'stub-ok', this.provider)
  }
}

/** STUB 서명 검증 + 정규화 — Toss/Stripe 스텁이 공유하는 헬퍼. */
export function verifyStubSignature(
  input: WebhookVerifyInput,
  sigHeader: string,
  expected: string,
  provider: NormalizedWebhookEvent['provider']
): NormalizedWebhookEvent | null {
  const sig = input.headers[sigHeader] ?? input.headers[sigHeader.toLowerCase()]
  if (sig !== expected) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(input.rawBody)
  } catch {
    return null
  }
  return normalizeEvent(parsed, provider)
}

/** 제공자별 원시 타입 → 우리 도메인 이벤트 매핑(공통). */
const TYPE_MAP: Record<string, SubscriptionEvent> = {
  // 공통/스텁
  'subscription.activated': 'activated',
  'subscription.created': 'activated',
  'subscription.updated': 'activated',
  'subscription.canceled': 'canceled',
  'subscription.payment_failed': 'payment_failed',
  'subscription.payment_recovered': 'payment_recovered',
  // Stripe 류
  'customer.subscription.created': 'activated',
  'customer.subscription.updated': 'activated',
  'customer.subscription.deleted': 'canceled',
  'invoice.payment_failed': 'payment_failed',
  'invoice.payment_succeeded': 'payment_recovered',
  // Toss 류(빌링키/자동결제)
  'PAYMENT_CONFIRMED': 'activated',
  'BILLING_APPROVED': 'activated',
  'SUBSCRIPTION_CANCELED': 'canceled',
  'PAYMENT_FAILED': 'payment_failed',
}

function isPlan(v: unknown): v is Plan {
  return typeof v === 'string' && (PLANS as readonly string[]).includes(v)
}

/** 파싱된 바디를 NormalizedWebhookEvent 로(필수 필드 없으면 null). */
export function normalizeEvent(
  body: unknown,
  provider: NormalizedWebhookEvent['provider']
): NormalizedWebhookEvent | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const rawType = typeof b['type'] === 'string' ? (b['type'] as string) : ''
  const event = TYPE_MAP[rawType]
  const tenantId = typeof b['tenantId'] === 'string' ? (b['tenantId'] as string) : ''
  if (!event || !tenantId) return null
  return {
    provider,
    event,
    tenantId,
    plan: isPlan(b['plan']) ? b['plan'] : undefined,
    providerSubscriptionId:
      typeof b['subscriptionId'] === 'string' ? (b['subscriptionId'] as string) : null,
    periodEnd: typeof b['periodEnd'] === 'string' ? (b['periodEnd'] as string) : null,
    rawType,
  }
}
