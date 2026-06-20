import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUSES,
  type InquiryAdminDto,
  type InquiryStatus,
} from '@desk/shared/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail, Moon, RefreshCw, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useTheme } from '@/app/ThemeContext'
import { Brand } from '@/components/layout/Brand'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Banner, EmptyState, Spinner } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { CONSOLE_API_READY, fetchInquiriesAdmin, updateInquiryStatus } from '@/services/api'

const APP_ID_KEY = 'dc-admin-inquiries-appid'
const TOKEN_KEY = 'dc-admin-token'

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
        <span className="font-mono">{inquiry.createdAt.slice(0, 16).replace('T', ' ')}</span>
      </div>
    </li>
  )
}

function InquiryList({
  appId,
  token,
  status,
}: {
  appId: string
  token: string
  status: InquiryStatus | ''
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-inquiries', appId, status],
    queryFn: () => fetchInquiriesAdmin(appId, token, { status: status || undefined, limit: 50 }),
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
      <EmptyState icon={Inbox} title="문의가 없습니다" description="아직 접수된 문의가 없어요." />
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
  const qc = useQueryClient()

  const apply = (nextAppId: string, nextToken: string) => {
    const a = nextAppId.trim().toLowerCase()
    const t = nextToken.trim()
    setAppId(a)
    setToken(t)
    writeStored(APP_ID_KEY, a)
    writeStored(TOKEN_KEY, t)
    void qc.invalidateQueries({ queryKey: ['admin-inquiries'] })
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
        className="mx-auto max-w-5xl px-4 py-8 outline-none sm:px-6"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-text">문의 관리</h1>
          <p className="mt-1 text-sm text-text-muted">
            전체 Desk 패밀리 앱이 공개 API 로 보낸 문의를 한곳에서 분류·처리합니다.
          </p>
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
              <Field label="앱 ID" htmlFor="inq-app" hint="형제 앱 식별자 (예: rotifolk)">
                <Input
                  id="inq-app"
                  name="appId"
                  defaultValue={appId}
                  placeholder="rotifolk"
                  autoComplete="off"
                />
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

        <Card>
          <CardHeader
            action={
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
            }
          >
            <CardTitle>{appId ? `${appId} 문의` : '문의'}</CardTitle>
          </CardHeader>
          <InquiryList appId={appId} token={token} status={status} />
        </Card>
      </main>
    </div>
  )
}
