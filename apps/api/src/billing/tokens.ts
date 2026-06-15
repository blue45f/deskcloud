import type { BillingProvider, Subscription } from '@desk/billing'

/** 구독 스토어 DI 토큰. */
export const SUBSCRIPTION_STORE = Symbol('SUBSCRIPTION_STORE')

/** 빌링 서비스가 의존하는 구독 영속화 포트(테스트는 인메모리 구현 주입). */
export interface SubscriptionStorePort {
  find(tenantId: string): Promise<Subscription | null>
  getOrCreate(tenantId: string, provider: BillingProvider): Promise<Subscription>
  save(sub: Subscription): Promise<Subscription>
}
