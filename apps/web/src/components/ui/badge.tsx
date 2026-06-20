import { type BoardKind, type ContentStatus } from '@communitydesk/shared'
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

// ── 게시판 종류(board | cafe) ──
const BOARD_KIND_META: Record<BoardKind, { label: string; tone: BadgeProps['tone'] }> = {
  board: { label: '게시판', tone: 'info' },
  cafe: { label: '카페', tone: 'accent' },
}

export function BoardKindBadge({
  kind,
  size = 'sm',
}: {
  kind: BoardKind
  size?: BadgeProps['size']
}) {
  const meta = BOARD_KIND_META[kind]
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  )
}

// ── 콘텐츠 상태(visible | hidden | pending) ──
const STATUS_META: Record<ContentStatus, { label: string; tone: BadgeProps['tone']; dot?: boolean }> =
  {
    visible: { label: '노출', tone: 'success', dot: true },
    hidden: { label: '숨김', tone: 'danger' },
    pending: { label: '검수 대기', tone: 'warning', dot: true },
  }

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: ContentStatus
  size?: BadgeProps['size']
}) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} size={size} dot={meta.dot}>
      {meta.label}
    </Badge>
  )
}
