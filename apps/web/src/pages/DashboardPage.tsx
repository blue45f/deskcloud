import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  KeyRound,
  RotateCw,
  Settings,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { TenantWithSecretDto, UsageMetric } from '@desk/shared/browser'
import { UNLIMITED } from '@desk/shared/browser'

import { useTheme } from '@/app/ThemeContext'
import { PlanBadge, StatusBadge } from '@/components/ui/badge'
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
import { PoweredByDeskCloud } from '@/PoweredByDeskCloud'
import {
  cancelSubscription,
  fetchPlans,
  fetchSubscription,
  fetchTenant,
  fetchUsage,
  rotateKeys,
  startCheckout,
  updateTenant,
} from '@/services/api'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { fmtNum, fmtPriceKrw, fmtStorage } from '@/utils/format'
import { cn } from '@/utils/cn'

const METRIC_LABEL: Record<UsageMetric, string> = {
  api_calls: 'API 호출',
  events: '이벤트',
  storage_mb: '저장(MiB)',
  seats: '좌석',
}

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
              label={METRIC_LABEL[m.metric]}
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
            {tenant ? <CopyButton value={tenant.publishableKey} label="publishable 키 복사" /> : null}
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

        {rotate.isError ? (
          <Banner tone="error">{(rotate.error as Error).message}</Banner>
        ) : null}

        {rotated ? (
          <RotatedKeyDialog rotated={rotated} onClose={() => setRotated(null)} />
        ) : null}

        {/* 배지 미리보기 */}
        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text">Powered by DeskCloud 배지</p>
            <p className="text-[0.6875rem] text-text-muted">
              {sub?.showBadge
                ? 'Free 플랜 — 공개 위젯에 배지가 노출됩니다.'
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
            이 키는 지금 한 번만 표시됩니다. 즉시 안전한 곳에 저장하세요. 이전 키는 무효화되었습니다.
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
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> 저장하지 않고 닫으면 다시 볼 수
            없습니다.
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
function SettingsPanel() {
  const qc = useQueryClient()
  const { data: tenant } = useQuery({ queryKey: ['tenant'], queryFn: fetchTenant })
  const [name, setName] = useState('')
  const [cors, setCors] = useState('')
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (tenant) {
      setName(tenant.name)
      setCors(tenant.corsOrigins.join('\n'))
    }
  }, [tenant])

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
      <CardHeader
        action={sub ? <StatusBadge status={sub.status} /> : null}
      >
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
        {checkout.isError ? <Banner tone="error">{(checkout.error as Error).message}</Banner> : null}
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
  const { data: tenant } = useQuery({ queryKey: ['tenant'], queryFn: fetchTenant })

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

      <SettingsPanel />
    </div>
  )
}
