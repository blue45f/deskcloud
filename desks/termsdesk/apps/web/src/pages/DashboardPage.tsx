import { PLAN_LABELS, formatPlanLimit, isUnlimited } from '@termsdesk/shared'
import {
  ArrowRight,
  ChartColumn,
  FileText,
  Gauge,
  Handshake,
  KeyRound,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { MiniBarChart } from '@/components/feature/MiniBarChart'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, StatusPill } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { usePageMeta } from '@/hooks/usePageMeta'
import { useAudit, usePlanUsage } from '@/services/admin'
import { ApiError } from '@/services/api'
import { useBrokerageStats } from '@/services/brokerage'
import { useConsents } from '@/services/consents'
import { useApiKeyUsage, useConsentTrend, useReconsentStatus } from '@/services/insights'
import { usePolicies } from '@/services/policies'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/format'

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <p className="text-xs text-text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-text">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-text-muted">{hint}</p> : null}
    </div>
  )
}

export default function DashboardPage() {
  usePageMeta({
    title: '개요',
    path: '/app',
    description: '정책·게시 현황, 최근 동의 영수증, 감사 로그를 한눈에 봅니다.',
  })
  const policies = usePolicies()
  const consents = useConsents()
  const audit = useAudit(8)

  const list = policies.data ?? []
  const publishedCount = list.filter((p) => p.currentVersionId).length
  const draftOnly = list.filter((p) => !p.currentVersionId)

  return (
    <>
      <PageHeader
        title="개요"
        description="약관·정책의 현재 상태와 최근 변경 이력을 한눈에 봅니다."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="등록된 정책" value={policies.isLoading ? '—' : list.length} />
        <Stat
          label="게시 중"
          value={policies.isLoading ? '—' : publishedCount}
          hint="현재 발효 버전 보유"
        />
        <Stat
          label="미게시 초안"
          value={policies.isLoading ? '—' : draftOnly.length}
          hint="아직 발효 버전 없음"
        />
        <Stat
          label="동의 영수증"
          value={consents.isLoading ? '—' : (consents.data?.length ?? 0)}
          hint="최근 기록"
        />
      </section>

      <BrokerageCard />

      {/* 운영 인사이트 — 외부 차트 라이브러리 없이 기존 ui + CSS 미니 시각화 */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <ConsentTrendCard />
        <ReconsentCard />
        <ApiKeyUsageCard />
        <ApiQuotaCard />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            action={
              <Link
                to="/app/policies"
                className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
              >
                전체 보기 <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <CardTitle>정책 현황</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {policies.isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="등록된 정책이 없습니다"
                description="회사의 이용약관·개인정보처리방침을 등록해 버전 관리를 시작하세요."
              />
            ) : (
              <ul className="divide-y divide-border">
                {list.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/app/policies/${p.slug}`}
                      className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <FileText className="size-4 shrink-0 text-text-subtle" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text">{p.name}</p>
                          <p className="truncate font-mono text-xs text-text-subtle">{p.slug}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {p.currentVersionLabel ? (
                          <span className="font-mono text-xs text-text-muted">
                            {p.currentVersionLabel}
                          </span>
                        ) : null}
                        {p.currentVersionId ? (
                          <StatusPill status="published" size="sm" />
                        ) : (
                          <Badge size="sm">미게시</Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            action={
              <Link
                to="/app/audit"
                className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
              >
                감사 로그 <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <CardTitle>최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (audit.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-text-subtle">활동 내역이 없습니다.</p>
            ) : (
              <ol className="space-y-3">
                {audit.data?.slice(0, 7).map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5">
                    <ActivityIcon action={e.action} />
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] leading-snug text-text">
                        {e.summary ?? e.action}
                      </p>
                      <p className="mt-0.5 text-xs text-text-subtle">
                        {e.actorName ?? '시스템'} · {formatRelative(e.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/** 약관 의뢰 중계 현황 — 새 핵심 기능을 개요 상단에 노출. 모든 인증 사용자 접근 가능. */
function BrokerageCard() {
  const stats = useBrokerageStats()
  const d = stats.data

  const cells = [
    { label: '모집 중 의뢰', value: d?.openRequests, hint: '마켓 공개' },
    { label: '진행 중', value: d?.inProgressRequests, hint: '매칭·작업' },
    { label: '내 의뢰', value: d?.myRequests, hint: '우리 조직' },
    { label: '활동 전문가', value: d?.activeProviders, hint: '검토·작성' },
  ]

  return (
    <Card className="mt-6 border-accent-soft">
      <CardHeader
        action={
          <Link
            to="/app/marketplace"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
          >
            마켓 <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <CardTitle>
          <span className="flex items-center gap-2">
            <Handshake className="size-4 text-accent-strong" />
            약관 의뢰 중계
          </span>
        </CardTitle>
        <p className="mt-0.5 text-[0.8125rem] text-text-muted">
          약관 작성·검토가 필요하면 검증된 전문가와 연결하세요.
        </p>
      </CardHeader>
      <CardContent>
        {(d?.actionableAsRequester ?? 0) + (d?.actionableAsProvider ?? 0) > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-sm">
            <span className="font-medium text-text">처리 대기</span>
            {(d?.actionableAsRequester ?? 0) > 0 ? (
              <Link to="/app/requests" className="text-text-muted hover:text-text">
                의뢰자:{' '}
                <span className="font-semibold text-warning">{d?.actionableAsRequester}건</span>{' '}
                제안 확인·검수
              </Link>
            ) : null}
            {(d?.actionableAsProvider ?? 0) > 0 ? (
              <Link to="/app/marketplace" className="text-text-muted hover:text-text">
                전문가:{' '}
                <span className="font-semibold text-warning">{d?.actionableAsProvider}건</span>{' '}
                시작·납품
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cells.map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-border bg-surface-2/40 px-3 py-2.5"
            >
              <p className="text-xs text-text-subtle">{c.label}</p>
              <p className="mt-0.5 text-xl font-semibold tracking-tight text-text">
                {stats.isLoading || c.value === undefined ? '—' : c.value}
              </p>
              <p className="text-[0.6875rem] text-text-subtle">{c.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/app/requests">의뢰 올리기</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/marketplace">의뢰 마켓 둘러보기</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/app/expert">전문가로 활동하기</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityIcon({ action }: { action: string }) {
  if (action.startsWith('version.publish'))
    return <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
  if (action.includes('reconsent') || action.includes('archive'))
    return <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
  return <FileText className="mt-0.5 size-4 shrink-0 text-text-subtle" />
}

// ── 운영 인사이트 카드 ────────────────────────────────────────────────────────

const isForbidden = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 403 || error.status === 401)

/** 카드별 권한이 달라 403 이 정상 경로 — 카드 자리는 유지하고 조용히 안내만 한다. */
function PermissionNote() {
  return (
    <p className="py-8 text-center text-[0.8125rem] text-text-subtle">
      이 카드를 보려면 추가 권한이 필요합니다.
    </p>
  )
}

const formatDay = (iso: string): string => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`

function ConsentTrendCard() {
  const trend = useConsentTrend(30)
  const points = trend.data ?? []
  const totals = points.reduce(
    (acc, p) => ({
      total: acc.total + p.total,
      accepted: acc.accepted + p.accepted,
      declined: acc.declined + p.declined,
      withdrawn: acc.withdrawn + p.withdrawn,
    }),
    { total: 0, accepted: 0, declined: 0, withdrawn: 0 }
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <ChartColumn className="size-4 text-text-subtle" />
            동의 추이 · 30일
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trend.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isForbidden(trend.error) ? (
          <PermissionNote />
        ) : trend.isError ? (
          <p className="py-8 text-center text-[0.8125rem] text-text-subtle">
            추이를 불러오지 못했습니다.
          </p>
        ) : totals.total === 0 ? (
          <EmptyState
            className="border-0 px-2 py-8"
            title="아직 동의 기록이 없습니다"
            description="SDK·API 키 연동으로 동의 영수증이 쌓이면 일자별 추이가 여기에 표시됩니다."
          />
        ) : (
          <>
            <MiniBarChart
              points={points.map((p) => ({
                key: p.date,
                label: `${formatDay(p.date)} · 동의 ${p.accepted} · 거부 ${p.declined} · 철회 ${p.withdrawn}`,
                value: p.total,
              }))}
              ariaLabel={`최근 30일 동의 추이, 총 ${totals.total}건`}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-text-subtle">
              <span>{points[0] ? formatDay(points[0].date) : ''}</span>
              <span>오늘</span>
            </div>
            <p className="mt-2 text-xs text-text-muted">
              총 <span className="font-semibold text-text">{totals.total}건</span> · 동의{' '}
              {totals.accepted} · 거부 {totals.declined} · 철회 {totals.withdrawn}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ReconsentCard() {
  const reconsent = useReconsentStatus()
  const rows = reconsent.data ?? []
  const measurable = rows.filter((r) => r.totalSubjects > 0)
  const pendingTotal = rows.reduce((acc, r) => acc + r.pendingReconsent, 0)

  return (
    <Card>
      <CardHeader
        action={
          rows.length > 0 ? (
            <Link
              to="/app/consents"
              className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
            >
              영수증 <ArrowRight className="size-3.5" />
            </Link>
          ) : null
        }
      >
        <CardTitle>
          <span className="flex items-center gap-2">
            <RefreshCcw className="size-4 text-text-subtle" />
            재동의 필요
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reconsent.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isForbidden(reconsent.error) ? (
          <PermissionNote />
        ) : reconsent.isError ? (
          <p className="py-8 text-center text-[0.8125rem] text-text-subtle">
            현황을 불러오지 못했습니다.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            className="border-0 px-2 py-8"
            title="게시된 정책이 없습니다"
            description="버전을 게시하면 현재 게시본 기준 재동의 현황이 집계됩니다."
          />
        ) : measurable.length === 0 ? (
          <EmptyState
            className="border-0 px-2 py-8"
            title="동의 기록이 아직 없습니다"
            description="동의 영수증이 기록되면 정책별 재동의 필요 인원이 표시됩니다."
          />
        ) : (
          <>
            <ul className="space-y-3">
              {measurable.slice(0, 4).map((r) => {
                const ratio = r.totalSubjects > 0 ? r.acceptedCurrent / r.totalSubjects : 0
                return (
                  <li key={r.policyId}>
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        to={`/app/policies/${r.policySlug}`}
                        className="truncate text-[0.8125rem] font-medium text-text hover:text-accent-strong"
                      >
                        {r.policyName}
                        {r.currentVersionLabel ? (
                          <span className="ml-1.5 font-mono text-xs font-normal text-text-subtle">
                            {r.currentVersionLabel}
                          </span>
                        ) : null}
                      </Link>
                      {r.pendingReconsent > 0 ? (
                        <span className="shrink-0 text-xs font-semibold text-warning">
                          {r.pendingReconsent}명 필요
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-success">모두 최신</span>
                      )}
                    </div>
                    {/* 현재 게시본 동의 비율 — CSS 프로그레스 바 */}
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
                      role="progressbar"
                      aria-valuenow={Math.round(ratio * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${r.policyName} 현재본 동의율`}
                    >
                      <div
                        className={
                          r.pendingReconsent > 0 ? 'h-full bg-warning' : 'h-full bg-success'
                        }
                        style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-text-subtle">
              현재 게시본 해시 기준 · 총 {pendingTotal}명 재동의 필요
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** 이번 달 API 호출(사용/한도) — 플랜 미터링 카드. 한도는 플랜의 월 호출 쿼터(무제한 = -1). */
function ApiQuotaCard() {
  const usage = usePlanUsage()
  const data = usage.data
  const limit = data?.limits.apiCallsPerMonth ?? 0
  const used = data?.usage.apiCallsThisMonth ?? 0
  const unlimited = isUnlimited(limit)
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))

  return (
    <Card>
      <CardHeader
        action={
          <Link
            to="/app/settings"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
          >
            플랜 <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <CardTitle>
          <span className="flex items-center gap-2">
            <Gauge className="size-4 text-text-subtle" />
            이번 달 API 호출
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {usage.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : isForbidden(usage.error) ? (
          <PermissionNote />
        ) : usage.isError || !data ? (
          <p className="py-8 text-center text-[0.8125rem] text-text-subtle">
            사용량을 불러오지 못했습니다.
          </p>
        ) : (
          <>
            <p className="text-2xl font-semibold tracking-tight text-text">
              {used.toLocaleString('ko-KR')}
              <span className="ml-1 text-sm font-normal text-text-subtle">
                / {formatPlanLimit(limit)}
                {unlimited ? '' : '회'}
              </span>
            </p>
            {unlimited ? null : (
              <div
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="이번 달 API 호출 사용률"
              >
                <div
                  className={cn(
                    'h-full',
                    pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-accent'
                  )}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            )}
            <p className="mt-2.5 text-xs text-text-muted">
              <Badge tone="outline" size="sm">
                {PLAN_LABELS[data.plan]}
              </Badge>
              <span className="ml-1.5">
                {data.month} (UTC) · {unlimited ? '무제한 플랜' : `${pct}% 사용`}
              </span>
            </p>
            {!unlimited && pct >= 80 ? (
              <p className="mt-1.5 text-xs text-warning">
                한도에 가까워지고 있습니다 — 설정에서 플랜을 올리면 한도가 늘어납니다.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ApiKeyUsageCard() {
  const usage = useApiKeyUsage()
  const keys = usage.data?.keys ?? []

  return (
    <Card>
      <CardHeader
        action={
          <Link
            to="/app/api-keys"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
          >
            관리 <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <CardTitle>
          <span className="flex items-center gap-2">
            <KeyRound className="size-4 text-text-subtle" />
            API 키 사용
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {usage.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isForbidden(usage.error) ? (
          <PermissionNote />
        ) : usage.isError ? (
          <p className="py-8 text-center text-[0.8125rem] text-text-subtle">
            사용 현황을 불러오지 못했습니다.
          </p>
        ) : keys.length === 0 ? (
          <EmptyState
            className="border-0 px-2 py-8"
            title="발급된 API 키가 없습니다"
            description="API 키를 발급하면 SDK 연동과 함께 사용 현황이 여기에 표시됩니다."
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {keys.slice(0, 4).map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2 py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium text-text">{k.name}</p>
                    <p className="font-mono text-xs text-text-subtle">{k.keyPrefix}…</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {k.revokedAt ? (
                      <Badge tone="outline" size="sm">
                        폐기됨
                      </Badge>
                    ) : (
                      <p className="text-xs text-text-muted">
                        {k.lastUsedAt ? formatRelative(k.lastUsedAt) : '미사용'}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-subtle">
              최근 30일 API 동의 기록{' '}
              <span className="font-semibold text-text">{usage.data?.consentWrites30d ?? 0}건</span>{' '}
              · 감사 로그 집계
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
