import { PLAN_LIMITS, UNLIMITED } from '@desk/shared/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Database,
  Globe2,
  KeyRound,
  LayoutGrid,
  ListChecks,
  RotateCw,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import type { TenantDto, TenantWithSecretDto, UsageMetric } from '@desk/shared/browser'

import { useTheme } from '@/app/ThemeContext'
import { ConsolePreviewNotice } from '@/components/ConsolePreviewNotice'
import { DeskGlyph } from '@/components/feature/DeskGlyph'
import { Badge, type BadgeProps, PlanBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  deskDetails,
  deskMicrositePath,
  deskOperations,
  deskReadiness,
  type ReadinessStatus,
} from '@/data/deskCatalog'
import {
  buildWorkspaceDeskConsoleState,
  type WorkspaceDeskConsoleItem,
} from '@/data/workspaceDeskConsole'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { PoweredByDeskCloud } from '@/PoweredByDeskCloud'
import {
  CONSOLE_API_READY,
  cancelSubscription,
  fetchPlans,
  fetchSubscription,
  fetchTenant,
  fetchWorkspaceDesksManifest,
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

const READINESS_STATUS_META: Record<ReadinessStatus, { label: string; tone: BadgeProps['tone'] }> =
  {
    ready: { label: '통합됨', tone: 'success' },
    needs_config: { label: '설정 필요', tone: 'warning' },
    watch: { label: '관찰', tone: 'info' },
  }

function originLabel(origin: string): string {
  if (origin === '*') return '전체 origin'
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

function AdminCommandCenter({ tenant }: { tenant?: TenantDto }) {
  const origins = tenant?.corsOrigins ?? []
  const domainLabel = origins.includes('*')
    ? '전체 허용'
    : origins.length > 0
      ? `${origins.length}개`
      : '미등록'

  const stats = [
    {
      icon: Building2,
      label: '가입회사',
      value: tenant?.name ?? '콘솔 프리뷰',
      helper: tenant?.slug ? `tenant:${tenant.slug}` : '테넌트 연결 후 자동 표시',
    },
    {
      icon: Globe2,
      label: '서비스 도메인',
      value: domainLabel,
      helper: 'CORS allowlist로 브라우저 SDK 범위 제한',
    },
    {
      icon: LayoutGrid,
      label: '운영 Desk',
      value: `${PRODUCT_DESKS.length}개`,
      helper: '같은 계정·키·빌링으로 통합 관리',
    },
    {
      icon: ShieldCheck,
      label: '격리 경계',
      value: 'Tenant + Origin',
      helper: '서비스 도메인별 데이터 접근 범위 분리',
    },
  ]

  const flow = [
    {
      title: '회사 테넌트',
      description: '가입회사 단위로 플랜, 키, 사용량, 결제 상태를 하나로 묶습니다.',
    },
    {
      title: '서비스 도메인',
      description: '실제 제품 도메인을 origin allowlist에 등록해 브라우저 호출을 제한합니다.',
    },
    {
      title: 'Desk 운영 표면',
      description: '약관, 설문, 검색, 알림 등 각 Desk는 같은 테넌트 안에서 운영 큐를 나눕니다.',
    },
    {
      title: '사용량/빌링',
      description: '도메인과 Desk가 달라도 월간 사용량은 테넌트 플랜 한도에 합산됩니다.',
    },
  ]

  return (
    <Card>
      <CardHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <a href="#domain-isolation">
              도메인 격리 <ArrowRight className="size-4" />
            </a>
          </Button>
        }
      >
        <CardTitle>통합 운영 콘솔</CardTitle>
        <CardDescription>
          가입회사, 서비스 도메인, Desk, 키, 사용량, 빌링을 한 화면의 운영 단위로 묶습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-md bg-surface-2 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-text-subtle">
                <item.icon className="size-4 text-accent-strong" aria-hidden />
                <span>{item.label}</span>
              </div>
              <p className="mt-2 truncate text-base font-semibold text-text">{item.value}</p>
              <p className="mt-1 text-[0.75rem] leading-5 text-text-muted">{item.helper}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          {flow.map((item, index) => (
            <div key={item.title} className="rounded-md border border-border bg-surface p-4">
              <span className="font-mono text-[0.6875rem] text-accent-strong">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-text">{item.title}</h3>
              <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-dashed border-border px-4 py-3">
          <p className="text-sm text-text-muted">
            SEOGatewayDesk와 RemoteDevTools처럼 자체 런타임을 가진 Desk도 같은 운영 콘솔에서
            관리합니다. 서비스 도메인, gateway path, 사용량 메트릭을 가입회사 테넌트에 묶고 소스는
            deskcloud workspace에서 함께 검증합니다.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function DomainIsolationPanel({ tenant }: { tenant?: TenantDto }) {
  const origins = tenant?.corsOrigins ?? []
  const hasOrigins = origins.length > 0

  return (
    <Card id="domain-isolation">
      <CardHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <a href="#settings">도메인 설정</a>
          </Button>
        }
      >
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="size-4" aria-hidden /> 서비스 도메인 격리
          </span>
        </CardTitle>
        <CardDescription>
          가입회사 테넌트 안에서 서비스 도메인별 브라우저 SDK 호출 범위를 분리합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasOrigins ? (
          <Banner tone="warning">
            등록된 서비스 도메인이 없습니다. 운영 배포 전 실제 origin을 등록해 pk_ 키 호출 범위를
            제한하세요.
          </Banner>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <SectionTitle>등록된 서비스 도메인</SectionTitle>
            <div className="grid gap-2">
              {(hasOrigins ? origins : ['https://app.example.com']).map((origin) => (
                <div
                  key={origin}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5',
                    hasOrigins
                      ? 'border-border bg-surface'
                      : 'border-dashed border-border bg-surface-2'
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text">
                      {originLabel(origin)}
                    </span>
                    <code className="mt-0.5 block truncate text-[0.75rem] text-text-muted">
                      {origin}
                    </code>
                  </span>
                  <Badge tone={hasOrigins ? 'success' : 'warning'} size="sm" dot={hasOrigins}>
                    {hasOrigins ? '격리 적용' : '예시'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>격리 규칙</SectionTitle>
            <ul className="space-y-2 text-sm text-text-muted">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>
                  브라우저 호출은 <strong className="text-text">pk_ 키 + origin allowlist</strong>로
                  제한합니다.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>
                  서버 운영 작업은 <strong className="text-text">sk_ 키</strong>를 가진
                  BFF/API에서만 실행합니다.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>
                  사용량과 플랜은 가입회사 테넌트 단위로 합산하고 Desk별 메트릭으로 나눠 봅니다.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const WORKSPACE_DESK_BOUNDARY: Record<
  string,
  {
    controlPlane: string
    dataPlane: string
    adminSurface: string
    verification: readonly string[]
  }
> = {
  aidigestdesk: {
    controlPlane: 'DeskCloud tenant, service origin, content usage, editorial exports',
    dataPlane: 'Vite portal, GitHub Pages fallback, @aidigestdesk/content source snapshots',
    adminSurface: 'Source monitor queue, update pipeline, newsletter/export runbook',
    verification: ['workspace package', 'content snapshot', 'Pages base path', 'editorial export'],
  },
  'seo-gateway': {
    controlPlane: 'DeskCloud tenant, service origin, usage, billing, plan limit',
    dataPlane: 'Fastify render gateway, Puppeteer pool, cache/SWR, SEO quality gates',
    adminSurface: 'Route rules, cache warm/invalidate, Lighthouse/VisualDiff review',
    verification: ['workspace package', 'gateway route', 'render metric', 'origin allowlist'],
  },
  'remote-devtools': {
    controlPlane: 'DeskCloud tenant, service origin, usage, billing, integration status',
    dataPlane: 'NestJS/TypeORM CDP gateway, rrweb replay, S3 backup, issue integrations',
    adminSurface: 'Live sessions, replay queue, SDK domain policy, Jira/Slack/Sheets status',
    verification: ['workspace package', 'WS gateway', 'session metric', 'org/origin namespace'],
  },
}

const WORKSPACE_DESKS = PRODUCT_DESKS.filter((desk) => desk.integrationMode === 'workspace')

const WORKSPACE_SYNC_META: Record<
  WorkspaceDeskConsoleItem['syncStatus'],
  { label: string; tone: BadgeProps['tone'] }
> = {
  api_synced: { label: 'API 동기화', tone: 'success' },
  api_field_mismatch: { label: '필드 불일치', tone: 'warning' },
  api_missing: { label: 'API 누락', tone: 'danger' },
}

function workspaceSyncBadge(
  item: WorkspaceDeskConsoleItem,
  apiReachable: boolean
): { label: string; tone: BadgeProps['tone']; dot: boolean } {
  if (!apiReachable) return { label: 'catalog fallback', tone: 'neutral', dot: false }
  const meta = WORKSPACE_SYNC_META[item.syncStatus]
  return { ...meta, dot: meta.tone === 'success' }
}

function WorkspaceDeskPanel({ tenant }: { tenant?: TenantDto }) {
  const manifestQuery = useQuery({
    queryKey: ['workspace-desks-manifest'],
    queryFn: fetchWorkspaceDesksManifest,
    staleTime: 60_000,
  })
  const consoleState = useMemo(
    () => buildWorkspaceDeskConsoleState(WORKSPACE_DESKS, manifestQuery.data),
    [manifestQuery.data]
  )
  const parityIssues =
    consoleState.missingFromApi.length +
    consoleState.extraFromApi.length +
    consoleState.items.filter((item) => item.syncStatus === 'api_field_mismatch').length
  const catalogParityOk = consoleState.apiReachable && parityIssues === 0

  if (WORKSPACE_DESKS.length === 0) return null

  const domainCount = tenant?.corsOrigins.length ?? 0

  return (
    <Card id="workspace-desks">
      <CardHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <a href="#desk-operations">
              운영 허브 <ArrowRight className="size-4" />
            </a>
          </Button>
        }
      >
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Database className="size-4" aria-hidden /> Workspace Desk 통합 상태
          </span>
        </CardTitle>
        <CardDescription>
          별도 저장소로 운영하던 개발자 도구형 Desk를 DeskCloud 계정·도메인·요금·사용량 콘솔
          아래에서 관리합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md bg-surface-2 p-4">
            <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
              Manifest API
            </p>
            <p className="mt-1 text-xl font-semibold text-text">
              {manifestQuery.isLoading ? '확인 중' : manifestQuery.isError ? '연결 실패' : '연결됨'}
            </p>
            <p className="mt-1 text-[0.75rem] leading-5 text-text-muted">
              /api/workspace-desks 운영 응답 기준
            </p>
          </div>
          <div className="rounded-md bg-surface-2 p-4">
            <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
              Workspace desks
            </p>
            <p className="mt-1 text-xl font-semibold text-text">
              {consoleState.catalogItemCount}개
            </p>
            <p className="mt-1 text-[0.75rem] leading-5 text-text-muted">
              {consoleState.apiReachable
                ? `운영 API ${consoleState.apiItemCount}개와 대조`
                : '정적 catalog fallback 표시'}
            </p>
          </div>
          <div className="rounded-md bg-surface-2 p-4">
            <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
              Catalog parity
            </p>
            <p className="mt-1 text-xl font-semibold text-text">
              {catalogParityOk ? '일치' : consoleState.apiReachable ? `${parityIssues}건` : '대기'}
            </p>
            <p className="mt-1 text-[0.75rem] leading-5 text-text-muted">
              API manifest와 정적 운영 catalog 동기화
            </p>
          </div>
          <div className="rounded-md bg-surface-2 p-4">
            <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
              Control plane
            </p>
            <p className="mt-1 text-xl font-semibold text-text">
              {consoleState.policyVerified ? '통합 운영' : '확인 필요'}
            </p>
            <p className="mt-1 text-[0.75rem] leading-5 text-text-muted">
              {domainCount > 0 ? `${domainCount}개 origin 격리 적용` : 'origin 등록 후 격리 적용'}
            </p>
          </div>
        </div>

        {manifestQuery.isLoading ? (
          <Banner tone="info">
            <span className="inline-flex items-center gap-2">
              <Spinner /> 운영 workspace manifest 연결을 확인하고 있습니다.
            </span>
          </Banner>
        ) : null}
        {manifestQuery.isError ? (
          <Banner tone="warning">
            운영 workspace manifest API에 연결하지 못했습니다. 콘솔은 정적 catalog fallback으로 계속
            표시되며, 배포 게이트웨이 또는 /api/workspace-desks 상태를 확인해야 합니다.{' '}
            {(manifestQuery.error as Error).message}
          </Banner>
        ) : null}
        {catalogParityOk ? (
          <Banner tone="success">
            운영 API manifest와 웹 catalog가 일치합니다. SEOGatewayDesk와 RemoteDevTools는 분리
            운영이 아니라 DeskCloud control-plane의 workspace Desk로 검증 중입니다.
          </Banner>
        ) : consoleState.apiReachable ? (
          <Banner tone="warning">
            운영 API와 catalog가 일치하지 않습니다.
            {consoleState.missingFromApi.length > 0
              ? ` API 누락: ${consoleState.missingFromApi.join(', ')}.`
              : ''}
            {consoleState.extraFromApi.length > 0
              ? ` API 초과: ${consoleState.extraFromApi.join(', ')}.`
              : ''}
          </Banner>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          {consoleState.items.map((item) => {
            const { desk, apiItem } = item
            const operations = deskOperations(desk)
            const detail = deskDetails(desk)
            const boundary = WORKSPACE_DESK_BOUNDARY[desk.id]
            const sync = workspaceSyncBadge(item, consoleState.apiReachable)
            const controlPlane = apiItem?.controlPlane ?? boundary?.controlPlane
            const dataPlane = apiItem?.dataPlane ?? boundary?.dataPlane
            const readinessSummary = apiItem?.readinessSummary ?? detail.domainIsolation

            return (
              <div key={desk.id} className="rounded-md border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <DeskGlyph icon={desk.icon} tone={desk.tone} size="sm" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-text">{desk.name}</h3>
                        <Badge tone={sync.tone} size="sm" dot={sync.dot}>
                          {sync.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                        {desk.tagline}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={deskMicrositePath(desk)}>상세</Link>
                  </Button>
                </div>

                <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0 rounded-md bg-surface-2 p-3">
                    <dt className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                      Source
                    </dt>
                    <dd className="mt-1 truncate font-mono text-[0.8125rem] text-text">
                      {apiItem?.workspacePath ?? desk.workspacePath}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-md bg-surface-2 p-3">
                    <dt className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                      Package
                    </dt>
                    <dd className="mt-1 truncate font-mono text-[0.8125rem] text-text">
                      {apiItem?.integrationPackage ?? desk.integrationPackage}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-md bg-surface-2 p-3">
                    <dt className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                      Gateway
                    </dt>
                    <dd className="mt-1 truncate font-mono text-[0.8125rem] text-text">
                      {apiItem?.gatewayPath ?? operations.gatewayPath}
                    </dd>
                  </div>
                  <div className="min-w-0 rounded-md bg-surface-2 p-3">
                    <dt className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                      Metric
                    </dt>
                    <dd className="mt-1 text-[0.8125rem] font-semibold text-text">
                      {USAGE_METRIC_LABEL[apiItem?.primaryMetric ?? operations.primaryMetric]}
                    </dd>
                  </div>
                </dl>

                {consoleState.apiReachable && item.mismatchedFields.length > 0 ? (
                  <Banner tone="warning" className="mt-4">
                    Manifest 불일치 필드: {item.mismatchedFields.join(', ')}
                  </Banner>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <SectionTitle>통합 경계</SectionTitle>
                    <ul className="space-y-2 text-[0.8125rem] leading-5 text-text-muted">
                      <li>
                        <strong className="text-text">Control:</strong>{' '}
                        {controlPlane ?? 'DeskCloud account and billing control plane'}
                      </li>
                      <li>
                        <strong className="text-text">Data:</strong>{' '}
                        {dataPlane ?? detail.domainIsolation}
                      </li>
                      <li>
                        <strong className="text-text">Admin:</strong>{' '}
                        {boundary?.adminSurface ?? operations.operatorTasks.join(', ')}
                      </li>
                    </ul>
                  </div>
                  <div>
                    <SectionTitle>운영 검증</SectionTitle>
                    <ul className="flex flex-wrap gap-1.5">
                      {(boundary?.verification ?? operations.config).map((item) => (
                        <li key={item}>
                          <Badge tone="outline" size="sm">
                            {item}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[0.8125rem] leading-5 text-text-muted">
                      {readinessSummary}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
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
  const detail = deskDetails(selected)
  const readiness = deskReadiness(selected)
  const format = metricFormat(operations.primaryMetric)

  const selectDesk = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('desk', id)
    setParams(next, { replace: true })
  }

  return (
    <Card id="desk-operations">
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

            <div className="mt-5 rounded-md border border-border bg-surface p-4">
              <SectionTitle>서비스 상세</SectionTitle>
              <p className="text-sm leading-6 text-text-muted">{detail.summary}</p>
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

            <div className="mt-5 rounded-md border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <SectionTitle>통합 운영 준비도</SectionTitle>
                  <p className="max-w-3xl text-sm leading-6 text-text-muted">{readiness.summary}</p>
                </div>
                <Badge tone="accent" size="sm">
                  DeskCloud control-plane
                </Badge>
              </div>

              <dl className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="min-w-0 rounded-md bg-surface-2 p-3">
                  <dt className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                    Control plane
                  </dt>
                  <dd className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                    {readiness.controlPlane}
                  </dd>
                </div>
                <div className="min-w-0 rounded-md bg-surface-2 p-3">
                  <dt className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">
                    Data plane
                  </dt>
                  <dd className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                    {readiness.dataPlane}
                  </dd>
                </div>
              </dl>

              <ul className="mt-3 grid gap-2 xl:grid-cols-2">
                {readiness.checks.map((check) => {
                  const meta = READINESS_STATUS_META[check.status]

                  return (
                    <li key={check.label} className="rounded-md bg-surface-2 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-text">{check.label}</p>
                        <Badge tone={meta.tone} size="sm" dot={check.status === 'ready'}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                        {check.description}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <SectionTitle>도메인 격리 방식</SectionTitle>
                <p className="rounded-md bg-surface-2 p-3 text-sm leading-6 text-text-muted">
                  {detail.domainIsolation}
                </p>
              </div>
              <div>
                <SectionTitle>대표 사용처</SectionTitle>
                <ul className="grid gap-2">
                  {detail.bestFor.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-text-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
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

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <SectionTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <Database className="size-3.5" aria-hidden /> 관리 데이터
                  </span>
                </SectionTitle>
                <dl className="space-y-2">
                  {detail.dataModel.slice(0, 4).map((item) => (
                    <div key={item.name} className="rounded-md bg-surface-2 p-3">
                      <dt className="text-sm font-semibold text-text">{item.name}</dt>
                      <dd className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                        {item.description}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <SectionTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="size-3.5" aria-hidden /> 운영 런북
                  </span>
                </SectionTitle>
                <ol className="space-y-2">
                  {detail.adminGuide.map((item, index) => (
                    <li key={item.title} className="rounded-md bg-surface-2 p-3">
                      <p className="text-sm font-semibold text-text">
                        {index + 1}. {item.title}
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ol>
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
    <Card id="settings">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Settings className="size-4" aria-hidden /> 회사·서비스 도메인 설정
          </span>
        </CardTitle>
        <CardDescription>
          가입회사 이름과 브라우저 SDK 호출을 허용할 서비스 도메인 origin을 관리합니다.
        </CardDescription>
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
            label="서비스 도메인 Origins"
            htmlFor="set-cors"
            hint="줄바꿈 또는 쉼표로 구분합니다. 운영에서는 실제 서비스 origin만 등록하세요. 예: https://app.example.com"
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
          <div className="rounded-md bg-surface-2 px-3 py-2.5 text-[0.8125rem] leading-5 text-text-muted">
            <strong className="text-text">격리 기준:</strong> 같은 가입회사 테넌트 안에서 여러
            서비스 도메인을 운영할 수 있습니다. 등록되지 않은 origin의 브라우저 SDK 호출은 차단하고,
            서버 운영 작업은 secret key가 있는 BFF/API에서만 수행하세요.
          </div>
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
        <AdminCommandCenter />
        <DomainIsolationPanel />
        <WorkspaceDeskPanel />
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

      <AdminCommandCenter tenant={tenant} />

      <div className="grid gap-6 lg:grid-cols-2">
        <UsagePanel />
        <KeysPanel />
      </div>

      <DomainIsolationPanel tenant={tenant} />

      <WorkspaceDeskPanel tenant={tenant} />

      <BillingPanel />

      <DeskOperationsHub />

      <SettingsPanel />
    </div>
  )
}
