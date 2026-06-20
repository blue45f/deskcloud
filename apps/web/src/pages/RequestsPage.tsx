import {
  REQUEST_TEMPLATES,
  REQUEST_VISIBILITIES,
  REQUEST_VISIBILITY_LABELS,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_TYPES,
  SERVICE_REQUEST_TYPE_LABELS,
  POLICY_TYPES,
  POLICY_TYPE_LABELS,
  TERMINAL_REQUEST_STATUSES,
  can,
  createServiceRequestSchema,
  formatBudgetRange,
  type CreateServiceRequestInput,
  type RequestTemplate,
  type ServiceRequestDto,
  type ServiceRequestStatus,
  type ServiceRequestType,
} from '@termsdesk/shared'
import { CalendarClock, FileText, MessagesSquare, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import type { z } from 'zod'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, PolicyTypeBadge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSession } from '@/services/auth'
import { useCreateServiceRequest, useServiceRequests } from '@/services/brokerage'
import { cn } from '@/utils/cn'
import { formatDate, formatRelative } from '@/utils/format'
import { zodFormResolver } from '@/utils/zodFormResolver'

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

function FilterPills<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string
  value: T | 'all'
  options: readonly T[]
  optionLabel: (option: T | 'all') => string
  onChange: (next: T | 'all') => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      {(['all', ...options] as (T | 'all')[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-strong',
            value === option
              ? 'border-accent-strong bg-accent-soft text-text'
              : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text'
          )}
        >
          {optionLabel(option)}
        </button>
      ))}
    </div>
  )
}

