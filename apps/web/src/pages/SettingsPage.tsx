import { PLAN_CAPS, PLANS, type Plan, type TenantWithSecretDto } from '@realtimedesk/shared'
import { Globe, KeyRound, RefreshCw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { IssuedKeysCard } from '@/components/feature/IssuedKeysCard'
import { KeyField } from '@/components/feature/KeyField'
import { MiniBar } from '@/components/feature/MiniBar'
import { PageHeader } from '@/components/feature/PageHeader'
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
} from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useRotateKeys, useTenant, useUpdateSettings, useUsage } from '@/services/tenants'
import { formatDateTime, formatNumber, usagePct } from '@/utils/format'

const PLAN_LABEL: Record<Plan, string> = { free: 'Free', pro: 'Pro' }

export default function SettingsPage() {
  useDocumentTitle('설정')
  const tenant = useTenant()
  const usage = useUsage()
  const rotate = useRotateKeys()
  const update = useUpdateSettings()
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotated, setRotated] = useState<TenantWithSecretDto | null>(null)

  // 편집 폼 — 서버 값으로 초기화하고, 사용자가 바꾸면 dirty 상태로 저장 버튼을 노출.
  const [name, setName] = useState('')
  const [plan, setPlan] = useState<Plan>('free')
  const [originsText, setOriginsText] = useState('')

  const tt = tenant.data
  // 비동기 로드된 서버 값으로 편집 폼을 1회 초기화하는 정당한 동기화 패턴.
  // 실험적 set-state-in-effect 규칙의 오탐이라 이 effect 한정으로 비활성한다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!tt) return
    setName(tt.name)
    setPlan(tt.plan)
    setOriginsText(tt.corsOrigins.join('\n'))
  }, [tt])
  /* eslint-enable react-hooks/set-state-in-effect */

  const parsedOrigins = originsText
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const dirty =
    !!tt &&
    (name.trim() !== tt.name ||
      plan !== tt.plan ||
      parsedOrigins.join('\n') !== tt.corsOrigins.join('\n'))

  const doSave = () => {
    if (!tt) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('프로젝트 이름을 입력하세요.')
      return
    }
    update.mutate(
      { name: trimmed, plan, corsOrigins: parsedOrigins },
      {
        onSuccess: () => toast.success('설정이 저장되었습니다.'),
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : '설정 저장에 실패했습니다.'
          toast.error(msg)
        },
      }
    )
  }

  const resetForm = () => {
    if (!tt) return
    setName(tt.name)
    setPlan(tt.plan)
    setOriginsText(tt.corsOrigins.join('\n'))
  }

  const doRotate = () => {
    rotate.mutate(undefined, {
      onSuccess: (next) => {
        setRotated(next)
        setRotateOpen(false)
        toast.success('키가 회전되었습니다. 이전 키는 즉시 무효화됩니다.')
      },
      onError: (err) => {
        const msg = err instanceof ApiError ? err.message : '키 회전에 실패했습니다.'
        toast.error(msg)
      },
    })
  }

  const t = tt
  const usageData = usage.data

  return (
    <>
      <PageHeader
        title="테넌트 설정"
        description="키·CORS·요금제·사용량을 확인하고, 필요하면 키를 회전하세요."
        action={t ? <PlanBadge plan={t.plan} /> : null}
      />

      {rotated ? (
        <Card className="mb-6 border-accent/40">
          <CardHeader>
            <CardTitle>새 키가 발급되었습니다</CardTitle>
          </CardHeader>
          <CardContent>
            <IssuedKeysCard tenant={rotated} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 테넌트 정보 — 이름·요금제 편집 */}
        <Card>
          <CardHeader>
            <CardTitle>프로젝트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant.isLoading ? (
              <>
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </>
            ) : t ? (
              <>
                <Field label="이름" htmlFor="set-name" required>
                  <Input
                    id="set-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="요금제"
                  htmlFor="set-plan"
                  hint="요금제에 따라 메시지·연결 상한이 달라집니다."
                >
                  <Select
                    id="set-plan"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as Plan)}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {PLAN_LABEL[p]} — 메시지 {formatNumber(PLAN_CAPS[p].messages)} · 연결{' '}
                        {formatNumber(PLAN_CAPS[p].connections)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <dl className="space-y-2.5 border-t border-border pt-3 text-sm">
                  <Row
                    label="테넌트 ID"
                    value={<code className="font-mono text-xs">{t.id}</code>}
                  />
                  <Row label="생성일" value={formatDateTime(t.createdAt)} />
                </dl>
              </>
            ) : (
              <TenantLoadError onRetry={() => void tenant.refetch()} loading={tenant.isFetching} />
            )}
          </CardContent>
        </Card>

        {/* 키 */}
        <Card>
          <CardHeader
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRotateOpen(true)}
                disabled={!t}
              >
                <RefreshCw className="size-4" />키 회전
              </Button>
            }
          >
            <CardTitle>API 키</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : t ? (
              <>
                <KeyField
                  label="Publishable 키 (pk)"
                  value={t.publishableKey}
                  hint="브라우저 — 구독·presence"
                />
                <div className="flex items-start gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5">
                  <KeyRound className="mt-0.5 size-4 shrink-0 text-text-subtle" aria-hidden />
                  <p className="text-xs text-text-muted">
                    Secret 키(sk)는 발급/회전 시에만 평문으로 노출됩니다(해시로만 저장). 분실 시 키
                    회전으로 새로 발급하세요.
                  </p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* CORS / Origin — 편집 */}
        <Card>
          <CardHeader>
            <CardTitle>허용 Origin (CORS)</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : t ? (
              <Field
                label="Origin allowlist"
                htmlFor="set-origins"
                hint="한 줄에 하나씩(또는 쉼표로 구분). 예: https://app.example.com. 비우면 모든 Origin(*)을 허용합니다."
              >
                <Textarea
                  id="set-origins"
                  value={originsText}
                  onChange={(e) => setOriginsText(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-xs"
                  placeholder={'https://app.example.com\nhttp://localhost:3000'}
                />
                {parsedOrigins.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {parsedOrigins.map((o) => (
                      <li key={o}>
                        <Badge tone={o === '*' ? 'warning' : 'neutral'} size="md">
                          <Globe className="size-3" aria-hidden />
                          <code className="font-mono">{o}</code>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-warning">
                    비어 있음 — 저장 시 모든 Origin(*)으로 설정됩니다(데모용). 운영 시에는 특정
                    Origin 으로 제한하세요.
                  </p>
                )}
              </Field>
            ) : (
              <TenantLoadError onRetry={() => void tenant.refetch()} loading={tenant.isFetching} />
            )}
          </CardContent>
        </Card>

        {/* 사용량 */}
        <Card>
          <CardHeader>
            <CardTitle>사용량 & 상한</CardTitle>
          </CardHeader>
          <CardContent>
            {usage.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : usageData ? (
              <div className="space-y-4">
                <UsageRow label="메시지" used={usageData.messages} cap={usageData.cap.messages} />
                <UsageRow
                  label="연결"
                  used={usageData.connections}
                  cap={usageData.cap.connections}
                />
                <MiniBar
                  rows={[
                    { label: 'messages', count: usageData.messages, tone: 'accent' },
                    { label: 'connections', count: usageData.connections, tone: 'info' },
                  ]}
                  total={Math.max(usageData.cap.messages, 1)}
                  emptyText="아직 사용량이 없습니다."
                />
                {t ? (
                  <p className="text-xs text-text-subtle">
                    {t.plan} 요금제 상한 — 메시지 {formatNumber(PLAN_CAPS[t.plan].messages)} · 연결{' '}
                    {formatNumber(PLAN_CAPS[t.plan].connections)}. 메시지 상한 초과 시 publish 가
                    거부됩니다.
                  </p>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="사용량을 불러올 수 없습니다"
                description="일시적인 문제일 수 있습니다. 다시 시도해 주세요."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void usage.refetch()}
                    loading={usage.isFetching}
                  >
                    <RefreshCw className="size-4" />
                    다시 시도
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 저장 바 — 변경이 있을 때만 노출 */}
      {dirty ? (
        <div
          role="region"
          aria-label="저장되지 않은 변경"
          className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-surface-2 px-4 py-3 shadow-lg"
        >
          <p className="text-sm text-text-muted">저장되지 않은 변경이 있습니다.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetForm} disabled={update.isPending}>
              되돌리기
            </Button>
            <Button size="sm" onClick={doSave} loading={update.isPending}>
              <Save className="size-4" />
              변경 저장
            </Button>
          </div>
        </div>
      ) : null}

      {/* 키 회전 확인 */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>키를 회전할까요?</DialogTitle>
            <DialogDescription>
              새 pk·sk 가 발급되고 <strong>이전 키는 즉시 무효화</strong>됩니다. 모든
              클라이언트·서버가 새 키로 교체될 때까지 연결·발행이 거부될 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                취소
              </Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={doRotate} loading={rotate.isPending}>
              회전 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TenantLoadError({ onRetry, loading }: { onRetry: () => void; loading: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text-subtle">테넌트 정보를 불러올 수 없습니다.</p>
      <Button variant="secondary" size="sm" onClick={onRetry} loading={loading}>
        <RefreshCw className="size-4" />
        다시 시도
      </Button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-subtle">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

function UsageRow({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = usagePct(used, cap)
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono tabular-nums text-text">
        {formatNumber(used)} <span className="text-text-subtle">/ {formatNumber(cap)}</span>{' '}
        <Badge tone={pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'neutral'} size="sm">
          {pct}%
        </Badge>
      </span>
    </div>
  )
}
