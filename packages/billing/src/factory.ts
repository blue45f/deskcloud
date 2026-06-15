import { type Plan } from '@desk/shared'

import type { BillingAdapter, BillingProvider } from './adapter'
import { planFeatures } from './limits'
import { StripeBillingAdapter } from './stripe-adapter'
import { StubBillingAdapter } from './stub-adapter'
import { TossBillingAdapter } from './toss-adapter'

/**
 * 환경 설정으로 결제 어댑터를 고른다 — 모두 **TEST/STUB 전용**.
 * 기본은 stub. DESK_BILLING_PROVIDER=toss|stripe 면 해당 TEST 어댑터(플레이스홀더 키).
 */
export function createBillingAdapter(provider: BillingProvider): BillingAdapter {
  switch (provider) {
    case 'toss':
      return new TossBillingAdapter({ testSecretKey: process.env.TOSS_TEST_SECRET_KEY })
    case 'stripe':
      return new StripeBillingAdapter({ testSecretKey: process.env.STRIPE_TEST_SECRET_KEY })
    case 'stub':
    default:
      return new StubBillingAdapter()
  }
}

/**
 * 'Powered by DeskCloud' 배지를 노출해야 하는지 — Free 는 노출(true), 유료(removeBranding)는 숨김.
 * vendor/PoweredByDeskCloud 와 짝. (배지 제거 = 유료 특전 → 업셀 레버.)
 */
export function shouldShowBadge(plan: Plan): boolean {
  return !planFeatures(plan).removeBranding
}
