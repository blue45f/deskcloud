import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { ComponentType, ReactNode } from 'react'

import { cn } from '@/utils/cn'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'danger'

const TONE_RING: Record<Tone, string> = {
  neutral: 'text-text',
  accent: 'text-accent-strong',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  danger: 'text-danger',
}

/** 대시보드 지표 카드 — 라벨 · 큰 값 · 부가설명 + 선택 아이콘. `to` 가 있으면 링크 카드. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
  to,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  icon?: ComponentType<{ className?: string }>
  /** 지정하면 카드 전체가 이 경로로 가는 링크가 된다(키보드·스크린리더 접근 가능). */
  to?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[0.8125rem] font-medium text-text-muted">{label}</p>
        {to ? (
          <ArrowUpRight className="size-4 text-text-subtle transition-colors group-hover:text-text" />
        ) : Icon ? (
          <Icon className={cn('size-4', TONE_RING[tone])} />
        ) : null}
      </div>
      <p className={cn('mt-2 font-mono text-2xl font-semibold tracking-tight', TONE_RING[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-subtle">{hint}</p> : null}
    </>
  )

  const base = 'rounded-lg border border-border bg-surface p-5'

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          base,
          'group block outline-none transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-strong'
        )}
      >
        {body}
      </Link>
    )
  }

  return <div className={base}>{body}</div>
}
