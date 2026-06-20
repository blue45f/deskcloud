import { type Channel, type NotificationStatus, type Plan } from '@notifydesk/shared'
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

// ── 채널 ──
const CHANNEL_META: Record<Channel, { label: string; tone: BadgeProps['tone'] }> = {
  in_app: { label: 'in-app', tone: 'accent' },
  email: { label: 'email', tone: 'info' },
  web_push: { label: 'web-push', tone: 'warning' },
}

export function ChannelBadge({ channel, size = 'sm' }: { channel: Channel; size?: BadgeProps['size'] }) {
  const meta = CHANNEL_META[channel]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

// ── 알림 상태 ──
const STATUS_META: Record<NotificationStatus, { label: string; tone: BadgeProps['tone'] }> = {
  queued: { label: '대기', tone: 'neutral' },
  sent: { label: '미읽음', tone: 'accent' },
  read: { label: '읽음', tone: 'neutral' },
}

export function StatusBadge({ status }: { status: NotificationStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} size="sm" dot={status === 'sent'}>
      {meta.label}
    </Badge>
  )
}

// ── 요금제 ──
export function PlanBadge({ plan }: { plan: Plan }) {
  return plan === 'pro' ? (
    <Badge tone="accent" dot>
      Pro
    </Badge>
  ) : (
    <Badge tone="neutral">Free</Badge>
  )
}
