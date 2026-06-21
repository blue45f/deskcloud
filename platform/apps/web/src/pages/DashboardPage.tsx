import { PLAN_LIMITS, UNLIMITED } from '@desk/shared/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  KeyRound,
  LayoutGrid,
  RotateCw,
  Settings,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import type { TenantDto, TenantWithSecretDto, UsageMetric } from '@desk/shared/browser'

import { useTheme } from '@/app/ThemeContext'
import { ConsolePreviewNotice } from '@/components/ConsolePreviewNotice'
import { DeskGlyph } from '@/components/feature/DeskGlyph'
import { Badge, PlanBadge, StatusBadge } from '@/components/ui/badge'
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
import { Banner, CopyButton, Spinner } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Meter } from '@/components/ui/meter'
import {
  PRODUCT_DESKS,
  USAGE_METRIC_LABEL,
  deskMicrositePath,
  deskOperations,
} from '@/data/deskCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PoweredByDeskCloud } from '@/PoweredByDeskCloud'
import {
  CONSOLE_API_READY,
  cancelSubscription,
  fetchPlans,
  fetchSubscription,
  fetchTenant,
  fetchUsage,
  rotateKeys,
  startCheckout,
  updateTenant,
} from '@/services/api'
import { cn } from '@/utils/cn'
import { fmtNum, fmtPriceKrw, fmtStorage } from '@/utils/format'

function metricFormat(metric: UsageMetric): (n: number) => string {
  return metric === 'storage_mb' ? fmtStorage : fmtNum
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold tracking-wide text-text-subtle uppercase">
      {children}
    </h2>
  )
}

