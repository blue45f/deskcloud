import {
  POLICY_TYPES,
  POLICY_TYPE_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_TYPES,
  SERVICE_REQUEST_TYPE_LABELS,
  TERMINAL_REQUEST_STATUSES,
  formatBudgetRange,
  formatKrw,
  type PolicyType,
  type ProviderProfileDto,
  type ServiceRequestDto,
  type ServiceRequestStatus,
  type ServiceRequestType,
} from '@termsdesk/shared'
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  MessagesSquare,
  Store,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, PolicyTypeBadge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, RatingStars, Skeleton } from '@/components/ui/feedback'
import { Select } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  useMarketplace,
  useMyProviderProfile,
  useProvider,
  useProviders,
  useServiceRequests,
} from '@/services/brokerage'
import { cn } from '@/utils/cn'
import { formatDate, formatRelative } from '@/utils/format'

const STATUS_TONE: Record<ServiceRequestStatus, BadgeProps['tone']> = {
  open: 'info',
  matched: 'accent',
  in_progress: 'warning',
  delivered: 'warning',
  completed: 'success',
  cancelled: 'neutral',
}

function RequestStatusPill({ status }: { status: ServiceRequestStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot={status === 'open'}>
      {SERVICE_REQUEST_STATUS_LABELS[status]}
    </Badge>
  )
}

/** 마켓 카드 — 의뢰자 이름은 가려진 채(orgName) 공개 의뢰를 탐색·제안하도록 유도. */
function MarketRequestCard({
  request,
  onOpen,
  showStatus = false,
}: {
  request: ServiceRequestDto
  onOpen: () => void
  showStatus?: boolean
}) {
  const terminal = TERMINAL_REQUEST_STATUSES.includes(request.status)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-accent-strong',
        terminal && 'opacity-80'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {showStatus ? <RequestStatusPill status={request.status} /> : null}
        <Badge tone="outline" size="sm">
          {SERVICE_REQUEST_TYPE_LABELS[request.serviceType]}
        </Badge>
        <PolicyTypeBadge type={request.policyType} />
        {request.myProposalId ? (
          <Badge tone="accent" size="sm">
            제안함
          </Badge>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-text-subtle">{request.requesterOrgName}</p>
        <h3 className="mt-0.5 truncate font-medium text-text">{request.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-text-muted">{request.description}</p>
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-subtle">
        <div className="inline-flex items-center gap-1.5">
          <dt className="sr-only">예산</dt>
          <dd className="font-medium text-text-muted">
            {formatBudgetRange(request.budgetMin, request.budgetMax)}
          </dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <MessagesSquare className="size-3.5" aria-hidden />
          <dt className="sr-only">제안 수</dt>
          <dd>제안 {request.proposalCount}건</dd>
        </div>
        {request.deadline ? (
          <div className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden />
            <dt className="sr-only">마감</dt>
            <dd>마감 {formatDate(request.deadline)}</dd>
          </div>
        ) : null}
        <div className="ml-auto inline-flex items-center gap-1.5">
          <dt className="sr-only">등록</dt>
          <dd title={formatDate(request.createdAt)}>{formatRelative(request.createdAt)}</dd>
        </div>
      </dl>
    </button>
  )
}

function CardGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-44 w-full rounded-lg" />
      ))}
    </div>
  )
}

