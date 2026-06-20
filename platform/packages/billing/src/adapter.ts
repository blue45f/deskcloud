import type { SubscriptionEvent } from './subscription'
import type { Plan } from '@desk/shared'

/**
 * 결제 어댑터 포트 — 빌링 제공자(Toss/Stripe) 추상화. **TEST/STUB 전용**.
 * 실제 시크릿 키·실제 자금 이동 절대 없음. 어댑터는 결제 "결정"만 반환하고
 * 실제 청구는 하지 않는다(플랫폼 정책: money-movement boundary).
 */

export type BillingProvider = 'stub' | 'toss' | 'stripe'

/** 체크아웃 세션 생성 입력. */
export interface CheckoutRequest {
  tenantId: string
  plan: Plan
  /** 결제 후 돌아올 URL. */
  successUrl: string
  cancelUrl: string
}

/** 체크아웃 세션 — 호스티드 결제 페이지로 보낼 정보(스텁은 가짜 URL). */
export interface CheckoutSession {
  provider: BillingProvider
  sessionId: string
  /** 결제 페이지 URL(스텁은 즉시 success 로 리다이렉트되는 가짜 URL). */
  checkoutUrl: string
  plan: Plan
  /** 실제 청구 여부 — 스텁/테스트는 항상 false. */
  charged: false
}

/** 구독 상태(요약). */
export interface SubscriptionStatus {
  tenantId: string
  plan: Plan
  status: 'active' | 'canceled' | 'none'
  provider: BillingProvider
}

/**
 * 제공자 웹훅을 검증·정규화한 결과 — 우리 도메인 이벤트로 변환된 형태.
 * 어떤 제공자든 이 공통 형태로 매핑되어 SubscriptionService 가 상태 머신에 적용한다.
 */
export interface NormalizedWebhookEvent {
  provider: BillingProvider
  /** 우리 도메인 구독 이벤트(상태 머신 입력). */
  event: SubscriptionEvent
  tenantId: string
  /** activated 류 이벤트의 대상 플랜. */
  plan?: Plan
  providerSubscriptionId?: string | null
  periodEnd?: string | null
  /** 원본 제공자 이벤트 타입(감사/로깅용). */
  rawType: string
}

/** 웹훅 검증 입력 — 원시 바디 + 헤더(서명). */
export interface WebhookVerifyInput {
  /** 원시 요청 바디(문자열). */
  rawBody: string
  /** 요청 헤더(서명 헤더 포함). */
  headers: Record<string, string | undefined>
}

/** 결제 어댑터 인터페이스. */
export interface BillingAdapter {
  readonly provider: BillingProvider
  /** 체크아웃 세션 생성(결제 페이지로 보낼 정보 반환). 실제 청구 없음. */
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>
  /** 구독 상태 조회. */
  getSubscription(tenantId: string): Promise<SubscriptionStatus>
  /** 구독 취소(다음 갱신부터 free 로). */
  cancel(tenantId: string): Promise<SubscriptionStatus>
  /**
   * 웹훅 검증(STUB) — 서명 검증을 모사하고, 통과 시 정규화된 도메인 이벤트를 반환.
   * 검증 실패면 null(컨트롤러는 400). 실제 서명 시크릿 없음(TEST 모드).
   */
  verifyWebhook(input: WebhookVerifyInput): NormalizedWebhookEvent | null
}
