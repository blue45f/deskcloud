import { type EntryTag, type Plan } from '@changelogdesk/shared'
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

// ── 게시 상태 ──
export function PublishPill({ published }: { published: boolean }) {
  return published ? (
    <Badge tone="success" dot>
      게시됨
    </Badge>
  ) : (
    <Badge tone="neutral">초안</Badge>
  )
}

// ── 항목 태그(new/improved/fixed/announcement) ──
const TAG_META: Record<EntryTag, { label: string; tone: BadgeProps['tone'] }> = {
  new: { label: '신규', tone: 'accent' },
  improved: { label: '개선', tone: 'success' },
  fixed: { label: '수정', tone: 'danger' },
  announcement: { label: '공지', tone: 'info' },
}

export function TagBadge({ tag, size = 'sm' }: { tag: EntryTag; size?: BadgeProps['size'] }) {
  const meta = TAG_META[tag]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

// ── 요금제 ──
const PLAN_META: Record<Plan, { label: string; tone: BadgeProps['tone'] }> = {
  free: { label: 'Free', tone: 'neutral' },
  pro: { label: 'Pro', tone: 'accent' },
}

export function PlanBadge({ plan, size = 'md' }: { plan: Plan; size?: BadgeProps['size'] }) {
  const meta = PLAN_META[plan]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}
