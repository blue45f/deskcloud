import {
  POLICY_TYPE_LABELS,
  type ConsentDecision,
  type PolicyType,
  type VersionStatus,
} from '@termsdesk/shared'
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

// ── 버전 상태 ──
const STATUS_META: Record<VersionStatus, { label: string; tone: BadgeProps['tone'] }> = {
  published: { label: '발효 중', tone: 'success' },
  draft: { label: '초안', tone: 'neutral' },
  scheduled: { label: '게시 예약', tone: 'info' },
  archived: { label: '보관됨', tone: 'outline' },
}

export function StatusPill({ status, size }: { status: VersionStatus; size?: BadgeProps['size'] }) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot={status === 'published'}>
      {meta.label}
    </Badge>
  )
}

// ── 동의 결정 ──
const DECISION_META: Record<ConsentDecision, { label: string; tone: BadgeProps['tone'] }> = {
  accepted: { label: '동의', tone: 'success' },
  declined: { label: '거부', tone: 'danger' },
  withdrawn: { label: '철회', tone: 'neutral' },
}

export function DecisionPill({ decision }: { decision: ConsentDecision }) {
  const meta = DECISION_META[decision]
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}

// ── 문서 종류 ──
export function PolicyTypeBadge({ type }: { type: PolicyType }) {
  return (
    <Badge tone="outline" size="sm">
      {POLICY_TYPE_LABELS[type]}
    </Badge>
  )
}
