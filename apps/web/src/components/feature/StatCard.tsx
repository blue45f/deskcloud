import type { ComponentType, ReactNode } from 'react'

import { cn } from '@/utils/cn'

/** 대시보드 상단 요약 지표 카드. 큰 수치 + 라벨 + 보조 설명. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'info' | 'warning' | 'danger'
  className?: string
}) {
  const toneText: Record<NonNullable<typeof tone>, string> = {
    neutral: 'text-text',
    accent: 'text-accent-strong',
    success: 'text-success',
    info: 'text-info',
    warning: 'text-warning',
    danger: 'text-danger',
  }
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5', className)}>
      <div className="flex items-center gap-2 text-text-subtle">
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums', toneText[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-subtle">{hint}</p> : null}
    </div>
  )
}
