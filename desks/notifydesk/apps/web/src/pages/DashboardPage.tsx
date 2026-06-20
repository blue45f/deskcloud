import { ArrowRight, FileStack, Gauge, Inbox, Send } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { useSessionStore } from '@/app/sessionStore'
import { SendComposer } from '@/components/feature/SendComposer'
import { StatCard } from '@/components/feature/StatCard'
import { PlanBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSentLog, useTemplates, useTenant } from '@/services/notifications'
import { formatNumber } from '@/utils/format'

// free 플랜 기본 소프트 캡(서버 기본값과 동일; 표시용 근사).
const FREE_CAP = 1000

export default function DashboardPage() {
  useDocumentTitle('대시보드')
  const tenant = useTenant()
  const templates = useTemplates()
  const sent = useSentLog(0, 1)
  const setPublishableKey = useSessionStore((s) => s.setPublishableKey)
  const sessionPk = useSessionStore((s) => s.session.publishableKey)

  // 테넌트 조회로 publishable 키를 알게 되면 세션에 보강(인박스 프리뷰용).
  const tenantPk = tenant.data?.publishableKey
  useEffect(() => {
    if (tenantPk && !sessionPk) setPublishableKey(tenantPk)
  }, [tenantPk, sessionPk, setPublishableKey])

  const usage = tenant.data?.usageCount ?? 0
  const plan = tenant.data?.plan ?? 'free'
  const total = sent.data?.totalCount ?? sent.data?.total ?? null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">대시보드</h1>
          <p className="mt-1 text-sm text-text-muted">
            {tenant.isLoading ? (
              '테넌트 정보를 불러오는 중…'
            ) : tenant.data ? (
              <>
                <span className="font-medium text-text">{tenant.data.name}</span>{' '}
                <span className="font-mono text-text-subtle">({tenant.data.slug})</span>
              </>
            ) : (
              '테넌트 정보를 불러올 수 없습니다.'
            )}
          </p>
        </div>
        {tenant.data ? <PlanBadge plan={tenant.data.plan} /> : null}
      </div>

      {/* 지표 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Send}
          label="누적 발송"
          value={tenant.isLoading ? <Skeleton className="h-8 w-16" /> : formatNumber(usage)}
          hint={plan === 'free' ? `free 캡 ${formatNumber(FREE_CAP)}` : 'pro · 무제한'}
          tone="accent"
        />
        <StatCard
          icon={Inbox}
          label="발송 로그"
          value={sent.isLoading ? <Skeleton className="h-8 w-16" /> : formatNumber(total ?? 0)}
          hint="인박스(in_app)에 쌓인 건수"
        />
        <StatCard
          icon={FileStack}
          label="템플릿"
          value={
            templates.isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              formatNumber(templates.data?.length ?? 0)
            )
          }
          hint="알림 종류 정의"
        />
        <StatCard
          icon={Gauge}
          label="요금제"
          value={plan === 'pro' ? 'Pro' : 'Free'}
          hint={
            plan === 'free' ? `사용량 ${formatNumber(usage)} / ${formatNumber(FREE_CAP)}` : '무제한'
          }
          tone={plan === 'pro' ? 'success' : 'neutral'}
        />
      </div>

      {/* 발송 컴포저 */}
      <Card>
        <CardHeader
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/sent">
                발송 로그 <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <CardTitle>알림 보내기</CardTitle>
          <CardDescription>
            템플릿을 렌더하거나 애드혹으로 보냅니다. 선호·소프트 캡이 서버에서 적용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <SendComposer templates={templates.data ?? []} />
          )}
        </CardContent>
      </Card>

      {/* 안내 */}
      {!templates.isLoading && !templates.isError && (templates.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileStack}
          title="아직 템플릿이 없습니다"
          description="자주 보내는 알림은 템플릿으로 만들면 변수만 넘겨 발송할 수 있습니다."
          action={
            <Button asChild size="sm" variant="accent">
              <Link to="/app/templates">템플릿 만들기</Link>
            </Button>
          }
        />
      ) : null}
    </div>
  )
}
