import { cva, type VariantProps } from 'class-variance-authority'

import type { Plan, ReportStatus, RuleAction, RuleKind, Verdict } from '@moderationdesk/shared'
import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-2 text-text-muted',
        // accent-soft 배경엔 accent-strong 텍스트(라이트=진한 크림슨, 다크=밝은 크림슨) — 대비 확보.
        accent: 'border-transparent bg-accent-soft text-accent-strong',
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

// ── 모더레이션 판정(verdict) ──
const VERDICT_META: Record<Verdict, { label: string; tone: BadgeProps['tone']; dot: boolean }> = {
  allow: { label: '허용', tone: 'success', dot: true },
  flag: { label: '주의', tone: 'warning', dot: true },
  block: { label: '차단', tone: 'danger', dot: true },
}

export function VerdictBadge({ verdict, size = 'md' }: { verdict: Verdict; size?: BadgeProps['size'] }) {
  const meta = VERDICT_META[verdict]
  return (
    <Badge tone={meta.tone} size={size} dot={meta.dot}>
      {meta.label}
    </Badge>
  )
}

// ── 신고 상태(report status) ──
const STATUS_META: Record<ReportStatus, { label: string; tone: BadgeProps['tone'] }> = {
  open: { label: '접수', tone: 'info' },
  reviewing: { label: '검토중', tone: 'warning' },
  resolved: { label: '처리됨', tone: 'success' },
  dismissed: { label: '기각', tone: 'neutral' },
}

export function ReportStatusBadge({
  status,
  size = 'md',
}: {
  status: ReportStatus
  size?: BadgeProps['size']
}) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  )
}

// ── 규칙 매칭 종류(rule kind) ──
const KIND_LABEL: Record<RuleKind, string> = {
  exact: '완전일치',
  substring: '부분일치',
  regex: '정규식',
}

export function RuleKindBadge({ kind, size = 'sm' }: { kind: RuleKind; size?: BadgeProps['size'] }) {
  return (
    <Badge tone="outline" size={size}>
      {KIND_LABEL[kind]}
    </Badge>
  )
}

// ── 규칙 액션(rule action) ──
const ACTION_META: Record<RuleAction, { label: string; tone: BadgeProps['tone'] }> = {
  block: { label: '차단', tone: 'danger' },
  flag: { label: '주의', tone: 'warning' },
  review: { label: '검토', tone: 'info' },
}

export function RuleActionBadge({
  action,
  size = 'sm',
}: {
  action: RuleAction
  size?: BadgeProps['size']
}) {
  const meta = ACTION_META[action]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

// ── 요금제(plan) ──
const PLAN_META: Record<Plan, { label: string; tone: BadgeProps['tone'] }> = {
  free: { label: 'Free', tone: 'neutral' },
  pro: { label: 'Pro', tone: 'accent' },
  scale: { label: 'Scale', tone: 'info' },
}

export function PlanBadge({ plan, size = 'md' }: { plan: Plan; size?: BadgeProps['size'] }) {
  const meta = PLAN_META[plan]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

// ── 활성/비활성 토글 표시 ──
export function EnabledPill({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge tone="success" dot>
      활성
    </Badge>
  ) : (
    <Badge tone="neutral">비활성</Badge>
  )
}
