import { cva, type VariantProps } from 'class-variance-authority'

import type { Plan } from '@realtimedesk/shared'
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

// ── 연결 상태 ──
export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

const STATUS_META: Record<LiveStatus, { label: string; tone: BadgeProps['tone']; dot: boolean }> = {
  connected: { label: 'LIVE', tone: 'success', dot: true },
  connecting: { label: '연결 중', tone: 'warning', dot: true },
  disconnected: { label: '오프라인', tone: 'neutral', dot: true },
  error: { label: '오류', tone: 'danger', dot: true },
  idle: { label: '대기', tone: 'neutral', dot: false },
}

export function StatusBadge({ status, size = 'sm' }: { status: LiveStatus; size?: BadgeProps['size'] }) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot={meta.dot}>
      {meta.label}
    </Badge>
  )
}

// ── 요금제 ──
const PLAN_META: Record<Plan, { label: string; tone: BadgeProps['tone'] }> = {
  free: { label: 'Free', tone: 'neutral' },
  pro: { label: 'Pro', tone: 'accent' },
}

export function PlanBadge({ plan, size = 'sm' }: { plan: Plan; size?: BadgeProps['size'] }) {
  const meta = PLAN_META[plan]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}
