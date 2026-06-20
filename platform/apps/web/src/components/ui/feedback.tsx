import { Check, Copy, Loader2 } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

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
        window.setTimeout(() => setCopied(false), 1200)
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

/** alert/status 배너 — 폼 오류·성공 알림. */
export function Banner({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'success' | 'info' | 'warning'
  children: ReactNode
  className?: string
}) {
  const styles: Record<typeof tone, string> = {
    error: 'border-danger/40 bg-danger-soft text-danger',
    success: 'border-success/40 bg-success-soft text-success',
    info: 'border-info/40 bg-info-soft text-info',
    warning: 'border-warning/40 bg-warning-soft text-warning',
  }
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-3.5 py-2.5 text-[0.8125rem]', styles[tone], className)}
    >
      {children}
    </p>
  )
}
