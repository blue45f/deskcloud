import { Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

import { CopyButton } from '@/components/ui/feedback'

/**
 * 1회성 키 노출 패널 — secret 키(sk_)는 발급/회전 직후에만 보여 줄 수 있다(서버는 해시만 저장).
 * 기본은 마스킹, 토글로 표시, 복사 버튼 제공.
 */
export function KeyReveal({
  label,
  value,
  secret = false,
}: {
  label: string
  value: string
  secret?: boolean
}) {
  const [shown, setShown] = useState(!secret)
  const masked = secret && !shown ? maskKey(value) : value

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <KeyRound className="size-3.5" aria-hidden />
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text" title={value}>
          {masked}
        </code>
        {secret ? (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? '키 가리기' : '키 보기'}
            className="inline-grid size-6 place-items-center rounded text-text-subtle transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : null}
        <CopyButton value={value} label={`${label} 복사`} className="size-6" />
      </div>
    </div>
  )
}

/** secret 키 발급 직후 경고 배너. */
export function SecretKeyWarning() {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-xs text-text">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        secret 키(<code className="font-mono">sk_</code>)는 <strong>지금만</strong> 볼 수 있습니다.
        서버는 해시만 저장하므로 다시 확인할 수 없고, 분실 시 <strong>키 회전</strong>으로만 재발급됩니다.
        안전한 곳에 보관하세요.
      </p>
    </div>
  )
}

function maskKey(value: string): string {
  if (value.length <= 10) return '•'.repeat(value.length)
  const head = value.slice(0, 6)
  return `${head}${'•'.repeat(Math.min(24, value.length - 6))}`
}
