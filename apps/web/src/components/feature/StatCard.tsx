import { useId, type ComponentType, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

/**
 * 대시보드 상단 요약 지표 카드. 큰 수치 + 라벨 + 보조 설명.
 *
 * a11y: 각 카드는 라벨이 붙은 그룹(`role="group"` + `aria-labelledby`)이다. 수치는 색이 아니라
 * 라벨·숫자 텍스트로 의미가 전달되며(색은 보조 강조), 아이콘은 `aria-hidden`.
 */
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
  const labelId = useId()
  const toneText: Record<NonNullable<typeof tone>, string> = {
    neutral: 'text-text',
    accent: 'text-accent-strong',
    success: 'text-success',
    info: 'text-info',
    warning: 'text-warning',
    danger: 'text-danger',
  }
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn('rounded-lg border border-border bg-surface p-5', className)}
    >
      <div className="flex items-center gap-2 text-text-subtle">
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        <span id={labelId} className="text-xs font-medium">
          {label}
        </span>
      </div>
      <p className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums', toneText[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-subtle">{hint}</p> : null}
    </div>
  )
}
