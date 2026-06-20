import { Activity, Eye, RotateCw, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatCard } from '@/components/feature/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { useCredKey } from '@/hooks/useCredKey'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useStats } from '@/services/moderation'
import { formatNumber } from '@/utils/format'

/** 대시보드로 바로 이동할 빠른 링크(어드민 셸 하위 페이지). */
const QUICK_LINKS: { to: string; label: string; desc: string }[] = [
  { to: '/app/reports', label: '신고 큐', desc: '접수된 콘텐츠 신고 검토·전이' },
  { to: '/app/logs', label: '검사 로그', desc: '모든 모더레이션 검사 기록' },
  { to: '/app/test', label: '검사 테스트', desc: '텍스트를 직접 검사해보기' },
]

/**
 * 어드민 대시보드 — 트래픽/애널리틱스 요약 패널(4 지표) + 빠른 링크.
 *
 * 정직성(데이터 등급):
 *  - 총 트래픽 / 오늘 트래픽 = moderation_logs 실집계(검사=요청/활동 이벤트).
 *  - 오늘 방문자 = 고유 방문자 정밀값이 없어 distinct 출처(추정). '추정' 으로 명시.
 *  - 가입(오늘/총) = tenants 실집계. operator(글로벌 토큰) 면 플랫폼 전체, tenant(sk) 면 본인 기준.
 */
export default function DashboardPage() {
  useDocumentTitle('대시보드')
  const credKey = useCredKey()
  const statsQ = useStats(credKey)

  const stats = statsQ.data
  const isOperator = stats?.scope === 'operator'

  // 가입 카드 보조 라벨 — tenant 스코프면 "본인 기준", operator 면 "플랫폼 전체".
  const signupScopeHint = stats
    ? isOperator
      ? '플랫폼 전체(운영자)'
      : '내 계정 기준 · 운영자 전용 지표'
    : undefined

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">대시보드</h1>
          <p className="mt-1 max-w-2xl text-sm text-pretty text-text-muted">
            트래픽(검사)과 가입 추이를 한눈에 봅니다. 모든 수치는 실제 데이터 집계이며, 추정·운영자
            전용 지표는 카드에 명시합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats ? (
            <Badge tone={isOperator ? 'info' : 'accent'} size="sm">
              {isOperator ? '운영자(모든 테넌트)' : '테넌트(내 계정)'}
            </Badge>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void statsQ.refetch()}
            loading={statsQ.isFetching}
            aria-label="통계 새로고침"
          >
            <RotateCw className="size-4" />
            <span className="hidden sm:inline">새로고침</span>
          </Button>
        </div>
      </div>

      {/* 요약 패널 — 4 지표 */}
      {statsQ.isError ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Activity}
              title="통계를 불러오지 못했습니다"
              description={
                statsQ.error instanceof Error ? statsQ.error.message : '잠시 후 다시 시도해 주세요.'
              }
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void statsQ.refetch()}
                  loading={statsQ.isFetching}
                >
                  <RotateCw className="size-4" />
                  다시 시도
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : statsQ.isLoading && !stats ? (
        <section aria-label="요약 지표" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[7.5rem] w-full" />
          ))}
        </section>
      ) : (
        <section
          aria-label="트래픽·가입 요약 지표"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            icon={Eye}
            label="오늘 방문자 수 (추정)"
            value={formatNumber(stats?.visitors.today ?? 0)}
            hint="오늘 활동한 distinct 출처 · 고유 방문자 근사치"
            tone="info"
          />
          <StatCard
            icon={Activity}
            label="총 트래픽"
            value={formatNumber(stats?.traffic.total ?? 0)}
            hint={`오늘 +${formatNumber(stats?.traffic.today ?? 0)} · 누적 검사 수`}
            tone="accent"
          />
          <StatCard
            icon={UserPlus}
            label="오늘 신규 가입자 수"
            value={formatNumber(stats?.signups.today ?? 0)}
            hint={signupScopeHint}
            tone="success"
          />
          <StatCard
            icon={Users}
            label="총 가입 수"
            value={formatNumber(stats?.signups.total ?? 0)}
            hint={signupScopeHint}
          />
        </section>
      )}

      {/* 정직성 안내 — 어떤 수치가 실데이터/추정/운영자 전용인지 명시 */}
      {stats ? (
        <p className="text-xs text-pretty text-text-subtle">
          <Badge tone="neutral" size="sm">
            데이터
          </Badge>{' '}
          <span className="font-medium text-text-muted">트래픽</span> 은 검사(요청/활동) 로그의 실제
          집계입니다. <span className="font-medium text-text-muted">오늘 방문자</span> 는 검사에
          고유 사용자 신원이 없어 오늘의 서로 다른 출처(추정)로 계산합니다.{' '}
          <span className="font-medium text-text-muted">가입</span> 은{' '}
          {isOperator
            ? '운영자 토큰으로 로그인하여 플랫폼 전체 테넌트를 집계합니다.'
            : '테넌트 키 기준이라 내 계정만 반영됩니다(플랫폼 전체는 운영자 전용).'}
        </p>
      ) : null}

      {/* 빠른 링크 */}
      <section aria-label="빠른 이동" className="grid gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent-strong/40 hover:bg-surface-2"
          >
            <span className="text-sm font-semibold text-text">{l.label}</span>
            <span className="mt-0.5 block text-xs text-text-muted">{l.desc}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