export default function MarketplacePage() {
  useDocumentTitle('의뢰 마켓플레이스')
  const navigate = useNavigate()

  const myProvider = useMyProviderProfile()
  const needsProfile = !myProvider.isLoading && !myProvider.isError && myProvider.data == null

  return (
    <>
      <PageHeader
        title="의뢰 마켓플레이스"
        description="공개된 약관 작업 의뢰를 둘러보고 제안을 보내세요. 진행 중인 작업도 여기서 한눈에 관리합니다."
      />

      {needsProfile ? (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-accent-soft/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-accent-strong">
              <Briefcase className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">전문가로 등록하고 제안을 보내세요</p>
              <p className="mt-0.5 text-[0.8125rem] text-text-muted">
                전문가 프로필이 있어야 공개 의뢰에 제안할 수 있습니다.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/app/expert">
              <UserPlus className="size-4" aria-hidden />
              전문가 등록
            </Link>
          </Button>
        </div>
      ) : null}

      <Tabs defaultValue="open">
        <TabsList className="mb-4">
          <TabsTrigger value="open">공개 의뢰</TabsTrigger>
          <TabsTrigger value="providers">전문가</TabsTrigger>
          <TabsTrigger value="proposed">내 제안</TabsTrigger>
          <TabsTrigger value="assigned">진행 중 작업</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="outline-none">
          <OpenRequestsTab onOpen={(id) => navigate(`/app/requests/${id}`)} />
        </TabsContent>

        <TabsContent value="providers" className="outline-none">
          <ProvidersTab />
        </TabsContent>

        <TabsContent value="proposed" className="outline-none">
          <ProposedTab onOpen={(id) => navigate(`/app/requests/${id}`)} />
        </TabsContent>

        <TabsContent value="assigned" className="outline-none">
          <AssignedTab onOpen={(id) => navigate(`/app/requests/${id}`)} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function FilterSelects({
  type,
  policyType,
  onType,
  onPolicyType,
}: {
  type: ServiceRequestType | 'all'
  policyType: PolicyType | 'all'
  onType: (next: ServiceRequestType | 'all') => void
  onPolicyType: (next: PolicyType | 'all') => void
}) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <div className="sm:w-48">
        <Select
          value={type}
          onChange={(e) => onType(e.target.value as ServiceRequestType | 'all')}
          aria-label="종류 필터"
        >
          <option value="all">모든 종류</option>
          {SERVICE_REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {SERVICE_REQUEST_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <div className="sm:w-48">
        <Select
          value={policyType}
          onChange={(e) => onPolicyType(e.target.value as PolicyType | 'all')}
          aria-label="문서 종류 필터"
        >
          <option value="all">모든 문서</option>
          {POLICY_TYPES.map((t) => (
            <option key={t} value={t}>
              {POLICY_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

function OpenRequestsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const [type, setType] = useState<ServiceRequestType | 'all'>('all')
  const [policyType, setPolicyType] = useState<PolicyType | 'all'>('all')

  const market = useMarketplace({
    type: type === 'all' ? undefined : type,
    policyType: policyType === 'all' ? undefined : policyType,
  })

  const items = market.data?.items ?? []
  const filterActive = type !== 'all' || policyType !== 'all'

  return (
    <>
      <FilterSelects
        type={type}
        policyType={policyType}
        onType={setType}
        onPolicyType={setPolicyType}
      />

      {market.isLoading ? (
        <CardGridSkeleton />
      ) : market.isError ? (
        <EmptyState
          icon={Store}
          title="의뢰를 불러오지 못했습니다"
          description={market.error instanceof Error ? market.error.message : undefined}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Store}
          title={filterActive ? '조건에 맞는 공개 의뢰가 없습니다' : '공개된 의뢰가 없습니다'}
          description={
            filterActive
              ? '다른 종류나 문서로 다시 시도해 보세요.'
              : '새 공개 의뢰가 올라오면 이곳에 표시됩니다.'
          }
          action={
            filterActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setType('all')
                  setPolicyType('all')
                }}
              >
                필터 초기화
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-text-subtle">총 {market.data?.total ?? 0}건</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((request) => (
              <MarketRequestCard
                key={request.id}
                request={request}
                onOpen={() => onOpen(request.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function ProposedTab({ onOpen }: { onOpen: (id: string) => void }) {
  const requests = useServiceRequests({ scope: 'proposed' })
  const items = requests.data?.items ?? []

  if (requests.isLoading) return <CardGridSkeleton />
  if (requests.isError) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="제안 내역을 불러오지 못했습니다"
        description={requests.error instanceof Error ? requests.error.message : undefined}
      />
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="아직 보낸 제안이 없습니다"
        description="공개 의뢰 탭에서 마음에 드는 의뢰에 제안을 보내 보세요."
      />
    )
  }

  return (
    <>
      <p className="mb-2 text-xs text-text-subtle">총 {requests.data?.total ?? 0}건</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((request) => (
          <MarketRequestCard
            key={request.id}
            request={request}
            onOpen={() => onOpen(request.id)}
            showStatus
          />
        ))}
      </div>
    </>
  )
}

function AssignedTab({ onOpen }: { onOpen: (id: string) => void }) {
  const requests = useServiceRequests({ scope: 'assigned' })
  const items = requests.data?.items ?? []

  if (requests.isLoading) return <CardGridSkeleton />
  if (requests.isError) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="작업을 불러오지 못했습니다"
        description={requests.error instanceof Error ? requests.error.message : undefined}
      />
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="배정된 작업이 없습니다"
        description="제안이 수락되면 진행 중 작업으로 이곳에 표시됩니다."
      />
    )
  }

  return (
    <>
      <p className="mb-2 text-xs text-text-subtle">총 {requests.data?.total ?? 0}건</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((request) => (
          <MarketRequestCard
            key={request.id}
            request={request}
            onOpen={() => onOpen(request.id)}
            showStatus
          />
        ))}
      </div>
    </>
  )
}

// ── 전문가 디렉터리 ──────────────────────────────────────────────────────────────

function ProviderCard({ provider, onOpen }: { provider: ProviderProfileDto; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-accent-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-text">
            <span className="truncate">{provider.displayName}</span>
            {provider.verified ? (
              <BadgeCheck className="size-4 shrink-0 text-accent-strong" aria-label="검증됨" />
            ) : null}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-text-muted">{provider.headline}</p>
        </div>
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
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-subtle">
        <div className="inline-flex items-center gap-1.5">
          <dt className="sr-only">소속</dt>
          <dd className="truncate text-text-muted">{provider.orgName}</dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <dt className="sr-only">평점</dt>
          <dd>
            <RatingStars value={provider.avgRating} count={provider.reviewCount} />
          </dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <dt className="sr-only">시간당 단가</dt>
          <dd className="font-medium text-text-muted">{formatKrw(provider.hourlyRate)}</dd>
        </div>
        <div className="ml-auto inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5" aria-hidden />
          <dt className="sr-only">완료</dt>
          <dd>완료 {provider.completedCount}건</dd>
        </div>
      </dl>
    </button>
  )
}

function ProviderDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const provider = useProvider(id)
  const p = provider.data
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" sheet>
        {provider.isLoading ? (
          <>
            <DialogHeader>
              <DialogTitle>전문가</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </>
        ) : provider.isError || !p ? (
          <>
            <DialogHeader>
              <DialogTitle>전문가</DialogTitle>
            </DialogHeader>
            <EmptyState icon={Users} title="전문가를 불러오지 못했습니다" />
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                {p.verified ? (
                  <Badge tone="accent" size="sm">
                    <BadgeCheck className="size-3" aria-hidden /> 검증됨
                  </Badge>
                ) : (
                  <Badge tone="outline" size="sm">
                    미검증
                  </Badge>
                )}
                <span className="text-xs text-text-subtle">완료 {p.completedCount}건</span>
                <RatingStars value={p.avgRating} count={p.reviewCount} />
              </div>
              <DialogTitle>{p.displayName}</DialogTitle>
              <DialogDescription>
                {p.headline} · {p.orgName}
              </DialogDescription>
            </DialogHeader>

            {p.specialties.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {p.specialties.map((tag) => (
                  <Badge key={tag} tone="outline" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}

            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text">{p.bio}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <div>
                <dt className="text-xs text-text-subtle">활동 관할</dt>
                <dd className="mt-0.5 text-text-muted">{p.jurisdictions}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-subtle">시간당 단가</dt>
                <dd className="mt-0.5 text-text-muted">{formatKrw(p.hourlyRate)}</dd>
              </div>
              {p.contact ? (
                <div className="col-span-2">
                  <dt className="text-xs text-text-subtle">연락처</dt>
                  <dd className="mt-0.5 break-all text-text-muted">{p.contact}</dd>
                </div>
              ) : null}
            </dl>

            {p.reviews && p.reviews.length > 0 ? (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold text-text">후기 {p.reviewCount}건</h3>
                <ul className="space-y-3">
                  {p.reviews.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-md border border-border bg-surface-2/40 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                          {'★'.repeat(r.rating)}
                          <span className="text-text-subtle">{r.rating}.0</span>
                        </span>
                        <span className="truncate text-xs text-text-subtle">{r.requestTitle}</span>
                      </div>
                      {r.comment ? (
                        <p className="mt-1 whitespace-pre-wrap break-words text-[0.8125rem] text-text-muted">
                          {r.comment}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[0.6875rem] text-text-subtle">
                        {r.reviewerName} · {formatDate(r.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ProvidersTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [specialty, setSpecialty] = useState('')
  const providers = useProviders(specialty || undefined)
  const items = providers.data?.items ?? []

  return (
    <>
      <div className="mb-4 sm:w-56">
        <Select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          aria-label="전문 분야 필터"
        >
          <option value="">모든 전문 분야</option>
          {POLICY_TYPES.map((t) => (
            <option key={t} value={POLICY_TYPE_LABELS[t]}>
              {POLICY_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>

      {providers.isLoading ? (
        <CardGridSkeleton />
      ) : providers.isError ? (
        <EmptyState
          icon={Users}
          title="전문가를 불러오지 못했습니다"
          description={providers.error instanceof Error ? providers.error.message : undefined}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={specialty ? '조건에 맞는 전문가가 없습니다' : '등록된 전문가가 없습니다'}
          description={
            specialty
              ? '다른 전문 분야로 다시 시도해 보세요.'
              : '전문가가 프로필을 등록하면 여기에 표시됩니다.'
          }
          action={
            specialty ? (
              <Button variant="secondary" onClick={() => setSpecialty('')}>
                필터 초기화
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-text-subtle">
            총 {providers.data?.total ?? 0}명 · 검증·완료 순
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onOpen={() => setSelectedId(provider.id)}
              />
            ))}
          </div>
        </>
      )}
      {selectedId ? (
        <ProviderDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  )
}
