import { type TenantCredentialsDto } from '@searchdesk/shared'
import { AlertTriangle, KeyRound, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CopyButton } from '@/components/ui/feedback'

/** 키 한 줄 — 라벨 + 모노스페이스 값 + 복사 버튼. */
function KeyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-bg px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-subtle">{label}</span>
        {secret ? (
          <Badge tone="danger" size="sm">
            한 번만 노출
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            브라우저 노출 OK
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">{value}</code>
        <CopyButton value={value} label={`${label} 복사`} />
      </div>
    </div>
  )
}

/**
 * 가입/키 로테이션 직후 발급된 자격증명을 보여 준다. secret 키 평문은 이 순간에만
 * 노출되므로(이후엔 해시만 저장), 사용자가 안전히 복사하도록 강하게 안내한다.
 */
export function CredentialsReveal({ creds }: { creds: TenantCredentialsDto }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-soft px-3.5 py-3 text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-[0.8125rem] leading-relaxed">
          <strong className="font-semibold">secret 키(sk_)는 지금만 보입니다.</strong> 안전한 곳에
          보관하세요. 잃어버리면 키 로테이션으로 새로 발급해야 합니다(이전 키는 즉시 무효).
        </p>
      </div>

      <div className="grid gap-2.5">
        <KeyRow label="Publishable Key (pk_) · 브라우저 검색" value={creds.publishableKey} />
        <KeyRow label="Secret Key (sk_) · 서버 색인/어드민" value={creds.secretKey} secret />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-surface-2 px-3.5 py-3 text-[0.8125rem]">
        <dt className="text-text-subtle">테넌트 id</dt>
        <dd className="text-right font-mono text-text">{creds.id}</dd>
        <dt className="text-text-subtle">slug</dt>
        <dd className="text-right font-mono text-text">{creds.slug}</dd>
        <dt className="text-text-subtle">요금제</dt>
        <dd className="text-right font-mono text-text">{creds.plan}</dd>
        <dt className="text-text-subtle">CORS 허용</dt>
        <dd className="text-right font-mono text-text">{creds.corsOrigins.join(', ') || '—'}</dd>
      </dl>

      <p className="flex items-center gap-1.5 text-xs text-text-subtle">
        <ShieldAlert className="size-3.5" aria-hidden />
        secret 키는 절대 브라우저 번들·공개 저장소에 넣지 마세요. 색인은 서버에서{' '}
        <code className="rounded bg-surface-2 px-1 py-0.5 font-mono">@searchdesk/sdk</code> 로.
      </p>

      <p className="flex items-center gap-1.5 text-xs text-text-subtle">
        <KeyRound className="size-3.5" aria-hidden />
        검색·임베드에는 publishable 키(pk_)만 쓰면 됩니다.
      </p>
    </div>
  )
}
