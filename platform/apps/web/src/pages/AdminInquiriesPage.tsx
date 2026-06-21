import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUSES,
  type InquiryAdminDto,
  type InquiryStatus,
} from '@desk/shared/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Globe2, Inbox, Mail, Moon, RefreshCw, ShieldCheck, Sun, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, EmptyState, Spinner } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import {
  buildAdminInquirySummary,
  inquiryOriginHost,
  type AdminInquirySummary,
  type InquiryOriginFacet,
} from '@/data/adminInquiries'
import { PRODUCT_DESKS } from '@/data/deskCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { CONSOLE_API_READY, fetchInquiriesAdmin, updateInquiryStatus } from '@/services/api'

const APP_ID_KEY = 'dc-admin-inquiries-appid'
const TOKEN_KEY = 'dc-admin-token'

const ADMIN_APP_OPTIONS = PRODUCT_DESKS.map((desk) => ({
  id: desk.id,
  name: desk.name,
  tagline: desk.tagline,
})).toSorted((a, b) => a.name.localeCompare(b.name))

function readStored(key: string): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(key) ?? ''
}

function writeStored(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
}

const STATUS_TONE: Record<InquiryStatus, BadgeProps['tone']> = {
  new: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
}

function SummaryStat({
  label,
  value,
  helper,
}: {
  label: string
  value: string | number
  helper: string
}) {
  return (
    <div className="rounded-md bg-surface-2 p-4">
      <p className="text-[0.6875rem] tracking-wide text-text-subtle uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-[0.75rem] leading-5 text-text-muted">{helper}</p>
    </div>
  )
}

function DomainFacetButton({
  facet,
  selected,
  onSelect,
}: {
  facet: InquiryOriginFacet
  selected: boolean
  onSelect: (host: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(facet.host)}
      className={[
        'flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-accent-strong bg-accent-soft text-accent-fg'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2',
      ].join(' ')}
      aria-pressed={selected}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{facet.host}</span>
        <span className="block text-[0.75rem] opacity-75">미처리 {facet.openCount}건</span>
      </span>
      <Badge tone={selected ? 'accent' : 'outline'} size="sm">
        {facet.count}
      </Badge>
    </button>
  )
}

