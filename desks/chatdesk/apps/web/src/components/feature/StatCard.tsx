import { useId, type ComponentType, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

/**
 * 대시보드 상단 요약 지표 카드. 큰 수치 + 라벨 + 보조 설명.
 *
 * 접근성: 카드는 `role="group"` 으로 자기 라벨(지표 이름)을 가진다. 수치는 색만으로 의미를
 * 전달하지 않도록 텍스트(라벨·hint)로도 맥락을 준다. 아이콘은 장식이므로 aria-hidden.
 * `srValue` 를 주면 스크린리더에 읽힐 수치 텍스트를 명시할 수 있다(예: 단위 포함).
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
  className,
  srValue,
}: {
  icon?: ComponentType<{ className?: string }>
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'info' | 'warning' | 'danger'
  className?: string
  /** 스크린리더용 수치 텍스트(미지정 시 시각 value 를 그대로 읽음). */
  srValue?: string
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
      <p
        className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums', toneText[tone])}
        {...(srValue ? { 'aria-label': srValue } : {})}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-subtle">{hint}</p> : null}
    </div>
  )
}
