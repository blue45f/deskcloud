import { z } from 'zod'

import { PLANS, type Plan } from './constants'

/**
 * 빌링 공유 계약(Zod) — apps/api 와 apps/web 가 공유. 결제 자체는 @desk/billing 이 담당하고,
 * 여기서는 HTTP 경계의 입력/출력 모양만 정의한다.
 */

/** 체크아웃 시작 입력 — 대상 플랜 + (선택) 리다이렉트 URL. */
export const checkoutSchema = z.object({
  plan: z.enum(PLANS),
  successUrl: z.string().url().max(2048).optional(),
  cancelUrl: z.string().url().max(2048).optional(),
})
export type CheckoutInput = z.infer<typeof checkoutSchema>

/** 공개 가격표의 단일 플랜 항목. */
export interface PlanSummaryDto {
  plan: Plan
  label: string
  priceKrwMonthly: number
  priceUsdCentsMonthly: number
  /** 메트릭 키 → 한도(-1=무제한). */
  limits: Record<string, number>
  features: {
    removeBranding: boolean
    customDomain: boolean
    webhooks: boolean
  }
}

/** 체크아웃 응답 — 결제 페이지로 보낼 URL(스텁은 가짜). */
export interface CheckoutResponseDto {
  checkoutUrl: string
  sessionId: string
  plan: Plan
  provider: string
  /** 실제 청구 여부 — 항상 false(TEST/STUB). */
  charged: boolean
}

/** 구독 상태 응답. */
export interface SubscriptionDto {
  tenantId: string
  plan: Plan
  status: string
  provider: string
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  /** 'Powered by DeskCloud' 배지 노출 여부(Free=true). */
  showBadge: boolean
}
