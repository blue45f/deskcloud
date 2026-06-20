import { cva, type VariantProps } from 'class-variance-authority'

import type { Plan, ReviewStatus } from '@reviewdesk/shared'
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

// ── 리뷰 검수 상태 ──
const STATUS_META: Record<ReviewStatus, { label: string; tone: BadgeProps['tone']; dot: boolean }> =
  {
    pending: { label: '대기', tone: 'warning', dot: true },
    approved: { label: '승인', tone: 'success', dot: true },
    rejected: { label: '거절', tone: 'danger', dot: false },
  }

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: ReviewStatus
  size?: BadgeProps['size']
}) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot={meta.dot}>
      {meta.label}
    </Badge>
  )
}

// ── 추천(featured) 칩 ──
export function FeaturedBadge({ size = 'sm' }: { size?: BadgeProps['size'] }) {
  return (
    <Badge tone="accent" size={size}>
      추천
    </Badge>
  )
}

// ── 요금제 ──
const PLAN_META: Record<Plan, { label: string; tone: BadgeProps['tone'] }> = {
  free: { label: 'Free', tone: 'neutral' },
  pro: { label: 'Pro', tone: 'info' },
  scale: { label: 'Scale', tone: 'accent' },
}

export function PlanBadge({ plan, size = 'md' }: { plan: Plan; size?: BadgeProps['size'] }) {
  const meta = PLAN_META[plan]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}