function DeskOperationsHub() {
  const [params, setParams] = useSearchParams()
  const fallbackDesk = PRODUCT_DESKS[0]

  if (!fallbackDesk) {
    return null
  }

  const selectedId = params.get('desk') ?? fallbackDesk.id
  const selected = PRODUCT_DESKS.find((d) => d.id === selectedId) ?? fallbackDesk
  const operations = deskOperations(selected)
  const format = metricFormat(operations.primaryMetric)

  const selectDesk = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('desk', id)
    setParams(next, { replace: true })
  }

  return (
    <Card>
      <CardHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to={deskMicrositePath(selected)}>
              마이크로사이트 <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      >
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <LayoutGrid className="size-4" aria-hidden /> Desk 운영 허브
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div
            className="grid max-h-[28rem] gap-1 overflow-y-auto pr-1"
            role="listbox"
            aria-label="운영할 Desk 선택"
          >
            {PRODUCT_DESKS.map((desk) => {
              const active = desk.id === selected.id
              return (
                <button
                  key={desk.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => selectDesk(desk.id)}
                  className={cn(
                    'flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-accent-strong bg-accent-soft text-accent-fg'
                      : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2'
                  )}
                >
                  <DeskGlyph icon={desk.icon} tone={desk.tone} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{desk.name}</span>
                    <span className="mt-0.5 block truncate text-[0.75rem] opacity-80">
                      {desk.tagline}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DeskGlyph icon={selected.icon} tone={selected.tone} size="sm" />
                  <h3 className="text-base font-semibold text-text">{selected.name}</h3>
                  <Badge tone="success" size="sm" dot>
                    Live
                  </Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-pretty text-text-muted">
                  {selected.what}
                </p>
              </div>
              <PlanBadge plan={operations.recommendedPlan} size="sm" />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-md bg-surface-2 p-3">
                <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">Gateway</p>
                <p className="mt-1 font-mono text-sm text-text">{operations.gatewayPath}</p>
              </div>
              <div className="rounded-md bg-surface-2 p-3">
                <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                  Primary metric
                </p>
                <p className="mt-1 text-sm font-semibold text-text">
                  {USAGE_METRIC_LABEL[operations.primaryMetric]}
                </p>
              </div>
              <div className="rounded-md bg-surface-2 p-3">
                <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                  Recommended
                </p>
                <p className="mt-1 text-sm font-semibold text-text">
                  {operations.recommendedPlan.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <SectionTitle>필수 구성</SectionTitle>
                <ul className="flex flex-wrap gap-1.5">
                  {operations.config.map((item) => (
                    <li key={item}>
                      <Badge tone="outline" size="sm">
                        {item}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <SectionTitle>운영 작업</SectionTitle>
                <ul className="space-y-1.5">
                  {operations.operatorTasks.map((task) => (
                    <li key={task} className="flex items-start gap-2 text-sm text-text-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <SectionTitle>플랜 한도</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-4">
                {(['free', 'pro', 'scale', 'enterprise'] as const).map((plan) => (
                  <div key={plan} className="rounded-md bg-surface-2 p-3">
                    <p className="text-xs font-semibold text-text">{plan.toUpperCase()}</p>
                    <p className="mt-1 font-mono text-[0.8125rem] text-text-muted">
                      {format(PLAN_LIMITS[plan][operations.primaryMetric])}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-text-subtle">{operations.billingDriver}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── 사용량 미터 ──────────────────────────────────────────────────────────────
function UsagePanel() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['usage'],
    queryFn: () => fetchUsage('current'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>이번 달 사용량</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Spinner /> 불러오는 중…
          </div>
        ) : isError ? (
          <Banner tone="error">{(error as Error).message}</Banner>
        ) : data ? (
          data.metrics.map((m) => (
            <Meter
              key={m.metric}
              label={USAGE_METRIC_LABEL[m.metric]}
              used={m.used}
              limit={m.limit}
              format={metricFormat(m.metric)}
            />
          ))
        ) : null}
      </CardContent>
    </Card>
  )
}

// ── API 키 + 회전 ────────────────────────────────────────────────────────────
function KeysPanel() {
  const qc = useQueryClient()
  const { resolved } = useTheme()
  const { data: tenant } = useQuery({ queryKey: ['tenant'], queryFn: fetchTenant })
  const { data: sub } = useQuery({ queryKey: ['subscription'], queryFn: fetchSubscription })
  const [rotated, setRotated] = useState<TenantWithSecretDto | null>(null)

  const rotate = useMutation({
    mutationFn: rotateKeys,
    onSuccess: (res) => {
      setRotated(res)
      void qc.invalidateQueries({ queryKey: ['tenant'] })
    },
  })

  return (
    <Card>
      <CardHeader
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => rotate.mutate()}
            loading={rotate.isPending}
          >
            <RotateCw className="size-4" /> 키 회전
          </Button>
        }
      >
        <CardTitle>API 키</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-subtle">Publishable 키</span>
            {tenant ? (
              <CopyButton value={tenant.publishableKey} label="publishable 키 복사" />
            ) : null}
          </div>
          <code className="mt-1 block overflow-x-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-[0.8125rem] break-all text-text">
            {tenant?.publishableKey ?? '…'}
          </code>
        </div>

        <div className="rounded-md border border-dashed border-border px-3 py-2.5">
          <p className="flex items-start gap-2 text-xs text-text-muted">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            secret 키(sk_…)는 보안상 다시 조회할 수 없습니다. 분실 시 아래 키 회전으로 재발급하세요
            (이전 키는 즉시 무효).
          </p>
        </div>

        {rotate.isError ? <Banner tone="error">{(rotate.error as Error).message}</Banner> : null}

        {rotated ? <RotatedKeyDialog rotated={rotated} onClose={() => setRotated(null)} /> : null}

        {/* 배지 미리보기 */}
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text">Powered by DeskCloud 배지</p>
            <p className="text-[0.6875rem] text-text-muted">
              {sub?.showBadge
                ? 'Free 플랜 — 공개 화면에 배지가 노출됩니다.'
                : '유료 플랜 — 배지가 제거됩니다.'}
            </p>
          </div>
          {sub?.showBadge ? (
            <PoweredByDeskCloud theme={resolved} />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <Check className="size-3.5" aria-hidden /> 제거됨
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function RotatedKeyDialog({
  rotated,
  onClose,
}: {
  rotated: TenantWithSecretDto
  onClose: () => void
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 secret 키가 발급되었습니다</DialogTitle>
          <DialogDescription>
            이 키는 지금 한 번만 표시됩니다. 즉시 안전한 곳에 저장하세요. 이전 키는
            무효화되었습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-subtle">Secret 키</span>
            <CopyButton value={rotated.secretKey} label="새 secret 키 복사" />
          </div>
          <code className="mt-1.5 block overflow-x-auto font-mono text-[0.8125rem] break-all text-text">
            {rotated.secretKey}
          </code>
        </div>
        <Banner tone="warning" className="mt-3">
          <span className="inline-flex items-center gap-1.5">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> 저장하지 않고 닫으면 다시 볼
            수 없습니다.
          </span>
        </Banner>
        <DialogFooter>
          <DialogClose asChild>
            <Button onClick={onClose}>저장했습니다</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── 설정(name·CORS) ──────────────────────────────────────────────────────────
// 로더는 tenant 가 준비되면 SettingsForm 을 tenant.id 키로 마운트한다. key 가 바뀌면
// 폼 상태가 자동으로 초기화되므로 fetch→state 동기화 이펙트가 필요 없다.
function SettingsPanel() {
  const { data: tenant } = useQuery({ queryKey: ['tenant'], queryFn: fetchTenant })
  if (!tenant) return null
  return <SettingsForm key={tenant.id} tenant={tenant} />
}

function SettingsForm({ tenant }: { tenant: TenantDto }) {
  const qc = useQueryClient()
  const [name, setName] = useState(tenant.name)
  const [cors, setCors] = useState(() => tenant.corsOrigins.join('\n'))
  const [ok, setOk] = useState(false)

  const save = useMutation({
    mutationFn: () =>
      updateTenant({
        name: name.trim(),
        corsOrigins: cors
          .split(/\s*[\n,]\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setOk(true)
      window.setTimeout(() => setOk(false), 2000)
      void qc.invalidateQueries({ queryKey: ['tenant'] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Settings className="size-4" aria-hidden /> 설정
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <Field label="이름" htmlFor="set-name">
            <Input
              id="set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </Field>
          <Field
            label="CORS Origins"
            htmlFor="set-cors"
            hint="줄바꿈 또는 쉼표로 구분. 예: https://app.example.com (전체 허용은 *)"
          >
            <Textarea
              id="set-cors"
              value={cors}
              onChange={(e) => setCors(e.target.value)}
              placeholder="https://my-app.com"
              spellCheck={false}
            />
          </Field>
          {save.isError ? <Banner tone="error">{(save.error as Error).message}</Banner> : null}
          {ok ? <Banner tone="success">설정이 저장되었습니다.</Banner> : null}
          <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
            저장
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── 빌링(플랜 비교 + 업그레이드/취소) ──────────────────────────────────────────
function BillingPanel() {
  const qc = useQueryClient()
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: fetchPlans })
  const { data: sub } = useQuery({ queryKey: ['subscription'], queryFn: fetchSubscription })
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['subscription'] })
    void qc.invalidateQueries({ queryKey: ['tenant'] })
    void qc.invalidateQueries({ queryKey: ['usage'] })
  }

  const checkout = useMutation({
    mutationFn: (plan: string) => startCheckout({ plan: plan as never }),
    onSuccess: (res) => {
      setNotice(
        `체크아웃 세션 생성(${res.provider}, charged=${res.charged}). 스텁 결제 페이지를 새 탭으로 엽니다 — 활성화는 웹훅 후 반영됩니다.`
      )
      window.open(res.checkoutUrl, '_blank', 'noopener')
      refresh()
    },
  })

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      setNotice('구독이 취소되어 Free 로 복귀했습니다.')
      refresh()
    },
  })

  const paidPlans = (plans ?? []).filter((p) => p.plan !== 'free' && p.plan !== 'enterprise')
  const busy = checkout.isPending || cancel.isPending

  return (
    <Card>
      <CardHeader action={sub ? <StatusBadge status={sub.status} /> : null}>
        <CardTitle>빌링</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {sub ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-surface-2 px-4 py-3">
            <div>
              <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">현재 플랜</p>
              <p className="mt-0.5">
                <PlanBadge plan={sub.plan} />
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">제공자</p>
              <p className="mt-0.5 font-mono text-sm text-text">{sub.provider}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">갱신일</p>
              <p className="mt-0.5 font-mono text-sm text-text">
                {sub.periodEnd ? sub.periodEnd.slice(0, 10) : '—'}
              </p>
            </div>
          </div>
        ) : null}

        {notice ? <Banner tone="info">{notice}</Banner> : null}
        {checkout.isError ? (
          <Banner tone="error">{(checkout.error as Error).message}</Banner>
        ) : null}
        {cancel.isError ? <Banner tone="error">{(cancel.error as Error).message}</Banner> : null}

        {/* 플랜 비교 + 업그레이드 */}
        <div>
          <SectionTitle>플랜 비교</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {paidPlans.map((p) => {
              const current = sub?.plan === p.plan
              return (
                <div
                  key={p.plan}
                  className={cn(
                    'rounded-lg border p-4',
                    current ? 'border-accent-strong bg-accent-soft/40' : 'border-border bg-surface'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text">{p.label}</h3>
                    <PlanBadge plan={p.plan} size="sm" />
                  </div>
                  <p className="mt-1 text-lg font-semibold text-text">
                    {fmtPriceKrw(p.plan, p.priceKrwMonthly)}
                    <span className="text-xs font-normal text-text-muted">/월</span>
                  </p>
                  <ul className="mt-2 space-y-0.5 text-[0.75rem] text-text-muted">
                    <li>API {fmtNum(p.limits.api_calls ?? UNLIMITED)}</li>
                    <li>이벤트 {fmtNum(p.limits.events ?? UNLIMITED)}</li>
                    <li>저장 {fmtStorage(p.limits.storage_mb ?? UNLIMITED)}</li>
                  </ul>
                  <Button
                    variant={current ? 'secondary' : 'accent'}
                    size="sm"
                    className="mt-3 w-full"
                    disabled={busy || current}
                    onClick={() => checkout.mutate(p.plan)}
                  >
                    {current ? '현재 플랜' : `${p.label}로 업그레이드`}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="flex items-center gap-1.5 text-xs text-text-subtle">
            <AlertTriangle className="size-3.5" aria-hidden /> 모든 결제는 TEST/STUB — 실제 청구는
            발생하지 않습니다.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/pricing">요금제 전체 보기</Link>
            </Button>
            {sub && sub.plan !== 'free' ? (
              <Button
                variant="danger"
                size="sm"
                loading={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                구독 취소 (Free 복귀)
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  useDocumentTitle('콘솔')
  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: fetchTenant,
    enabled: CONSOLE_API_READY,
  })

  if (!CONSOLE_API_READY) {
    return (
      <div className="space-y-8">
        <ConsolePreviewNotice title="콘솔" />
        <DeskOperationsHub />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            {tenant?.name ?? '콘솔'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {tenant ? (
              <>
                <code className="font-mono">{tenant.slug}</code> · 전체 Desk 패밀리 공통 계정
              </>
            ) : (
              '계정·사용량·키·빌링을 한곳에서 관리합니다.'
            )}
          </p>
        </div>
        {tenant ? <PlanBadge plan={tenant.plan} /> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <UsagePanel />
        <KeysPanel />
      </div>

      <BillingPanel />

      <DeskOperationsHub />

      <SettingsPanel />
    </div>
  )
}
