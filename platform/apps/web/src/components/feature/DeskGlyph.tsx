import type { LucideIcon } from 'lucide-react'

import { cn } from '@/utils/cn'

const TONE: Record<string, string> = {
  accent: 'bg-accent-soft text-accent-fg',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
}

const SIZE: Record<string, string> = {
  sm: 'size-8 rounded-md [&>svg]:size-4',
  md: 'size-10 rounded-lg [&>svg]:size-5',
  lg: 'size-12 rounded-xl [&>svg]:size-6',
}

/** Desk 카드/리스트의 아이콘 글리프 — tone 별 soft 배경. */
export function DeskGlyph({
  icon: Icon,
  tone = 'accent',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone?: 'accent' | 'info' | 'success' | 'warning'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span className={cn('grid shrink-0 place-items-center', TONE[tone], SIZE[size], className)}>
      <Icon aria-hidden />
    </span>
  )
}
