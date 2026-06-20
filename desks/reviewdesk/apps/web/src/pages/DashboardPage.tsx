import { Inbox, RefreshCw, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import type { AdminReviewDto, ModerationAction, ReviewStatus } from '@reviewdesk/shared'

import { useAuthStore } from '@/app/authStore'
import { ReplyDialog } from '@/components/feature/ReplyDialog'
import { ReviewCard } from '@/components/feature/ReviewCard'
import { StatCard } from '@/components/feature/StatCard'
import { SubjectCard } from '@/components/feature/SubjectCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  groupBySubject,
  useAllReviewsForSubjects,
  useDeleteReview,
  useModerate,
  useReviews,
  type ReviewFilters,
} from '@/services/reviews'

const PAGE_SIZE = 20

const STATUS_TABS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'pending', label: '대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '거절' },
  { value: 'all', label: '전체' },
]

type PendingKey = { id: string; action: ModerationAction | 'delete' } | null

export default function DashboardPage() {
  useDocumentTitle('검수 대시보드')
  const kind = useAuthStore((s) => s.kind)
  const tenantId = useAuthStore((s) => s.tenantId)

  const [status, setStatus] = useState<ReviewStatus | 'all'>('pending')
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(0)
  const [replyTarget, setReplyTarget] = useState<AdminReviewDto | null>(null)
  const [pending, setPending] = useState<PendingKey>(null)

  const filters: ReviewFilters = useMemo(
    () => ({
      status: status === 'all' ? undefined : status,
      subjectId,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [status, subjectId, page]
  )

  const reviewsQ = useReviews(filters)
  const subjectsQ = useAllReviewsForSubjects(100)
  const moderate = useModerate()
  const del = useDeleteReview()

  const subjects = useMemo(
    () => (subjectsQ.data ? groupBySubject(subjectsQ.data) : []),
    [subjectsQ.data]
  )

  const totals = useMemo(() => {
    const all = subjectsQ.data ?? []
    return {
      total: all.length,
      pending: all.filter((r) => r.status === 'pending').length,
      approved: all.filter((r) => r.status === 'approved').length,
      featured: all.filter((r) => r.featured).length,
    }
  }, [subjectsQ.data])

  const items = reviewsQ.data?.items ?? []
  const total = reviewsQ.data?.totalCount ?? reviewsQ.data?.total ?? 0
  const hasMore = (page + 1) * PAGE_SIZE < total

  const changeStatus = (s: ReviewStatus | 'all') => {
    setStatus(s)
    setPage(0)
  }
  const selectSubject = (sid: string) => {
    setSubjectId((prev) => (prev === sid ? undefined : sid))
    setPage(0)
  }

  const runModerate = (review: AdminReviewDto, action: ModerationAction, reply?: string) => {
    setPending({ id: review.id, action })
    moderate.mutate(
      { id: review.id, input: reply !== undefined ? { action, reply } : { action } },
      {
        onSuccess: () => {
          const labels: Record<ModerationAction, string> = {
            approve: '승인했습니다',
            reject: '거절했습니다',
            feature: '추천으로 지정했습니다',
            unfeature: '추천을 해제했습니다',
            reply: '답글을 저장했습니다',
          }
          toast.success(labels[action])
          if (action === 'reply') setReplyTarget(null)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '작업에 실패했습니다.'),
        onSettled: () => setPending(null),
      }
    )
  }

  const runDelete = (review: AdminReviewDto) => {
    setPending({ id: review.id, action: 'delete' })
    del.mutate(review.id, {
      onSuccess: () => toast.success('리뷰를 삭제했습니다'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '삭제에 실패했습니다.'),
      onSettled: () => setPending(null),
    })
  }

  // 글로벌 ADMIN_TOKEN 인데 대상 테넌트 미지정 → 설정에서 지정하도록 안내.
  const needsTenant = kind === 'admin' && !tenantId
  if (needsTenant) {
    return (
      <div>
        <PageHeader />
        <div className="mt-8">
          <EmptyState
            icon={Star}
            title="대상 테넌트를 지정하세요"
            description="글로벌 ADMIN_TOKEN 으로 로그인했습니다. 검수할 테넌트를 설정에서 선택하면 그 테넌트의 리뷰가 표시됩니다."
            action={
              <Button asChild>
                <Link to="/app/settings">테넌트 설정으로</Link>
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader />

      {/* 요약 지표 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="전체 리뷰" value={totals.total} hint="모든 상태" />
        <StatCard
          label="검수 대기"
          value={totals.pending}
          hint="승인/거절이 필요합니다"
          tone={totals.pending > 0 ? 'warning' : 'neutral'}
        />
        <StatCard label="승인됨" value={totals.approved} hint="위젯에 노출" tone="success" />
        <StatCard label="추천" value={totals.featured} hint="후기 월 노출" tone="accent" />
      </div>

      {/* subject 집계 카드 */}
      <section className="mt-8" aria-label="대상별 집계">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">대상(subject)별 집계</h2>
          {subjectId ? (
            <Button variant="ghost" size="sm" onClick={() => selectSubject(subjectId)}>
              필터 해제
            </Button>
          ) : null}
        </div>
        {subjectsQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : subjectsQ.isError ? (
          <EmptyState
            title="집계를 불러오지 못했어요"
            description={subjectsQ.error instanceof Error ? subjectsQ.error.message : undefined}
            action={
              <Button size="sm" variant="secondary" onClick={() => void subjectsQ.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : subjects.length === 0 ? (
          <p className="text-sm text-text-subtle">아직 집계할 리뷰가 없습니다.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <SubjectCard
                key={s.subjectId}
                subject={s}
                active={subjectId === s.subjectId}
                onSelect={() => selectSubject(s.subjectId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 검수 큐 */}
      <section className="mt-10" aria-label="검수 큐">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text">
            검수 큐
            {subjectId ? (
              <span className="ml-2 font-mono text-xs font-normal text-text-subtle">
                · {subjectId}
              </span>
            ) : null}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void reviewsQ.refetch()
              void subjectsQ.refetch()
            }}
          >
            <RefreshCw className="size-3.5" /> 새로고침
          </Button>
        </div>

        <div className="mt-3">
          <Tabs value={status} onValueChange={(v) => changeStatus(v as ReviewStatus | 'all')}>
            <TabsList>
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-5 space-y-3">
          {reviewsQ.isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)
          ) : reviewsQ.isError ? (
            <EmptyState
              title="리뷰를 불러오지 못했어요"
              description={reviewsQ.error instanceof Error ? reviewsQ.error.message : undefined}
              action={
                <Button size="sm" variant="secondary" onClick={() => void reviewsQ.refetch()}>
                  다시 시도
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="여기에는 리뷰가 없어요"
              description={
                status === 'pending'
                  ? '검수 대기 중인 리뷰가 없습니다. 위젯으로 리뷰가 들어오면 여기에 표시됩니다.'
                  : '이 필터에 해당하는 리뷰가 없습니다.'
              }
            />
          ) : (
            items.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                pendingAction={pending?.id === review.id ? pending.action : null}
                onModerate={(action) => runModerate(review, action)}
                onReply={() => setReplyTarget(review)}
                onDelete={() => runDelete(review)}
              />
            ))
          )}
        </div>

        {/* 페이지네이션 */}
        {total > PAGE_SIZE ? (
          <div className="mt-5 flex items-center justify-between">
            <Badge tone="neutral" size="sm">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
            </Badge>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                이전
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <ReplyDialog
        review={replyTarget}
        open={replyTarget !== null}
        onOpenChange={(o) => !o && setReplyTarget(null)}
        pending={pending?.action === 'reply'}
        onSubmit={(reply) => {
          if (replyTarget) runModerate(replyTarget, 'reply', reply)
        }}
      />
    </div>
  )
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-text">검수 대시보드</h1>
      <p className="mt-1 text-sm text-text-muted">
        들어온 리뷰를 승인·거절·추천하고 답글을 답니다. 승인본만 위젯에 노출됩니다.
      </p>
    </div>
  )
}
