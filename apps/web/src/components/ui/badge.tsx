import { type QuestionType } from '@surveydesk/shared'
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

// ── 설문 활성 상태 ──
export function ActivePill({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot>
      활성
    </Badge>
  ) : (
    <Badge tone="neutral">비활성</Badge>
  )
}

// ── 질문 타입 ──
const QUESTION_TYPE_META: Record<QuestionType, { label: string; tone: BadgeProps['tone'] }> = {
  rating: { label: '별점', tone: 'warning' },
  nps: { label: 'NPS', tone: 'info' },
  single_choice: { label: '단일 선택', tone: 'accent' },
  multi_choice: { label: '복수 선택', tone: 'accent' },
  text: { label: '자유서술', tone: 'neutral' },
}

export function QuestionTypeBadge({
  type,
  size = 'sm',
}: {
  type: QuestionType
  size?: BadgeProps['size']
}) {
  const meta = QUESTION_TYPE_META[type]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}