function RequestCard({ request, onOpen }: { request: ServiceRequestDto; onOpen: () => void }) {
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
        <RequestStatusPill status={request.status} />
        <Badge tone="outline" size="sm">
          {SERVICE_REQUEST_TYPE_LABELS[request.serviceType]}
        </Badge>
        <PolicyTypeBadge type={request.policyType} />
        {request.visibility === 'private' ? <Badge size="sm">비공개</Badge> : null}
      </div>

      <div className="min-w-0">
        <h3 className="truncate font-medium text-text">{request.title}</h3>
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

function CreateRequestDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const create = useCreateServiceRequest()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof createServiceRequestSchema>, unknown, CreateServiceRequestInput>({
    resolver: zodFormResolver(createServiceRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      serviceType: 'review',
      policyType: 'terms',
      jurisdiction: 'KR',
      budgetMin: '',
      budgetMax: '',
      deadline: '',
      visibility: 'public',
    },
  })

  const onSubmit = (values: CreateServiceRequestInput) => {
    create.mutate(values, {
      onSuccess: (created) => {
        toast.success('의뢰를 등록했습니다')
        setOpen(false)
        reset()
        navigate(`/app/requests/${created.id}`)
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '등록에 실패했습니다'),
    })
  }

  // 빠른 시작 — 템플릿으로 제목·설명·종류를 미리 채운다(이후 자유 편집).
  const applyTemplate = (t: RequestTemplate) => {
    reset({
      title: t.title,
      description: t.description,
      serviceType: t.serviceType,
      policyType: t.policyType,
      jurisdiction: 'KR',
      budgetMin: '',
      budgetMax: '',
      deadline: '',
      visibility: 'public',
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />새 의뢰 올리기
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>새 의뢰 올리기</DialogTitle>
        </DialogHeader>
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-text-subtle">
            빠른 시작 — 템플릿을 고르면 내용이 채워집니다(자유 편집 가능)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REQUEST_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => applyTemplate(t)}
                className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-accent-strong hover:bg-accent-soft hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="제목" htmlFor="req-title" error={errors.title?.message} required>
            <Input
              id="req-title"
              placeholder="예: SaaS 이용약관 신규 작성 (KR)"
              {...register('title')}
            />
          </Field>

          <Field
            label="상세 설명"
            htmlFor="req-description"
            error={errors.description?.message}
            hint="배경, 범위, 참고 자료, 원하는 결과를 구체적으로 적어 주세요."
            required
          >
            <Textarea
              id="req-description"
              rows={5}
              placeholder="어떤 약관·정책 작업이 필요한지 설명해 주세요."
              {...register('description')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="의뢰 종류" htmlFor="req-service-type">
              <Select id="req-service-type" {...register('serviceType')}>
                {SERVICE_REQUEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SERVICE_REQUEST_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="문서 종류" htmlFor="req-policy-type">
              <Select id="req-policy-type" {...register('policyType')}>
                {POLICY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {POLICY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="관할(국가 코드)"
              htmlFor="req-jurisdiction"
              error={errors.jurisdiction?.message}
            >
              <Input id="req-jurisdiction" placeholder="KR" {...register('jurisdiction')} />
            </Field>
            <Field label="공개 범위" htmlFor="req-visibility">
              <Select id="req-visibility" {...register('visibility')}>
                {REQUEST_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {REQUEST_VISIBILITY_LABELS[v]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="최소 예산(₩)"
              htmlFor="req-budget-min"
              error={errors.budgetMin?.message}
              hint="선택 · 비우면 협의"
            >
              <Input
                id="req-budget-min"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="예: 500000"
                {...register('budgetMin', { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="최대 예산(₩)"
              htmlFor="req-budget-max"
              error={errors.budgetMax?.message}
              hint="선택 · 비우면 협의"
            >
              <Input
                id="req-budget-max"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="예: 1500000"
                {...register('budgetMax', { valueAsNumber: true })}
              />
            </Field>
          </div>

          <Field label="마감 희망일" htmlFor="req-deadline" error={errors.deadline?.message}>
            <Input id="req-deadline" type="date" {...register('deadline')} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" loading={create.isPending}>
              등록
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function RequestsPage() {
  useDocumentTitle('약관 의뢰')
  const navigate = useNavigate()
  const session = useSession()
  const [searchParams, setSearchParams] = useSearchParams()

  const canManage = session.data ? can(session.data.user.role, 'request.manage') : false

  const rawStatus = searchParams.get('status')
  const status: ServiceRequestStatus | 'all' = SERVICE_REQUEST_STATUSES.includes(
    rawStatus as ServiceRequestStatus
  )
    ? (rawStatus as ServiceRequestStatus)
    : 'all'
  const rawType = searchParams.get('type')
  const type: ServiceRequestType | 'all' = SERVICE_REQUEST_TYPES.includes(
    rawType as ServiceRequestType
  )
    ? (rawType as ServiceRequestType)
    : 'all'

  const setParam = (key: 'status' | 'type', value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value === 'all') params.delete(key)
    else params.set(key, value)
    setSearchParams(params, { replace: true })
  }

  const requests = useServiceRequests({
    scope: 'mine',
    status: status === 'all' ? undefined : status,
    type: type === 'all' ? undefined : type,
  })

  const items = requests.data?.items ?? []
  const filterActive = status !== 'all' || type !== 'all'

  return (
    <>
      <PageHeader
        title="약관 의뢰"
        description="우리 조직이 올린 약관 작성·검토·개정·번역 의뢰를 한곳에서 관리하고, 전문가의 제안을 받아 매칭합니다."
        actions={canManage ? <CreateRequestDialog /> : undefined}
      />

      <div className="mb-4 space-y-2">
        <FilterPills
          label="상태 필터"
          value={status}
          options={SERVICE_REQUEST_STATUSES}
          optionLabel={(o) => (o === 'all' ? '전체' : SERVICE_REQUEST_STATUS_LABELS[o])}
          onChange={(next) => setParam('status', next)}
        />
        <FilterPills
          label="종류 필터"
          value={type}
          options={SERVICE_REQUEST_TYPES}
          optionLabel={(o) => (o === 'all' ? '모든 종류' : SERVICE_REQUEST_TYPE_LABELS[o])}
          onChange={(next) => setParam('type', next)}
        />
      </div>

      {requests.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : requests.isError ? (
        <EmptyState
          icon={FileText}
          title="의뢰를 불러오지 못했습니다"
          description={requests.error instanceof Error ? requests.error.message : undefined}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filterActive ? '조건에 맞는 의뢰가 없습니다' : '아직 올린 의뢰가 없습니다'}
          description={
            filterActive
              ? '다른 상태나 종류로 다시 시도해 보세요.'
              : '약관 작성·검토가 필요하면 의뢰를 올리고 전문가의 제안을 받아 보세요.'
          }
          action={
            filterActive ? (
              <Button variant="secondary" onClick={() => setSearchParams({}, { replace: true })}>
                필터 초기화
              </Button>
            ) : canManage ? (
              <CreateRequestDialog />
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-text-subtle">총 {requests.data?.total ?? 0}건</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onOpen={() => navigate(`/app/requests/${request.id}`)}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
