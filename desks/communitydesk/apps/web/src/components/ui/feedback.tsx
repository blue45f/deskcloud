import { AlertTriangle, Check, Copy, Loader2, RotateCw } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'

import { ApiError } from '@/services/api'
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

/**
 * 데이터 조회 실패 상태 — 빈 상태와 명확히 구분되는 친절한 오류 + 다시 시도 버튼.
 * 인증 오류(401/403)는 별도 로그인 흐름이 처리하므로 일반 메시지로만 안내한다.
 */
export function ErrorState({
  error,
  onRetry,
  retrying = false,
  title = '불러오지 못했습니다',
  className,
}: {
  error?: unknown
  onRetry?: () => void
  retrying?: boolean
  title?: string
  className?: string
}) {
  const description =
    error instanceof ApiError || error instanceof Error
      ? error.message
      : '네트워크 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-danger/40 px-6 py-14 text-center',
        className
      )}
      role="alert"
    >
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="mt-1 max-w-sm text-[0.8125rem] text-text-muted">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          aria-busy={retrying || undefined}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-60"
        >
          <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden /> 다시 시도
        </button>
      ) : null}
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
