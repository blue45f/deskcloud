import { AlertTriangle, KeyRound, RotateCcw, Save, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Plan, TenantWithSecretDto } from '@chatdesk/shared'

import { useAdminStore } from '@/app/adminStore'
import { KeyField } from '@/components/feature/KeyField'
import { OriginsEditor } from '@/components/feature/OriginsEditor'
import { Badge, PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useRotateKeys, useTenant, useUpdateTenant, useUsage } from '@/services/chat'
import { formatDateTime, formatNumber, formatPercent } from '@/utils/format'

/** 회전 결과 — 새 sk 평문 1회 노출 + 현재 세션 자격 갱신. */
function RotateResult({ tenant }: { tenant: TenantWithSecretDto }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/40 bg-warning-soft p-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div className="text-[0.8125rem] text-text">
            <p className="font-semibold">새 secret 키는 지금만 보입니다</p>
            <p className="mt-0.5 text-text-muted">
              이전 키는 즉시 무효화되었습니다. 서버 환경변수의 키를 아래 값으로 교체하세요. 이
              브라우저 세션은 새 키로 자동 갱신됩니다.
            </p>
          </div>
        </div>
      </div>
      <KeyField label="Publishable 키 (pk_)" value={tenant.publishableKey} />
      <KeyField
        label="Secret 키 (sk_)"
        value={tenant.secretKey}
        secret
        note="이 값은 다시 표시되지 않습니다. 안전하게 보관하세요."
      />
    </div>
  )
}

