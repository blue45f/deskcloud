import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { CopyButton } from '@/components/ui/feedback'
import { cn } from '@/utils/cn'

/**
 * 키(pk/sk) 표시 행 — 라벨 + 모노스페이스 값 + 복사. secret 은 기본 마스킹(눈 아이콘으로 토글).
 * pk 는 브라우저 노출용이라 마스킹하지 않는다.
 */
export function KeyField({
  label,
  value,
  secret = false,
  hint,
  className,
}: {
  label: string
  value: string
  /** secret 키처럼 기본 마스킹할지. */
  secret?: boolean
  hint?: string
  className?: string
}) {
  const [revealed, setRevealed] = useState(!secret)
  const masked = secret && !revealed
  const display = masked ? maskKey(value) : value

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[0.8125rem] font-medium text-text">{label}</span>
        {hint ? <span className="text-xs text-text-subtle">{hint}</span> : null}
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2">
        <code
          className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text"
          title={revealed ? value : undefined}
        >
          {display || '—'}
        </code>
        {secret ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? '키 가리기' : '키 보기'}
            className="inline-grid size-5 place-items-center rounded text-text-subtle transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        ) : null}
        <CopyButton value={value} label={`${label} 복사`} />
      </div>
    </div>
  )
}

function maskKey(value: string): string {
  if (!value) return ''
  const prefix = value.slice(0, 3)
  return `${prefix}${'•'.repeat(Math.min(28, Math.max(0, value.length - 3)))}`
}