function AdminInquirySummaryPanel({
  appId,
  token,
  selectedOriginHost,
  onSelectOriginHost,
}: {
  appId: string
  token: string
  selectedOriginHost: string
  onSelectOriginHost: (host: string) => void
}) {
  const enabled = appId.length > 0 && token.length > 0
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-inquiries-summary', appId],
    queryFn: () => fetchInquiriesAdmin(appId, token, { limit: 50 }),
    enabled,
    staleTime: 30_000,
  })
  const summary: AdminInquirySummary = useMemo(
    () => buildAdminInquirySummary(data?.items ?? []),
    [data?.items]
  )

  if (!enabled) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>통합 문의 운영 상태</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isError ? (
          <Banner tone="warning">
            문의 요약을 불러오지 못했습니다. {(error as Error).message}
          </Banner>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat
            label="전체 문의"
            value={isLoading ? '확인 중' : summary.total}
            helper="최근 50건 기준 운영 큐"
          />
          <SummaryStat
            label="미처리"
            value={isLoading ? '확인 중' : summary.open}
            helper="new + in progress"
          />
          <SummaryStat
            label="서비스 도메인"
            value={isLoading ? '확인 중' : summary.origins.length}
            helper="origin host 기준 격리"
          />
          <SummaryStat
            label="출처 미확인"
            value={isLoading ? '확인 중' : summary.missingOrigin}
            helper="originUrl 없이 접수된 문의"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-text">서비스 도메인 필터</h2>
              {selectedOriginHost ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectOriginHost('')}
                >
                  <X className="size-4" /> 해제
                </Button>
              ) : null}
            </div>
            {summary.origins.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {summary.origins.map((facet) => (
                  <DomainFacetButton
                    key={facet.host}
                    facet={facet}
                    selected={selectedOriginHost === facet.host}
                    onSelect={onSelectOriginHost}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-surface-2 p-4 text-sm text-text-muted">
                출처 URL이 있는 문의가 쌓이면 서비스 도메인별 필터가 표시됩니다.
              </div>
            )}
          </div>

          <div className="rounded-md border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-text">상태 분포</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {INQUIRY_STATUSES.map((status) => (
                <div key={status} className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-2 text-text-muted">
                    <Badge tone={STATUS_TONE[status]} size="sm">
                      {INQUIRY_STATUS_LABELS[status]}
                    </Badge>
                  </dt>
                  <dd className="font-mono text-text">{summary.statusCounts[status]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      onClick={toggle}
      aria-label={resolved === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {resolved === 'dark' ? (
        <Sun className="size-[1.05rem]" />
      ) : (
        <Moon className="size-[1.05rem]" />
      )}
    </Button>
  )
}

function StatusControl({
  inquiry,
  appId,
  token,
}: {
  inquiry: InquiryAdminDto
  appId: string
  token: string
}) {
  const qc = useQueryClient()
  const mutate = useMutation({
    mutationFn: (status: InquiryStatus) => updateInquiryStatus(appId, inquiry.id, status, token),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-inquiries'] }),
  })
  return (
    <div className="flex items-center gap-2">
      <Badge tone={STATUS_TONE[inquiry.status]}>{INQUIRY_STATUS_LABELS[inquiry.status]}</Badge>
      <Select
        aria-label="상태 변경"
        className="h-8 w-32 text-xs"
        value={inquiry.status}
        disabled={mutate.isPending}
        onChange={(e) => mutate.mutate(e.target.value as InquiryStatus)}
      >
        {INQUIRY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {INQUIRY_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {mutate.isPending ? <Spinner /> : null}
    </div>
  )
}

function InquiryRow({
  inquiry,
  appId,
  token,
}: {
  inquiry: InquiryAdminDto
  appId: string
  token: string
}) {
  const originHost = inquiryOriginHost(inquiry)
  return (
    <li className="space-y-2 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline" size="sm">
              {INQUIRY_CATEGORY_LABELS[inquiry.category]}
            </Badge>
            <h3 className="text-sm font-semibold text-text">{inquiry.title}</h3>
          </div>
          <p className="mt-1 text-[0.8125rem] whitespace-pre-wrap text-text-muted">
            {inquiry.body}
          </p>
        </div>
        <StatusControl inquiry={inquiry} appId={appId} token={token} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-text-subtle">
        {inquiry.authorName ? <span>{inquiry.authorName}</span> : null}
        {inquiry.contactEmail ? (
          <a
            href={`mailto:${inquiry.contactEmail}`}
            className="inline-flex items-center gap-1 text-info hover:underline"
          >
            <Mail className="size-3" aria-hidden /> {inquiry.contactEmail}
          </a>
        ) : null}
        {inquiry.originUrl ? (
          <a
            href={inquiry.originUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate hover:underline"
          >
            {inquiry.originUrl}
          </a>
        ) : null}
        {originHost ? (
          <span className="inline-flex items-center gap-1 font-mono">
            <Globe2 className="size-3" aria-hidden /> {originHost}
          </span>
        ) : null}
        <span className="font-mono">{inquiry.createdAt.slice(0, 16).replace('T', ' ')}</span>
      </div>
    </li>
  )
}

function InquiryList({
  appId,
  token,
  status,
  originHost,
}: {
  appId: string
  token: string
  status: InquiryStatus | ''
  originHost: string
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-inquiries', appId, status, originHost],
    queryFn: () =>
      fetchInquiriesAdmin(appId, token, {
        status: status || undefined,
        originHost: originHost || undefined,
        limit: 50,
      }),
    enabled: appId.length > 0 && token.length > 0,
  })

  if (!appId || !token) {
    return (
      <EmptyState
        icon={Inbox}
        title="앱 ID와 어드민 토큰을 입력하세요"
        description="형제 앱 식별자(예: rotifolk)와 X-Admin-Token 을 입력하면 해당 앱의 문의를 불러옵니다."
      />
    )
  }
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-5 py-10 text-sm text-text-muted">
        <Spinner /> 불러오는 중…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="space-y-3 p-5">
        <Banner tone="error">{(error as Error).message}</Banner>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="size-4" /> 다시 시도
        </Button>
      </div>
    )
  }
  const items = data?.items ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="문의가 없습니다"
        description={
          originHost ? `${originHost} 조건에 맞는 문의가 없습니다.` : '아직 접수된 문의가 없어요.'
        }
      />
    )
  }
  return (
    <ul className="divide-y divide-border" aria-busy={isFetching || undefined}>
      {items.map((inq) => (
        <InquiryRow key={inq.id} inquiry={inq} appId={appId} token={token} />
      ))}
    </ul>
  )
}

/**
 * 어드민 문의 보드 — 형제 앱별 문의를 X-Admin-Token 으로 트리아지한다(공개 라우트지만
 * 데이터는 토큰으로 보호된다). appId·토큰은 localStorage 에 보관(sessionStore 와 동일한 단순 모델).
 */
export default function AdminInquiriesPage() {
  useDocumentTitle('문의 관리')
  const [appId, setAppId] = useState(() => readStored(APP_ID_KEY))
  const [token, setToken] = useState(() => readStored(TOKEN_KEY))
  const [status, setStatus] = useState<InquiryStatus | ''>('')
  const [originHost, setOriginHost] = useState('')
  const qc = useQueryClient()
  const selectedDesk = useMemo(() => ADMIN_APP_OPTIONS.find((desk) => desk.id === appId), [appId])

  const apply = (nextAppId: string, nextToken: string) => {
    const a = nextAppId.trim().toLowerCase()
    const t = nextToken.trim()
    setAppId(a)
    setToken(t)
    setOriginHost('')
    writeStored(APP_ID_KEY, a)
    writeStored(TOKEN_KEY, t)
    void qc.invalidateQueries({ queryKey: ['admin-inquiries'] })
    void qc.invalidateQueries({ queryKey: ['admin-inquiries-summary'] })
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="DeskCloud 홈">
            <Brand />
          </Link>
          <span className="hidden text-sm text-text-subtle sm:inline">/ 문의 관리</span>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">콘솔</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-8 outline-none sm:px-6"
      >
        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div>
            <Badge tone="accent" size="sm">
              Admin operations
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-text">문의 관리</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-text-muted">
              전체 Desk 패밀리 앱이 공개 API 로 보낸 문의를 한곳에서 분류·처리하고, 서비스 도메인
              origin host 기준으로 운영 큐를 격리합니다.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <ShieldCheck className="size-4 text-accent-strong" aria-hidden />
              통합 관리 경계
            </div>
            <p className="mt-1 text-[0.8125rem] leading-5 text-text-muted">
              appId, X-Admin-Token, originHost를 함께 사용해 앱별·서비스 도메인별 문의 접근을
              분리합니다.
            </p>
          </div>
        </div>

        {!CONSOLE_API_READY ? (
          <Banner tone="info" className="mb-6">
            이 빌드는 콘솔 API(VITE_API_BASE_URL)가 연결되지 않았습니다. API 서버가 동일
            출처(/api)로 프록시되는 dev 환경에서 동작합니다.
          </Banner>
        ) : null}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>조회 설정</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                apply(String(fd.get('appId') ?? ''), String(fd.get('token') ?? ''))
              }}
            >
              <Field
                label="서비스 앱"
                htmlFor="inq-app"
                hint={
                  selectedDesk
                    ? `${selectedDesk.name} · ${selectedDesk.tagline}`
                    : '형제 앱 또는 Desk 식별자'
                }
              >
                <Input
                  id="inq-app"
                  name="appId"
                  list="desk-admin-app-options"
                  defaultValue={appId}
                  placeholder="seo-gateway"
                  autoComplete="off"
                />
                <datalist id="desk-admin-app-options">
                  {ADMIN_APP_OPTIONS.map((desk) => (
                    <option key={desk.id} value={desk.id}>
                      {desk.name}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="X-Admin-Token" htmlFor="inq-token" hint="어드민 트리아지 토큰">
                <Input
                  id="inq-token"
                  name="token"
                  type="password"
                  defaultValue={token}
                  placeholder="admin token"
                  autoComplete="off"
                />
              </Field>
              <Button type="submit">불러오기</Button>
            </form>
          </CardContent>
        </Card>

        <AdminInquirySummaryPanel
          appId={appId}
          token={token}
          selectedOriginHost={originHost}
          onSelectOriginHost={setOriginHost}
        />

        <Card>
          <CardHeader
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {originHost ? (
                  <Badge tone="info" size="sm">
                    <Globe2 className="size-3" aria-hidden /> {originHost}
                  </Badge>
                ) : null}
                <Select
                  aria-label="상태 필터"
                  className="h-8 w-36 text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InquiryStatus | '')}
                >
                  <option value="">전체 상태</option>
                  {INQUIRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {INQUIRY_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
            }
          >
            <CardTitle>
              {appId ? (
                <span className="inline-flex items-center gap-2">
                  <Building2 className="size-4 text-accent-strong" aria-hidden />
                  {appId} 문의
                </span>
              ) : (
                '문의'
              )}
            </CardTitle>
          </CardHeader>
          <InquiryList appId={appId} token={token} status={status} originHost={originHost} />
        </Card>
      </main>
    </div>
  )
}
