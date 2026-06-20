import {
  POLICY_TYPES,
  POLICY_TYPE_LABELS,
  formatKrw,
  type ProviderProfileDto,
} from '@termsdesk/shared'
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Search, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Brand } from '@/components/layout/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, RatingStars, Skeleton } from '@/components/ui/feedback'
import { Input, Select } from '@/components/ui/field'
import { usePageMeta } from '@/hooks/usePageMeta'
import { usePublicProviders } from '@/services/brokerage'
import { cn } from '@/utils/cn'

function PublicTopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" aria-label="TermsDesk 홈">
          <Brand />
        </Link>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">로그인</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register">시작하기</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

function ProviderCard({ provider }: { provider: ProviderProfileDto }) {
  return (
    <Link
      to={`/experts/${provider.id}`}
      className="flex min-h-52 flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-accent-strong"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-semibold text-text">
            <span className="truncate">{provider.displayName}</span>
            {provider.verified ? (
              <BadgeCheck className="size-4 shrink-0 text-accent-strong" aria-label="검증됨" />
            ) : null}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{provider.headline}</p>
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-text-subtle" aria-hidden />
      </div>

      {provider.specialties.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {provider.specialties.slice(0, 4).map((tag) => (
            <Badge key={tag} tone="outline" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <p className="line-clamp-3 text-sm leading-6 text-text-muted">{provider.bio}</p>

      <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs text-text-subtle sm:grid-cols-4">
        <div>
          <dt>소속</dt>
          <dd className="mt-0.5 truncate font-medium text-text-muted">{provider.orgName}</dd>
        </div>
        <div>
          <dt>후기</dt>
          <dd className="mt-0.5">
            <RatingStars value={provider.avgRating} count={provider.reviewCount} />
          </dd>
        </div>
        <div>
          <dt>단가</dt>
          <dd className="mt-0.5 font-medium text-text-muted">{formatKrw(provider.hourlyRate)}</dd>
        </div>
        <div>
          <dt>완료</dt>
          <dd className="mt-0.5 font-medium text-text-muted">{provider.completedCount}건</dd>
        </div>
      </dl>
    </Link>
  )
}

function ProviderSkeletonGrid() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-52 rounded-lg" />
      ))}
    </div>
  )
}

export default function PublicExpertsPage() {
  const [params, setParams] = useSearchParams()
  const specialty = params.get('specialty') ?? ''
  const query = params.get('q') ?? ''
  const providers = usePublicProviders(specialty || undefined)
  const items = providers.data?.items ?? []
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? items.filter((provider) =>
        [
          provider.displayName,
          provider.headline,
          provider.bio,
          provider.orgName,
          provider.jurisdictions,
          provider.specialties.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : items

  usePageMeta({
    title: '약관 전문가 디렉터리',
    path: '/experts',
    description:
      'TermsDesk 공개 전문가 디렉터리에서 약관 작성, 개인정보처리방침 검토, 번역 전문가 프로필을 확인하세요.',
  })

  const updateParam = (key: 'q' | 'specialty', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-bg text-text">
      <PublicTopNav />

      <section className="border-b border-border bg-surface/35">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge tone="accent" size="sm">
                전문가 디렉터리
              </Badge>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-text sm:text-4xl">
                약관 작업에 맞는 전문가를 찾으세요
              </h1>
              <p className="mt-3 text-sm leading-6 text-text-muted sm:text-base">
                공개 프로필, 검증 배지, 완료 이력, 후기를 기준으로 작성·검토·번역 전문가를 비교할 수
                있습니다.
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link to="/register">
                의뢰 시작 <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-5 grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
          <label className="relative block">
            <span className="sr-only">전문가 검색</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
              placeholder="이름, 소개, 관할, 전문 분야 검색"
              className="pl-9"
            />
          </label>
          <Select
            value={specialty}
            onChange={(event) => updateParam('specialty', event.target.value)}
            aria-label="전문 분야 필터"
          >
            <option value="">모든 전문 분야</option>
            {POLICY_TYPES.map((type) => (
              <option key={type} value={POLICY_TYPE_LABELS[type]}>
                {POLICY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text-subtle">
          <p>
            {providers.isLoading
              ? '불러오는 중'
              : `총 ${filtered.length}명${items.length !== filtered.length ? ` / ${items.length}명` : ''}`}
          </p>
          <p className={cn('inline-flex items-center gap-1', !providers.data && 'hidden')}>
            <BriefcaseBusiness className="size-4" aria-hidden />
            검증·완료 순 정렬
          </p>
        </div>

        {providers.isLoading ? (
          <ProviderSkeletonGrid />
        ) : providers.isError ? (
          <EmptyState
            icon={Users}
            title="전문가를 불러오지 못했습니다"
            description={providers.error instanceof Error ? providers.error.message : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="조건에 맞는 전문가가 없습니다"
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setParams(new URLSearchParams(), { replace: true })
                }}
              >
                필터 초기화
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
