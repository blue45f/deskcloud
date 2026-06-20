import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

const TONE: Record<string, string> = {
  default: 'text-text',
  accent: 'text-accent-strong',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

/** 작은 지표 카드 — 라벨 + 큰 값 + 보조 힌트. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: keyof typeof TONE
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <p className="text-[0.6875rem] font-medium tracking-wide text-text-subtle uppercase">
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', TONE[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-text-muted">{hint}</p> : null}
    </div>
  )
}
