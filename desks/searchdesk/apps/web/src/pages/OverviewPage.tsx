import { maskKey } from '@searchdesk/shared'
import { ArrowUpRight, Command, FileText, Gauge, RotateCcw, Search, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuthStore } from '@/app/authStore'
import { StatCard } from '@/components/feature/StatCard'
import { PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton, EmptyState, Skeleton } from '@/components/ui/feedback'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { useTenant, useUsage } from '@/services/searchdesk'

function StatsRow() {
  const usage = useUsage()

  if (usage.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }
  if (usage.isError || !usage.data) {
    const msg =
      usage.error instanceof ApiError ? usage.error.message : '사용량을 불러오지 못했습니다.'
    return (
      <EmptyState
        icon={Gauge}
        title="사용량을 불러올 수 없습니다"
        description={msg}
        action={
          <Button size="sm" variant="secondary" onClick={() => void usage.refetch()}>
            <RotateCcw className="size-4" /> 다시 시도
          </Button>
        }
      />
    )
  }

  const u = usage.data
  const capPct = u.docCap ? Math.min(100, Math.round((u.docCount / u.docCap) * 100)) : null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        icon={FileText}
        label="색인 문서"
        value={u.docCount.toLocaleString()}
        hint={u.docCap ? `free 캡 ${u.docCap.toLocaleString()}건` : 'pro · 무제한'}
        tone="accent"
      />
      <StatCard
        icon={Search}
        label="누적 검색 호출"
        value={u.searchCount.toLocaleString()}
        hint="publishable 키 검색"
        tone="info"
      />
      <StatCard
        icon={Gauge}
        label="요금제 사용률"
        value={capPct != null ? `${capPct}%` : '∞'}
        hint={
          capPct != null
            ? `${u.docCount.toLocaleString()} / ${u.docCap?.toLocaleString()}`
            : '캡 없음(pro)'
        }
        tone={capPct != null && capPct >= 90 ? 'danger' : 'success'}
      />
    </div>
  )
}

export default function OverviewPage() {
  useDocumentTitle('개요')
  const tenant = useTenant()
  const creds = useAuthStore((s) => s.creds)

  const pk = tenant.data?.publishableKey ?? creds.publishableKey

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            {tenant.data ? tenant.data.name : '개요'}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-text-muted">
            {tenant.data ? (
              <>
                <span className="font-mono text-xs">{tenant.data.slug}</span>
                <PlanBadge plan={tenant.data.plan} />
              </>
            ) : (
              '테넌트 개요와 사용량'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/documents">
              <FileText className="size-4" /> 문서 관리
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/app/search">
              <Search className="size-4" /> 검색 테스터
            </Link>
          </Button>
        </div>
      </header>

      <StatsRow />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Publishable 키</CardTitle>
            <CardDescription>브라우저 검색·임베드에 사용(노출 안전).</CardDescription>
          </CardHeader>
          <CardContent>
            {pk ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2.5">
                <code className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-text">
                  {pk}
                </code>
                <CopyButton value={pk} label="publishable 키 복사" />
              </div>
            ) : (
              <p className="text-sm text-text-subtle">
                키를 찾을 수 없습니다. 설정에서 키 로테이션으로 다시 발급할 수 있습니다.
              </p>
            )}
            <p className="mt-3 text-xs text-text-subtle">
              secret 키(sk_)는 보안상 다시 표시되지 않습니다 —{' '}
              <Link to="/app/settings" className="text-accent-strong hover:text-accent">
                설정
              </Link>{' '}
              에서 로테이션하세요.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>빠른 작업</CardTitle>
            <CardDescription>가입 → 색인 → 검색 → 임베드</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickLink to="/app/documents" icon={FileText} label="문서 추가 · 일괄 임포트" />
            <QuickLink to="/app/search" icon={Search} label="라이브 검색 테스터" />
            <QuickLink to="/app/embed" icon={Command} label="⌘K 임베드 스니펫" />
            <QuickLink to="/app/settings" icon={Settings} label="CORS · 플랜 · 키 로테이션" />
          </CardContent>
        </Card>
      </div>

      {tenant.data ? (
        <p className="text-xs text-text-subtle">
          어드민 토큰 경로용 테넌트 id:{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-text">
            {tenant.data.id}
          </code>{' '}
          · 인증된 키 미리보기:{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-text">
            {creds.via === 'secret'
              ? maskKey(creds.secretKey || 'sk_…')
              : `admin · ${creds.tenantId}`}
          </code>
        </p>
      ) : null}
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: typeof FileText
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="size-4 text-accent-strong" aria-hidden />
        {label}
      </span>
      <ArrowUpRight className="size-4 text-text-subtle" aria-hidden />
    </Link>
  )
}
