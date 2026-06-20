import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/utils/cn'

/**
 * 키 표시 필드 — 퍼블리시/시크릿 키를 모노스페이스로 보여주고 복사·마스킹을 지원한다.
 * 시크릿 키는 기본 마스킹(secret=true) — 발급 직후 1회 노출 화면에서만 reveal 한다.
 */
export function KeyField({
  value,
  label,
  secret = false,
  className,
}: {
  value: string
  label: string
  secret?: boolean
  className?: string
}) {
  const [revealed, setRevealed] = useState(!secret)
  const [copied, setCopied] = useState(false)

  const masked = revealed ? value : '•'.repeat(Math.min(value.length, 24))

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[0.8125rem] text-text">
        {masked}
      </code>
      {secret ? (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="inline-grid size-8 shrink-0 place-items-center rounded-md border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
          aria-label={revealed ? `${label} 가리기` : `${label} 표시`}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
        }}
        className="inline-grid size-8 shrink-0 place-items-center rounded-md border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
        aria-label={`${label} 복사`}
      >
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}
