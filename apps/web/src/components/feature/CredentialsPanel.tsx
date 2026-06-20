import { type TenantCredentialsDto } from '@notifydesk/shared'
import { Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { CopyButton } from '@/components/ui/feedback'
import { cn } from '@/utils/cn'

/**
 * 가입/로테이션 직후 발급된 키쌍을 보여 준다.
 * publishable(pk_)은 브라우저 노출 안전, secret(sk_)은 이 화면에서만 1회 노출됨을 강조한다.
 */
export function CredentialsPanel({
  credentials,
  className,
}: {
  credentials: TenantCredentialsDto
  className?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const masked = '•'.repeat(Math.max(12, credentials.secretKey.length))

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3">
        <p className="flex items-start gap-2 text-[0.8125rem] text-text">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            <strong className="font-semibold">secret 키(sk_)는 지금만 볼 수 있습니다.</strong> 안전한
            곳에 보관하세요. 잃어버리면 설정에서 키를 다시 발급(rotate)해야 합니다. secret 키는 절대
            브라우저/클라이언트에 노출하지 마세요(서버 전용).
          </span>
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <KeyRound className="size-3.5 text-accent-strong" aria-hidden />
          <span className="text-[0.8125rem] font-medium text-text">Publishable key</span>
          <Badge tone="accent" size="sm">
            브라우저 안전
          </Badge>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
            {credentials.publishableKey}
          </code>
          <CopyButton value={credentials.publishableKey} label="publishable 키 복사" />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <KeyRound className="size-3.5 text-danger" aria-hidden />
          <span className="text-[0.8125rem] font-medium text-text">Secret key</span>
          <Badge tone="danger" size="sm">
            서버 전용 · 1회 노출
          </Badge>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
            {revealed ? credentials.secretKey : masked}
          </code>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'secret 키 가리기' : 'secret 키 보기'}
            className="inline-grid size-5 place-items-center rounded text-text-subtle transition-colors hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          <CopyButton value={credentials.secretKey} label="secret 키 복사" />
        </div>
      </div>
    </div>
  )
}
