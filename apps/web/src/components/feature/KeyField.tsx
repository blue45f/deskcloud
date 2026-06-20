import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'

/**
 * 키 표시 필드 — pk(평문 항상 노출 가능) 또는 sk(민감, 기본 마스킹·1회성 경고).
 * 복사 버튼 + (secret) 보기 토글. 값은 폭 넘침 시 가로 스크롤.
 */
export function KeyField({
  label,
  value,
  secret = false,
  note,
  className,
}: {
  label: string
  value: string
  /** secret 키면 기본 마스킹 + 위험 톤. */
  secret?: boolean
  note?: string
  className?: string
}) {
  const [revealed, setRevealed] = useState(!secret)
  const [copied, setCopied] = useState(false)

  const masked = secret && !revealed ? value.replace(/.(?=.{4})/g, '•') : value

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[0.8125rem] font-medium text-text">{label}</span>
        {secret ? (
          <Badge tone="danger" size="sm">
            비밀
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            공개
          </Badge>
        )}
      </div>
      <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-surface-2">
        <code className="flex-1 overflow-x-auto px-3 py-2 font-mono text-[0.8125rem] whitespace-nowrap text-text">
          {masked || '—'}
        </code>
        {secret ? (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? '키 숨기기' : '키 보기'}
            className="grid w-9 shrink-0 place-items-center border-l border-border text-text-subtle transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
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
          aria-label={`${label} 복사`}
          className="grid w-9 shrink-0 place-items-center border-l border-border text-text-subtle transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </button>
      </div>
      {note ? <p className="mt-1.5 text-xs text-text-subtle">{note}</p> : null}
    </div>
  )
}
