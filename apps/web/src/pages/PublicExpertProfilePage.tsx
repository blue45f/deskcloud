import { formatKrw } from '@termsdesk/shared'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Globe2,
  Users,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, RatingStars, Skeleton } from '@/components/ui/feedback'
import { usePageMeta } from '@/hooks/usePageMeta'
import { usePublicProvider } from '@/services/brokerage'
import { formatDate } from '@/utils/format'

function PublicTopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="TermsDesk 홈">
          <Brand />
        </Link>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/experts">전문가</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register">시작하기</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  )
}

export default function PublicExpertProfilePage() {
  const { id } = useParams()
  const provider = usePublicProvider(id)
  const data = provider.data

  usePageMeta({
    title: data ? `${data.displayName} 전문가 프로필` : '전문가 프로필',
    path: id ? `/experts/${id}` : '/experts',
    description: data
      ? `${data.headline} · ${data.orgName}. 완료 ${data.completedCount}건, 후기 ${data.reviewCount}건의 TermsDesk 공개 전문가 프로필.`
      : undefined,
  })

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-bg text-text">
      <PublicTopNav />

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Button variant="ghost" size="sm" asChild className="mb-5">
          <Link to="/experts">
            <ArrowLeft className="size-4" aria-hidden />
            전문가 목록
          </Link>
        </Button>

        {provider.isLoading ? (
          <DetailSkeleton />
        ) : provider.isError || !data ? (
          <EmptyState
            icon={Users}
            title="전문가를 찾을 수 없습니다"
            description={provider.error instanceof Error ? provider.error.message : undefined}
            action={
              <Button asChild>
                <Link to="/experts">목록으로 이동</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {data.verified ? (
                      <Badge tone="accent" size="sm">
                        <BadgeCheck className="size-3" aria-hidden /> 검증됨
                      </Badge>
                    ) : (
                      <Badge tone="outline" size="sm">
                        미검증
                      </Badge>
                    )}
                    <span className="text-xs text-text-subtle">완료 {data.completedCount}건</span>
                    <RatingStars value={data.avgRating} count={data.reviewCount} />
                  </div>
                  <h1 className="break-words text-3xl font-bold tracking-tight text-text">
                    {data.displayName}
                  </h1>
                  <p className="mt-2 break-words text-base leading-6 text-text-muted">
                    {data.headline}
                  </p>
                </div>
                <Button asChild className="shrink-0">
                  <Link to="/register">
                    의뢰 시작 <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>

              {data.specialties.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {data.specialties.map((tag) => (
                    <Badge key={tag} tone="outline" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-text">
                {data.bio}
              </p>

              <dl className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="inline-flex items-center gap-1.5 text-xs text-text-subtle">
                    <Users className="size-3.5" aria-hidden /> 소속
                  </dt>
                  <dd className="mt-1 break-words font-medium text-text-muted">{data.orgName}</dd>
                </div>
                <div>
                  <dt className="inline-flex items-center gap-1.5 text-xs text-text-subtle">
                    <Globe2 className="size-3.5" aria-hidden /> 활동 관할
                  </dt>
                  <dd className="mt-1 break-words font-medium text-text-muted">
                    {data.jurisdictions}
                  </dd>
                </div>
                <div>
                  <dt className="inline-flex items-center gap-1.5 text-xs text-text-subtle">
                    <BriefcaseBusiness className="size-3.5" aria-hidden /> 시간당 단가
                  </dt>
                  <dd className="mt-1 font-medium text-text-muted">{formatKrw(data.hourlyRate)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-border bg-surface p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-text">후기</h2>
                <span className="text-sm text-text-subtle">{data.reviewCount}건</span>
              </div>
              {data.reviews && data.reviews.length > 0 ? (
                <ul className="space-y-3">
                  {data.reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-lg border border-border bg-surface-2/35 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-warning">
                          {'★'.repeat(review.rating)}
                          <span className="text-xs text-text-subtle">{review.rating}.0</span>
                        </span>
                        <span className="truncate text-xs text-text-subtle">
                          {review.requestTitle}
                        </span>
                      </div>
                      {review.comment ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
                          {review.comment}
                        </p>
                      ) : null}
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-subtle">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        {review.reviewerName} · {formatDate(review.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Users} title="아직 공개 후기가 없습니다" />
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  )
}
