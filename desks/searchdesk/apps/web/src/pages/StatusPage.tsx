import { Activity, Building2, RotateCcw, TrendingUp, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatCard } from '@/components/feature/StatCard'
import { Brand } from '@/components/layout/Brand'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { usePlatformStats } from '@/services/searchdesk'

/** 숫자 포맷 — 로케일 천단위 구분(스크린리더에도 읽히는 실제 텍스트). */
function fmt(n: number): string {
  return n.toLocaleString()
}

function StatsGrid() {
  const stats = usePlatformStats()

  if (stats.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  if (stats.isError || !stats.data) {
    const msg =
      stats.error instanceof ApiError ? stats.error.message : '현황을 불러오지 못했습니다.'
    return (
      <EmptyState
        icon={Activity}
        title="현황을 불러올 수 없습니다"
        description={msg}
        action={
          <Button size="sm" variant="secondary" onClick={() => void stats.refetch()}>
            <RotateCcw className="size-4" /> 다시 시도
          </Button>
        }
      />
    )
  }

  const s = stats.data

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Users}
        label="오늘 방문자 수"
        value={fmt(s.todayVisitors)}
        hint="실시간 집계 시작 · 일자별 고유"
        tone="accent"
      />
      <StatCard
        icon={Activity}
        label="총 트래픽"
        value={fmt(s.totalTraffic)}
        hint="실시간 집계 시작 · 누적 방문"
        tone="info"
      />
      <StatCard
        icon={UserPlus}
        label="오늘 신규 가입자 수"
        value={fmt(s.todaySignups)}
        hint="오늘 신규 테넌트"
        tone="success"
      />
      <StatCard
        icon={Building2}
        label="총 가입 수"
        value={fmt(s.totalSignups)}
        hint="누적 테넌트"
        tone="neutral"
      />
    </div>
  )
}

export default function StatusPage() {
  useDocumentTitle('현황')

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="SearchDesk 홈">
            <Brand />
          </Link>
          <nav aria-label="현황 빠른 이동" className="flex items-center gap-3 text-sm font-medium">
            <Link to="/" className="text-text-muted transition-colors hover:text-text">
              홈
            </Link>
            <Link to="/sitemap" className="text-text-muted transition-colors hover:text-text">
              사이트맵
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-12 outline-none sm:px-6"
      >
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] text-accent-strong uppercase">
          <TrendingUp className="size-3.5" aria-hidden />
          Live Status
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          SearchDesk 현황
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
          방문자·트래픽·가입 현황을 한 화면에 정리했습니다. 가입 지표는 실제 테넌트 기록이며,
          방문자·트래픽은 새로 시작한 집계라 초기 수치는 작지만 모두 실측입니다.
        </p>

        <section aria-label="플랫폼 지표" className="mt-8">
          <StatsGrid />
        </section>

        <p className="mt-6 text-xs text-text-subtle">
          약 1분마다 자동 갱신됩니다. 서버 타임존(KST) 기준 오늘 0시부터 집계합니다.
        </p>
      </main>
    </div>
  )
}
