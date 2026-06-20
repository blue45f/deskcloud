import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Eye,
  FolderOpen,
  Inbox,
  MessageSquare,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { ReactionChips } from '@/components/feature/ReactionChips'
import { StatCard } from '@/components/feature/StatCard'
import { Badge, BoardKindBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getStats, getTenant, listBoards, listPosts } from '@/services/community'
import { formatDate, formatNumber, relativeTime } from '@/utils/format'

function CardGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  useDocumentTitle('대시보드')

  const tenantQ = useQuery({ queryKey: ['tenant'], queryFn: getTenant })
  const statsQ = useQuery({ queryKey: ['stats'], queryFn: getStats })
  const boardsQ = useQuery({ queryKey: ['boards'], queryFn: listBoards })
  const recentQ = useQuery({
    queryKey: ['posts', { recent: true }],
    queryFn: () => listPosts({ limit: 6 }),
  })
  const pendingQ = useQuery({
    queryKey: ['posts', { status: 'pending' }],
    queryFn: () => listPosts({ status: 'pending', limit: 1 }),
  })

  const tenant = tenantQ.data
  const stats = statsQ.data
  const boards = boardsQ.data ?? []
  const totalPosts = boards.reduce((acc, b) => acc + b.postCount, 0)
  const pendingCount = pendingQ.data?.total ?? 0

  // 글로벌 ADMIN_TOKEN 으로 로그인한 셀프호스트 운영자에게만 플랫폼(테넌트) 지표가 온다.
  // 그 경우 "가입"은 테넌트(고객) 수를, 아니면 콘텐츠를 쓴 멤버 수를 정직하게 보여준다.
  const platformMode = Boolean(stats?.platform)
  const totalTenants = stats?.platform?.totalTenants ?? 0
  const newTenants = stats?.platform?.todayNewTenants ?? 0

  const visitorsHint = stats?.trackedSince ? '이번 릴리스부터 집계' : '집계 시작 전'
  const signupHint = platformMode ? '오늘 가입 테넌트' : '첫 글·댓글이 오늘인 멤버'
  const signupTotalHint = platformMode ? '전체 테넌트(고객)' : '글·댓글 작성 멤버'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">대시보드</h1>
          <p className="mt-1 text-sm text-text-muted">
            {tenant ? (
              <>
                <strong className="font-semibold text-text">{tenant.name}</strong> ·{' '}
                <span className="font-mono">{tenant.slug}</span> ·{' '}
                <Badge tone={tenant.plan === 'free' ? 'neutral' : 'accent'} size="sm">
                  {tenant.plan}
                </Badge>
              </>
            ) : (
              '테넌트 정보를 불러오는 중…'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to="/app/boards">게시판 관리</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/app/moderation">검수 큐</Link>
          </Button>
        </div>
      </div>

      {/* 트래픽·분석 — 방문/가입 4개 지표 */}
      <section aria-labelledby="analytics-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="analytics-heading" className="text-sm font-semibold text-text">
            트래픽 · 분석
          </h2>
          {stats?.trackedSince ? (
            <p className="text-xs text-text-subtle">
              방문 추적 시작 {formatDate(stats.trackedSince)}
            </p>
          ) : null}
        </div>
        {statsQ.isLoading ? (
          <CardGridSkeleton />
        ) : statsQ.isError ? (
          <ErrorState
            title="지표를 불러오지 못했습니다"
            error={statsQ.error}
            retrying={statsQ.isFetching}
            onRetry={() => void statsQ.refetch()}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="오늘 방문자 수"
              value={formatNumber(stats?.todayVisitors ?? 0)}
              hint={visitorsHint}
              icon={Users}
              tone="accent"
            />
            <StatCard
              label="총 트래픽"
              value={formatNumber(stats?.totalTraffic ?? 0)}
              hint="누적 읽기 기준"
              icon={Eye}
              tone="success"
            />
            <StatCard
              label="오늘 신규 가입자 수"
              value={formatNumber(platformMode ? newTenants : (stats?.todayNewMembers ?? 0))}
              hint={signupHint}
              icon={UserPlus}
              tone="info"
            />
            <StatCard
              label="총 가입 수"
              value={formatNumber(platformMode ? totalTenants : (stats?.totalMembers ?? 0))}
              hint={signupTotalHint}
              icon={Users}
              tone="neutral"
            />
          </div>
        )}
      </section>

      {/* 지표 */}
      {tenantQ.isLoading || boardsQ.isLoading ? (
        <CardGridSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="게시판·카페"
            value={formatNumber(boards.length)}
            hint={`노출 글 ${formatNumber(totalPosts)}건`}
            icon={FolderOpen}
            tone="accent"
            to="/app/boards"
          />
          <StatCard
            label="누적 글 작성"
            value={tenant ? formatNumber(tenant.postsCount) : '—'}
            hint={tenant?.plan === 'free' ? '무료 플랜 소프트 한도 적용' : undefined}
            icon={MessageSquare}
            tone="info"
          />
          <StatCard
            label="누적 읽기"
            value={tenant ? formatNumber(tenant.readsCount) : '—'}
            icon={Eye}
            tone="success"
          />
          <StatCard
            label="검수 대기"
            value={formatNumber(pendingCount)}
            hint={pendingCount > 0 ? '지금 검수하기' : '대기 없음'}
            icon={ShieldAlert}
            tone={pendingCount > 0 ? 'warning' : 'neutral'}
            to={pendingCount > 0 ? '/app/moderation?status=pending' : undefined}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* 최근 글 */}
        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/moderation">
                  전체 <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            }
          >
            <CardTitle>최근 글</CardTitle>
            <CardDescription>모든 게시판의 최신 글입니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentQ.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentQ.isError ? (
              <div className="p-5">
                <ErrorState
                  title="최근 글을 불러오지 못했습니다"
                  error={recentQ.error}
                  retrying={recentQ.isFetching}
                  onRetry={() => void recentQ.refetch()}
                />
              </div>
            ) : (recentQ.data?.items.length ?? 0) === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Inbox}
                  title="아직 글이 없습니다"
                  description="위젯이 게시판을 받아 멤버가 글을 쓰기 시작하면 여기에 표시됩니다."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentQ.data?.items.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">
                          {p.title || '(제목 없음)'}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-subtle">
                        <span className="font-mono">{p.boardSlug}</span> · {p.authorName} ·{' '}
                        {relativeTime(p.createdAt)} · 댓글 {p.replyCount}
                      </p>
                    </div>
                    <ReactionChips reactions={p.reactions} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 게시판 요약 */}
        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/boards">관리</Link>
              </Button>
            }
          >
            <CardTitle>게시판·카페</CardTitle>
            <CardDescription>노출 글 수 기준.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {boardsQ.isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : boardsQ.isError ? (
              <div className="p-5">
                <ErrorState
                  title="게시판을 불러오지 못했습니다"
                  error={boardsQ.error}
                  retrying={boardsQ.isFetching}
                  onRetry={() => void boardsQ.refetch()}
                />
              </div>
            ) : boards.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={FolderOpen}
                  title="게시판이 없습니다"
                  description="첫 게시판을 만들어 위젯에 붙이세요."
                  action={
                    <Button asChild size="sm" variant="accent">
                      <Link to="/app/boards">게시판 만들기</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {boards.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">{b.name}</span>
                        <BoardKindBadge kind={b.kind} />
                      </div>
                      <p className="truncate font-mono text-xs text-text-subtle">{b.slug}</p>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-text-muted">
                      {formatNumber(b.postCount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
