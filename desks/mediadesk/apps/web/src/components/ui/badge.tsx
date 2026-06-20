import { cva, type VariantProps } from 'class-variance-authority'

import type { Plan } from '@mediadesk/shared'
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

// ── 플랜 칩 ──
export function PlanBadge({ plan, size = 'sm' }: { plan: Plan; size?: BadgeProps['size'] }) {
  return plan === 'pro' ? (
    <Badge tone="accent" size={size} dot>
      Pro
    </Badge>
  ) : (
    <Badge tone="neutral" size={size}>
      Free
    </Badge>
  )
}

// ── 스토리지 드라이버 칩 ──
export function StorageBadge({ driver, size = 'sm' }: { driver: string; size?: BadgeProps['size'] }) {
  const isS3 = driver === 's3'
  return (
    <Badge tone={isS3 ? 'warning' : 'info'} size={size}>
      {isS3 ? 'S3 (스텁)' : 'Local FS'}
    </Badge>
  )
}
