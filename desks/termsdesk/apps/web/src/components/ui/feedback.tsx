import { Check, Copy, Loader2, Star } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

/** 전문가 평균 별점 표시 — 후기가 없으면 "후기 없음". */
export function RatingStars({
  value,
  count,
  size = 'sm',
}: {
  value: number | null
  count: number
  size?: 'sm' | 'md'
}) {
  if (value == null || count === 0) {
    return <span className="text-xs text-text-subtle">후기 없음</span>
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        size === 'sm' ? 'text-xs' : 'text-sm'
      )}
      title={`평균 ${value.toFixed(1)}점 · 후기 ${count}건`}
    >
      <Star
        className={cn('fill-warning text-warning', size === 'sm' ? 'size-3.5' : 'size-4')}
        aria-hidden
      />
      <span className="text-text">{value.toFixed(1)}</span>
      <span className="text-text-subtle">({count})</span>
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-text-subtle', className)} aria-hidden />
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} aria-hidden />
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center',
        className
      )}
    >
      {Icon ? (
        <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-text-subtle">
          <Icon className="size-5" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-[0.8125rem] text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function CopyButton({
  value,
  className,
  label = '복사',
}: {
  value: string
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        globalThis.setTimeout(() => setCopied(false), 1200)
      }}
      className={cn(
        'inline-grid size-5 place-items-center rounded text-text-subtle transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong',
        className
      )}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  )
}

/** content-hash 등 짧은 해시 표기 + 복사. */
export function HashTag({ hash, full = false }: { hash: string | null; full?: boolean }) {
  if (!hash) return <span className="text-text-subtle">—</span>
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-text-muted">
      <span title={hash}>{full ? hash : hash.slice(0, 12)}</span>
      <CopyButton value={hash} label="해시 복사" />
    </span>
  )
}
