import type { ComponentType, ReactNode } from 'react'

import { cn } from '@/utils/cn'

const TONES = {
  default: 'text-text',
  accent: 'text-accent-strong',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
} as const

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: keyof typeof TONES
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-medium text-text-muted">{label}</p>
        {Icon ? <Icon className="size-4 text-text-subtle" aria-hidden /> : null}
      </div>
      <p className={cn('mt-2 font-mono text-2xl font-semibold tracking-tight', TONES[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-subtle">{hint}</p> : null}
    </div>
  )
}
