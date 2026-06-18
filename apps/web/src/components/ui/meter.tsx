import { UNLIMITED } from '@desk/shared/browser'

import { cn } from '@/utils/cn'
import { usageRatio } from '@/utils/format'

/**
 * 사용량-한도 게이지(미터) — accessible(role=meter, aria-value*).
 * 80% 이상이면 warning, 100% 이상이면 danger 색으로 전환.
 */
export function Meter({
  label,
  used,
  limit,
  unit,
  format,
}: {
  label: string
  used: number
  limit: number
  unit?: string
  /** 숫자 포맷터(천단위 등). 없으면 toLocaleString. */
  format?: (n: number) => string
}) {
  const unlimited = limit === UNLIMITED
  const ratio = usageRatio(used, limit)
  const pct = Math.round(ratio * 100)
  const fmt = format ?? ((n: number) => n.toLocaleString('ko-KR'))

  const tone = unlimited
    ? 'bg-success'
    : ratio >= 1
      ? 'bg-danger'
      : ratio >= 0.8
        ? 'bg-warning'
        : 'bg-accent'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] font-medium text-text">{label}</span>
        <span className="font-mono text-xs text-text-muted">
          {fmt(used)}
          {unit ? ` ${unit}` : ''} /{' '}
          {unlimited ? '무제한' : `${fmt(limit)}${unit ? ` ${unit}` : ''}`}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={`${label} 사용량`}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : limit}
        aria-valuenow={used}
        aria-valuetext={unlimited ? `${fmt(used)} (무제한)` : `${pct}% 사용`}
      >
        <div
          className={cn('h-full origin-left rounded-full transition-[width] duration-500', tone)}
          style={{ width: unlimited ? '12%' : `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
      {!unlimited && (
        <p
          className={cn(
            'mt-1 text-[0.6875rem]',
            ratio >= 1 ? 'text-danger' : ratio >= 0.8 ? 'text-warning' : 'text-text-subtle'
          )}
        >
          {ratio >= 1 ? '한도 초과 — 업그레이드 필요' : `${pct}% 사용 중`}
        </p>
      )}
    </div>
  )
}
