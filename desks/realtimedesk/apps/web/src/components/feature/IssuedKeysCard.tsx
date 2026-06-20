import { AlertTriangle } from 'lucide-react'

import type { TenantWithSecretDto } from '@realtimedesk/shared'

import { KeyField } from '@/components/feature/KeyField'
import { cn } from '@/utils/cn'

/**
 * 발급된 키 카드 — 가입/회전 직후 pk·sk 를 한 번에 보여준다.
 * sk 평문은 이 순간에만 노출되므로 경고를 함께 띄운다.
 */
export function IssuedKeysCard({
  tenant,
  className,
}: {
  tenant: TenantWithSecretDto
  className?: string
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning-soft px-3.5 py-3 text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-[0.8125rem] leading-relaxed">
          <strong className="font-semibold">secret 키는 지금만 보입니다.</strong> 안전한 곳에
          저장하세요. 분실하면 키 회전으로 새로 발급해야 합니다(이전 키는 무효화).
        </p>
      </div>
      <KeyField
        label="Publishable 키 (pk)"
        value={tenant.publishableKey}
        hint="브라우저 — 구독·presence"
      />
      <KeyField
        label="Secret 키 (sk)"
        value={tenant.secretKey}
        secret
        hint="서버 — publish·어드민"
      />
    </div>
  )
}
