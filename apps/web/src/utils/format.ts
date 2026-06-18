import { UNLIMITED } from '@desk/shared/browser'

/** -1(UNLIMITED)은 '무제한', 그 외는 천단위 콤마(ko-KR). */
export function fmtNum(n: number): string {
  return n === UNLIMITED ? '무제한' : n.toLocaleString('ko-KR')
}

/** MiB 한도 → 사람이 읽는 단위(GiB/MiB). UNLIMITED 는 '무제한'. */
export function fmtStorage(mib: number): string {
  if (mib === UNLIMITED) return '무제한'
  if (mib >= 1024) return `${(mib / 1024).toLocaleString('ko-KR')} GiB`
  return `${mib.toLocaleString('ko-KR')} MiB`
}

/** 월 가격(KRW) — 0=무료, enterprise=문의. */
export function fmtPriceKrw(plan: string, krw: number): string {
  if (plan === 'enterprise') return '문의'
  if (krw === 0) return '₩0'
  return `₩${krw.toLocaleString('ko-KR')}`
}

/** USD 센트 → '$19' 같은 표시(월). enterprise=Custom. */
export function fmtPriceUsd(plan: string, cents: number): string {
  if (plan === 'enterprise') return 'Custom'
  if (cents === 0) return '$0'
  return `$${(cents / 100).toLocaleString('en-US')}`
}

/** ISO → YYYY-MM-DD(없으면 '—'). */
export function fmtDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '—'
}

/** 사용률(0~1) — limit 이 UNLIMITED 면 0(게이지는 비움). */
export function usageRatio(used: number, limit: number): number {
  if (limit === UNLIMITED || limit <= 0) return 0
  return Math.min(1, used / limit)
}
