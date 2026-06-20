import { Quote, Sparkles, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import type { AdminReviewDto } from '@reviewdesk/shared'

import { useAuthStore } from '@/app/authStore'
import { Stars } from '@/components/feature/Stars'
import { Badge, FeaturedBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useModerate, useReviews, type ReviewFilters } from '@/services/reviews'
import { formatRelative } from '@/utils/format'

type View = 'featured' | 'candidates'

/**
 * 후기 큐레이션 — 승인된 리뷰 중에서 후기 월(testimonial wall)에 올릴 것을 고른다.
 * 추천(featured) = 후기 월 노출. 후보(승인·비추천) → 추천 토글로 큐레이션.
 */
export default function TestimonialsPage() {
  useDocumentTitle('후기 큐레이션')
  const kind = useAuthStore((s) => s.kind)
  const tenantId = useAuthStore((s) => s.tenantId)
  const [view, setView] = useState<View>('featured')
  const [pendingId, setPendingId] = useState<string | null>(null)

  // 승인본만 다룬다. featured 필터는 뷰에 따라 분기.
  const filters: ReviewFilters = useMemo(
    () => ({
      status: 'approved',
      featured: view === 'featured' ? true : undefined,
      offset: 0,
      limit: 100,
    }),
    [view]
  )
  const reviewsQ = useReviews(filters)
  const moderate = useModerate()

  const items = reviewsQ.data?.items ?? []
  // 후보 뷰에서는 비추천만 남긴다.
  const shown = view === 'candidates' ? items.filter((r) => !r.featured) : items

  const toggleFeature = (review: AdminReviewDto) => {
    setPendingId(review.id)
    moderate.mutate(
      { id: review.id, input: { action: review.featured ? 'unfeature' : 'feature' } },
      {
        onSuccess: () =>
          toast.success(review.featured ? '후기 월에서 내렸습니다' : '후기 월에 올렸습니다'),
        onError: (e) => toast.error(e instanceof Error ? e.message : '작업에 실패했습니다.'),
        onSettled: () => setPendingId(null),
      }
    )
  }

  if (kind === 'admin' && !tenantId) {
    return (
      <div>
        <Header />
        <div className="mt-8">
          <EmptyState
            icon={Star}
            title="대상 테넌트를 지정하세요"
            description="글로벌 ADMIN_TOKEN 모드입니다. 설정에서 테넌트를 선택하세요."
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
      <Header />

      <div className="mt-6">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="featured">후기 월 (추천)</TabsTrigger>
            <TabsTrigger value="candidates">후보 (승인·비추천)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-6">
        {reviewsQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : reviewsQ.isError ? (
          <EmptyState
            title="후기를 불러오지 못했어요"
            description={reviewsQ.error instanceof Error ? reviewsQ.error.message : undefined}
            action={
              <Button size="sm" variant="secondary" onClick={() => void reviewsQ.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={view === 'featured' ? Quote : Sparkles}
            title={view === 'featured' ? '아직 추천한 후기가 없어요' : '추천할 후보가 없어요'}
            description={
              view === 'featured'
                ? '후보 탭에서 마음에 드는 후기를 추천으로 올리면 후기 월(TestimonialWall) 위젯에 노출됩니다.'
                : '승인된 리뷰가 쌓이면 여기서 후기 월에 올릴 후보를 고를 수 있습니다.'
            }
            action={
              view === 'featured' ? (
                <Button size="sm" variant="secondary" onClick={() => setView('candidates')}>
                  후보 보기
                </Button>
              ) : (
                <Button asChild size="sm" variant="secondary">
                  <Link to="/app">검수 대시보드</Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((t) => (
              <li key={t.id}>
                <TestimonialCard
                  review={t}
                  pending={pendingId === t.id}
                  onToggle={() => toggleFeature(t)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">후기 큐레이션</h1>
        <p className="mt-1 text-sm text-text-muted">
          승인된 리뷰 중 추천(featured)을 골라 후기 월 위젯에 노출합니다.
        </p>
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link to="/demo">위젯에서 미리보기</Link>
      </Button>
    </div>
  )
}

function TestimonialCard({
  review,
  pending,
  onToggle,
}: {
  review: AdminReviewDto
  pending: boolean
  onToggle: () => void
}) {
  return (
    <figure className="flex h-full flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <Stars value={review.rating} size="sm" />
        {review.featured ? (
          <FeaturedBadge />
        ) : (
          <Badge tone="neutral" size="sm">
            후보
          </Badge>
        )}
      </div>
      <blockquote className="mt-3 flex-1 text-sm text-pretty text-text-muted">
        {review.title ? (
          <strong className="font-semibold text-text">{review.title}. </strong>
        ) : null}
        <span className="line-clamp-5">{review.body}</span>
      </blockquote>
      <figcaption className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{review.authorName}</p>
          <p className="truncate font-mono text-xs text-text-subtle">
            {review.subjectId} · {formatRelative(review.createdAt)}
          </p>
        </div>
        <Tooltip content={review.featured ? '후기 월에서 내립니다' : '후기 월에 올립니다'}>
          <Button
            variant={review.featured ? 'outline' : 'accent'}
            size="sm"
            onClick={onToggle}
            loading={pending}
          >
            {review.featured ? '내리기' : '올리기'}
          </Button>
        </Tooltip>
      </figcaption>
    </figure>
  )
}
