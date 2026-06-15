import type {
  CheckoutResponseDto,
  PlanSummaryDto,
  SubscriptionDto,
} from '@desk/shared/browser'

/** API 베이스 — Vite 빌드 타임 주입(VITE_API_BASE_URL), 기본 :6090. */
const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:6090'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await res.json())
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail}` : ''}`)
  }
  return res.json() as Promise<T>
}

/** 공개 가격표. */
export function fetchPlans(): Promise<PlanSummaryDto[]> {
  return fetch(`${BASE}/api/billing/plans`).then((r) => json<PlanSummaryDto[]>(r))
}

/** 내 구독(secret 키). */
export function fetchSubscription(sk: string): Promise<SubscriptionDto> {
  return fetch(`${BASE}/api/billing/subscription`, {
    headers: { authorization: `Bearer ${sk}` },
  }).then((r) => json<SubscriptionDto>(r))
}

/** 체크아웃 시작(secret 키) — 스텁 checkoutUrl 반환. */
export function startCheckout(sk: string, plan: string): Promise<CheckoutResponseDto> {
  return fetch(`${BASE}/api/billing/checkout`, {
    method: 'POST',
    headers: { authorization: `Bearer ${sk}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan }),
  }).then((r) => json<CheckoutResponseDto>(r))
}

/** 구독 취소(secret 키). */
export function cancelSubscription(sk: string): Promise<SubscriptionDto> {
  return fetch(`${BASE}/api/billing/cancel`, {
    method: 'POST',
    headers: { authorization: `Bearer ${sk}` },
  }).then((r) => json<SubscriptionDto>(r))
}