export default function SettingsPage() {
  useDocumentTitle('테넌트 설정')

  const tenant = useTenant()
  const usage = useUsage()
  const update = useUpdateTenant()
  const rotate = useRotateKeys()
  const login = useAdminStore((s) => s.login)

  const [name, setName] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [origins, setOrigins] = useState<string[]>([])
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotated, setRotated] = useState<TenantWithSecretDto | null>(null)

  // 서버 값으로 폼을 초기화(테넌트 로드 후 1회 + 서버 스냅샷 변경 시 리셋).
  // effect 대신 "이전 렌더 정보를 들고 렌더 중 보정" 패턴(react.dev) — set-state-in-effect 회피.
  const t = tenant.data
  const [syncedFrom, setSyncedFrom] = useState<string | null>(null)
  const serverSnapshot = t ? JSON.stringify([t.name, t.plan, t.corsOrigins]) : null
  if (t && serverSnapshot !== syncedFrom) {
    setSyncedFrom(serverSnapshot)
    setName(t.name)
    setPlan(t.plan)
    setOrigins(t.corsOrigins)
  }

  const dirty =
    !!t &&
    (name.trim() !== t.name ||
      plan !== t.plan ||
      JSON.stringify(origins) !== JSON.stringify(t.corsOrigins))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('테넌트 이름을 입력해 주세요.')
      return
    }
    update.mutate(
      { name: trimmed, plan, corsOrigins: origins },
      {
        onSuccess: () => toast.success('설정을 저장했습니다.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.'),
      }
    )
  }

  const doRotate = () => {
    rotate.mutate(undefined, {
      onSuccess: (data) => {
        setRotated(data)
        // 새 sk 로 현재 세션 자격을 즉시 교체(이전 키는 무효).
        login(data.secretKey)
        setRotateOpen(false)
        toast.success('키를 회전했습니다. 새 secret 키를 보관하세요.')
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : '키 회전에 실패했습니다.'),
    })
  }

  const messageCount = usage.data?.messages ?? t?.usage.messages ?? 0
  const cap = usage.data?.cap.messages ?? t?.usage.cap.messages ?? 0
  const ratio = cap > 0 ? messageCount / cap : 0

  if (tenant.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  // 테넌트를 불러오지 못하면 빈 카드를 보여주지 않고 명시적 에러 + 재시도.
  if (tenant.isError || !t) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">테넌트 설정</h1>
          <p className="mt-1 max-w-2xl text-pretty text-text-muted">
            이름·허용 Origin·요금제를 관리하고, 사용량을 확인하며, pk·sk 키를 회전합니다.
          </p>
        </div>
        <ErrorState
          title="테넌트 정보를 불러오지 못했습니다"
          description="네트워크나 인증(secret 키) 문제일 수 있습니다. 다시 시도해 주세요."
          onRetry={() => void tenant.refetch()}
          retrying={tenant.isFetching}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">테넌트 설정</h1>
        <p className="mt-1 max-w-2xl text-pretty text-text-muted">
          이름·허용 Origin·요금제를 관리하고, 사용량을 확인하며, pk·sk 키를 회전합니다.
        </p>
      </div>

      {/* 키 */}
      <Card>
        <CardHeader action={t ? <PlanBadge plan={t.plan} size="md" /> : null}>
          <CardTitle>API 키</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {t ? (
            <>
              <KeyField
                label="Publishable 키 (pk_)"
                value={t.publishableKey}
                note="브라우저 위젯에 안전하게 노출되는 공개 키입니다."
              />
              <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-[0.8125rem] text-text-muted">
                <span className="inline-flex items-center gap-1.5 font-medium text-text">
                  <KeyRound className="size-3.5 text-text-subtle" aria-hidden />
                  Secret 키 (sk_)
                </span>
                <p className="mt-0.5">
                  secret 키는 해시로만 저장되어 다시 표시할 수 없습니다. 분실 시 아래에서 키를
                  회전하세요.
                </p>
              </div>

              <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
                <DialogTrigger asChild>
                  <Button variant="danger" size="sm">
                    <RotateCcw className="size-4" />키 회전
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>pk·sk 키를 회전할까요?</DialogTitle>
                    <DialogDescription>
                      새 키 한 쌍이 발급되고 이전 키는 즉시 무효화됩니다. 위젯과 서버의 키를 모두
                      교체해야 메시징이 계속 동작합니다. 이 작업은 되돌릴 수 없습니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-[0.8125rem] text-text">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    회전 직후 새 secret 키 평문이 1회만 표시됩니다. 반드시 안전한 곳에 보관하세요.
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm">
                        취소
                      </Button>
                    </DialogClose>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={rotate.isPending}
                      onClick={doRotate}
                    >
                      회전하기
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {rotated ? (
                <div className="pt-2">
                  <RotateResult tenant={rotated} />
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* 사용량 */}
      <Card>
        <CardHeader>
          <CardTitle>사용량</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-muted">누적 발송 메시지</span>
            <span className="font-mono text-sm font-medium text-text tabular-nums">
              {formatNumber(messageCount)} / {formatNumber(cap)}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="요금제 사용률"
          >
            <div
              className={
                ratio >= 0.9
                  ? 'h-full rounded-full bg-danger transition-[width]'
                  : ratio >= 0.7
                    ? 'h-full rounded-full bg-warning transition-[width]'
                    : 'h-full rounded-full bg-accent transition-[width]'
              }
              style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
            />
          </div>
          <p className="text-xs text-text-subtle">
            현재 요금제 상한의 {formatPercent(ratio)} 를 사용 중입니다. 10초마다 갱신됩니다.
          </p>
        </CardContent>
      </Card>

      {/* 설정 폼 */}
      <Card>
        <CardHeader>
          <CardTitle>일반</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <Field label="테넌트 이름" htmlFor="t-name" hint="대시보드·청구에 표시되는 이름입니다.">
              <Input
                id="t-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: Offhours"
              />
            </Field>

            <Field label="요금제" htmlFor="t-plan">
              <Select id="t-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </Select>
            </Field>

            <Field
              label="허용 Origin (CORS)"
              htmlFor="t-origins-label"
              hint="브라우저 위젯이 붙을 도메인. WS 핸드셰이크와 pk 엔드포인트에서 이 목록만 허용됩니다."
            >
              <div id="t-origins-label">
                <OriginsEditor value={origins} onChange={setOrigins} />
              </div>
            </Field>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button type="submit" loading={update.isPending} disabled={!dirty}>
                <Save className="size-4" />
                변경 사항 저장
              </Button>
              {dirty ? (
                <Badge tone="warning" size="sm">
                  저장하지 않은 변경 사항이 있습니다
                </Badge>
              ) : (
                <span className="text-xs text-text-subtle">
                  생성일 {formatDateTime(t?.createdAt)}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
