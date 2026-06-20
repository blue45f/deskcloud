import { cva, type VariantProps } from 'class-variance-authority'

import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-2 text-text-muted',
        accent: 'border-transparent bg-accent-soft text-accent-fg',
        success: 'border-transparent bg-success-soft text-success',
        info: 'border-transparent bg-info-soft text-info',
        warning: 'border-transparent bg-warning-soft text-warning',
        danger: 'border-transparent bg-danger-soft text-danger',
        outline: 'border-border text-text-muted',
      },
      size: {
        sm: 'px-2 py-0.5 text-[0.6875rem]',
        md: 'px-2.5 py-0.5 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  }
)

export interface BadgeProps extends VariantProps<typeof badge> {
  children: ReactNode
  className?: string
  dot?: boolean
}

export function Badge({ children, tone, size, dot = false, className }: BadgeProps) {
  return (
    <span className={cn(badge({ tone, size }), className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  )
}

/** 플랜 칩 — free=neutral, pro=accent, scale=info, enterprise=warning. */
const PLAN_TONE: Record<string, BadgeProps['tone']> = {
  free: 'neutral',
  pro: 'accent',
  scale: 'info',
  enterprise: 'warning',
}

export function PlanBadge({ plan, size }: { plan: string; size?: BadgeProps['size'] }) {
  return (
    <Badge tone={PLAN_TONE[plan] ?? 'neutral'} size={size}>
      {plan.toUpperCase()}
    </Badge>
  )
}

/** 구독 상태 칩. */
const STATUS_META: Record<string, { label: string; tone: BadgeProps['tone'] }> = {
  active: { label: '활성', tone: 'success' },
  trialing: { label: '체험', tone: 'info' },
  incomplete: { label: '대기(체크아웃)', tone: 'warning' },
  past_due: { label: '연체', tone: 'warning' },
  canceled: { label: '취소됨', tone: 'neutral' },
  none: { label: '미구독', tone: 'neutral' },
}

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <Badge tone={meta.tone} dot={meta.tone === 'success'}>
      {meta.label}
    </Badge>
  )
}
