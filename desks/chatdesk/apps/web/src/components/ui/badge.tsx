import { type ConversationKind, type Plan } from '@chatdesk/shared'
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

// ── 대화 종류 (DM / 그룹) ──
const KIND_META: Record<ConversationKind, { label: string; tone: BadgeProps['tone'] }> = {
  dm: { label: '1:1 DM', tone: 'info' },
  group: { label: '그룹', tone: 'accent' },
}

export function ConversationKindBadge({
  kind,
  size = 'sm',
}: {
  kind: ConversationKind
  size?: BadgeProps['size']
}) {
  const meta = KIND_META[kind]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

// ── 요금제 (free / pro) ──
const PLAN_META: Record<Plan, { label: string; tone: BadgeProps['tone'] }> = {
  free: { label: 'Free', tone: 'neutral' },
  pro: { label: 'Pro', tone: 'success' },
}

export function PlanBadge({ plan, size = 'sm' }: { plan: Plan; size?: BadgeProps['size'] }) {
  const meta = PLAN_META[plan]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

// ── 온라인 상태 ──
export function OnlinePill({ count }: { count: number }) {
  return count > 0 ? (
    <Badge tone="success" dot size="sm">
      온라인 {count}
    </Badge>
  ) : (
    <Badge tone="neutral" size="sm">
      오프라인
    </Badge>
  )
}
