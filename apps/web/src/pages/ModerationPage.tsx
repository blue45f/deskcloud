import {
  ESCROW_STATUS_LABELS,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  TERMINAL_REQUEST_STATUSES,
  can,
  formatKrw,
  type ProviderProfileDto,
  type ServiceRequestDto,
  type ServiceRequestStatus,
} from '@termsdesk/shared'
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Flag,
  Inbox,
  ShieldAlert,
  UserCog,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useConfirm } from '@/app/useConfirm'
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
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Textarea } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSession } from '@/services/auth'
import {
  useAdminProviders,
  useAdminRequests,
  useAdminUpdateProvider,
  useAdminUpdateRequest,
} from '@/services/brokerage'
import { formatDateTime, formatRelative } from '@/utils/format'

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

function StatusFilterPills({
  value,
  onChange,
}: {
  value: ServiceRequestStatus | 'all'
  onChange: (next: ServiceRequestStatus | 'all') => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="상태 필터">
      {(['all', ...SERVICE_REQUEST_STATUSES] as (ServiceRequestStatus | 'all')[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={
            value === option
              ? 'rounded-full border border-accent-strong bg-accent-soft px-3 py-1.5 text-sm font-medium text-text transition-colors focus-visible:ring-2 focus-visible:ring-accent-strong'
              : 'rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong'
          }
        >
          {option === 'all' ? '전체' : SERVICE_REQUEST_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

/** 의뢰 모더레이션 상세 — 운영 메모 작성 + 강제 취소. */
function RequestModerationDialog({
  request,
  onClose,
}: {
  request: ServiceRequestDto
  onClose: () => void
}) {
  const [adminNote, setAdminNote] = useState(request.adminNote ?? '')
  const [disputeNote, setDisputeNote] = useState(request.disputeNote ?? '')
  const update = useAdminUpdateRequest(request.id)
  const confirm = useConfirm()
  const terminal = TERMINAL_REQUEST_STATUSES.includes(request.status)
  const canDecideEscrow = request.escrowStatus === 'held'

  const onSaveNote = () => {
    update.mutate(
      {
        adminNote: adminNote.trim() === '' ? null : adminNote.trim(),
        disputeNote: disputeNote.trim() === '' ? null : disputeNote.trim(),
      },
      {
        onSuccess: () => {
          toast.success('운영 메모를 저장했습니다')
          onClose()
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '저장에 실패했습니다'),
      }
    )
  }

  const onForceCancel = async () => {
    const ok = await confirm({
      title: `'${request.title}' 의뢰를 강제 취소할까요?`,
      description: '진행 중인 매칭·제안이 모두 종료되며 되돌릴 수 없습니다.',
      confirmText: '강제 취소',
      danger: true,
    })
    if (!ok) return
    update.mutate(
      {
        status: 'cancelled',
        flagged: false,
        adminNote: adminNote.trim() === '' ? null : adminNote.trim(),
        disputeNote: disputeNote.trim() === '' ? null : disputeNote.trim(),
      },
      {
        onSuccess: () => {
          toast.success('의뢰를 강제 취소했습니다')
          onClose()
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '취소에 실패했습니다'),
      }
    )
  }

  const onResolveDispute = async () => {
    const ok = await confirm({
      title: '분쟁 검토를 종료할까요?',
      description: '분쟁 큐에서 제거하고 참여자에게 검토 종료 알림을 보냅니다.',
      confirmText: '분쟁 종료',
    })
    if (!ok) return
    update.mutate(
      {
        flagged: false,
        adminNote: adminNote.trim() === '' ? null : adminNote.trim(),
        disputeNote: disputeNote.trim() === '' ? null : disputeNote.trim(),
      },
      {
        onSuccess: () => {
          toast.success('분쟁 검토를 종료했습니다')
          onClose()
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '분쟁 종료에 실패했습니다'),
      }
    )
  }

  const onEscrowDecision = async (decision: 'release' | 'refund') => {
    const ok = await confirm({
      title: decision === 'release' ? '정산으로 결정할까요?' : '환불로 결정할까요?',
      description:
        decision === 'release'
          ? '의뢰를 완료 처리하고 모의 에스크로를 정산 완료로 기록합니다.'
          : '의뢰를 취소 처리하고 모의 에스크로를 환불로 기록합니다.',
      confirmText: decision === 'release' ? '정산 결정' : '환불 결정',
      danger: decision === 'refund',
    })
    if (!ok) return
    update.mutate(
      {
        escrowDecision: decision,
        flagged: false,
        adminNote: adminNote.trim() === '' ? null : adminNote.trim(),
        disputeNote: disputeNote.trim() === '' ? null : disputeNote.trim(),
      },
      {
        onSuccess: () => {
          toast.success(
            decision === 'release' ? '정산 결정으로 처리했습니다' : '환불 결정으로 처리했습니다'
          )
          onClose()
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '결정 처리에 실패했습니다'),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <RequestStatusPill status={request.status} />
            {request.flagged ? (
              <Badge tone="warning" size="sm">
                <Flag className="size-3" aria-hidden /> 분쟁 큐
              </Badge>
            ) : null}
            <Badge tone="outline" size="sm">
              {SERVICE_REQUEST_TYPE_LABELS[request.serviceType]}
            </Badge>
            <PolicyTypeBadge type={request.policyType} />
            <span className="text-xs text-text-subtle">{formatDateTime(request.createdAt)}</span>
          </div>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>
            {request.requesterOrgName}
            {' · 제안 '}
            {request.proposalCount}건
            {request.assignedProviderName ? ` · 담당 ${request.assignedProviderName}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-surface-2/40 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-xs text-text-subtle">
              <Wallet className="size-3.5" aria-hidden /> 모의 에스크로
            </div>
            <div className="mt-1 text-sm font-medium text-text">
              {ESCROW_STATUS_LABELS[request.escrowStatus]}
              {request.escrowAmount != null ? (
                <span className="ml-1 text-text-muted">{formatKrw(request.escrowAmount)}</span>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface-2/40 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-xs text-text-subtle">
              <Flag className="size-3.5" aria-hidden /> 분쟁 상태
            </div>
            <div className="mt-1 text-sm font-medium text-text">
              {request.flagged ? '검토 대기' : '일반'}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface-2/40 px-3.5 py-3">
          <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
            {request.description}
          </p>
        </div>

        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <Field
            label="운영 메모"
            htmlFor="mod-admin-note"
            hint="내부 기록용 — 의뢰자·전문가에게 보이지 않습니다."
          >
            <Textarea
              id="mod-admin-note"
              rows={4}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="중재 사유, 후속 조치, 담당자 메모 등"
            />
          </Field>

          <Field
            label="분쟁 메모"
            htmlFor="mod-dispute-note"
            hint="참여자에게도 보이는 분쟁 사유·중재 결과입니다."
          >
            <Textarea
              id="mod-dispute-note"
              rows={5}
              value={disputeNote}
              onChange={(e) => setDisputeNote(e.target.value)}
              placeholder="이의제기 사유, 판단 근거, 정산/환불 결정 사유 등"
            />
          </Field>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => void onEscrowDecision('release')}
              disabled={!canDecideEscrow || update.isPending}
            >
              <CheckCircle2 className="size-4" aria-hidden />
              정산 결정
            </Button>
            <Button
              variant="danger"
              onClick={() => void onEscrowDecision('refund')}
              disabled={!canDecideEscrow || update.isPending}
            >
              <Wallet className="size-4" aria-hidden />
              환불 결정
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="danger"
              onClick={() => void onForceCancel()}
              disabled={terminal || update.isPending}
            >
              <Ban className="size-4" aria-hidden />
              강제 취소
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => void onResolveDispute()}
                disabled={!request.flagged || update.isPending}
              >
                분쟁 종료
              </Button>
              <Button onClick={onSaveNote} loading={update.isPending}>
                메모 저장
              </Button>
            </div>
          </div>
          {terminal ? (
            <p className="text-xs text-text-subtle">
              이미 종료된 의뢰입니다. 운영 메모만 수정할 수 있습니다.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RequestsModerationTab() {
  const [status, setStatus] = useState<ServiceRequestStatus | 'all'>('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [selected, setSelected] = useState<ServiceRequestDto | null>(null)
  const requests = useAdminRequests(
    status === 'all' ? undefined : status,
    flaggedOnly ? true : undefined
  )
  const items = requests.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusFilterPills value={status} onChange={setStatus} />
        <Button
          variant={flaggedOnly ? 'accent' : 'secondary'}
          size="sm"
          onClick={() => setFlaggedOnly((v) => !v)}
        >
          <Flag className="size-4" aria-hidden />
          분쟁 큐
        </Button>
      </div>

      {requests.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : requests.isError ? (
        <EmptyState
          icon={Inbox}
          title="의뢰를 불러오지 못했습니다"
          description={requests.error instanceof Error ? requests.error.message : undefined}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={status === 'all' ? '의뢰가 없습니다' : '조건에 맞는 의뢰가 없습니다'}
          description={
            flaggedOnly
              ? '이의제기가 접수된 의뢰가 없습니다.'
              : '플랫폼에 올라온 모든 의뢰가 여기에서 모더레이션됩니다.'
          }
        />
      ) : (
        <>
          <p className="text-xs text-text-subtle">총 {requests.data?.total ?? items.length}건</p>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <THead>
                <TR className="bg-surface-2/60">
                  <TH>조직</TH>
                  <TH>제목</TH>
                  <TH>상태</TH>
                  <TH className="hidden text-right sm:table-cell">제안</TH>
                  <TH className="hidden md:table-cell">생성</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((r) => (
                  <TR
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer hover:bg-surface-2/50"
                  >
                    <TD className="max-w-[160px] truncate text-text-muted">{r.requesterOrgName}</TD>
                    <TD className="max-w-[280px]">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="flex max-w-full items-center gap-1.5 truncate text-left font-medium text-text outline-none hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong"
                      >
                        <span className="truncate">{r.title}</span>
                        {r.adminNote ? (
                          <Badge tone="warning" size="sm">
                            메모
                          </Badge>
                        ) : null}
                        {r.flagged ? (
                          <Badge tone="warning" size="sm">
                            분쟁
                          </Badge>
                        ) : null}
                      </button>
                    </TD>
                    <TD>
                      <RequestStatusPill status={r.status} />
                    </TD>
                    <TD className="hidden text-right text-text-muted sm:table-cell">
                      {r.proposalCount}
                    </TD>
                    <TD
                      className="hidden whitespace-nowrap text-xs text-text-subtle md:table-cell"
                      title={formatDateTime(r.createdAt)}
                    >
                      {formatRelative(r.createdAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}

      {selected ? (
        <RequestModerationDialog
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}

function ProviderToggleRow({ provider }: { provider: ProviderProfileDto }) {
  const update = useAdminUpdateProvider(provider.id)

  const onToggle = (field: 'verified' | 'active', next: boolean) => {
    update.mutate(field === 'verified' ? { verified: next } : { active: next }, {
      onSuccess: () =>
        toast.success(
          field === 'verified'
            ? next
              ? `${provider.displayName} 검증 완료`
              : `${provider.displayName} 검증 해제`
            : next
              ? `${provider.displayName} 활성화`
              : `${provider.displayName} 비활성화`
        ),
      onError: (e) => toast.error(e instanceof Error ? e.message : '변경에 실패했습니다'),
    })
  }

  return (
    <TR className={update.isPending ? 'opacity-60' : undefined}>
      <TD>
        <div className="font-medium text-text">{provider.displayName}</div>
        <div className="text-xs text-text-subtle">{provider.orgName}</div>
      </TD>
      <TD className="hidden max-w-[260px] text-text-muted lg:table-cell">
        <span className="line-clamp-2">{provider.headline || '—'}</span>
      </TD>
      <TD className="hidden md:table-cell">
        {provider.specialties.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {provider.specialties.slice(0, 3).map((s) => (
              <Badge key={s} tone="outline" size="sm">
                {s}
              </Badge>
            ))}
            {provider.specialties.length > 3 ? (
              <span className="text-xs text-text-subtle">+{provider.specialties.length - 3}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </TD>
      <TD className="hidden text-text-muted sm:table-cell">{provider.contact ?? '—'}</TD>
      <TD className="text-right text-text-muted">{provider.completedCount}</TD>
      <TD>
        <div className="flex items-center gap-1.5">
          <Switch
            checked={provider.verified}
            onCheckedChange={(next) => onToggle('verified', next)}
            disabled={update.isPending}
            aria-label={`${provider.displayName} 검증`}
          />
          <span className="text-xs text-text-subtle">검증</span>
        </div>
      </TD>
      <TD>
        <div className="flex items-center gap-1.5">
          <Switch
            checked={provider.active}
            onCheckedChange={(next) => onToggle('active', next)}
            disabled={update.isPending}
            aria-label={`${provider.displayName} 활성`}
          />
          <span className="text-xs text-text-subtle">활성</span>
        </div>
      </TD>
    </TR>
  )
}

function ProvidersModerationTab() {
  const providers = useAdminProviders()
  const items = providers.data?.items ?? []

  if (providers.isLoading) return <Skeleton className="h-64 w-full" />
  if (providers.isError) {
    return (
      <EmptyState
        icon={UserCog}
        title="전문가를 불러오지 못했습니다"
        description={providers.error instanceof Error ? providers.error.message : undefined}
      />
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={UserCog}
        title="등록된 전문가가 없습니다"
        description="전문가가 프로필을 등록하면 여기에서 검증·활성 상태를 관리합니다."
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-subtle">총 {providers.data?.total ?? items.length}명</p>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <THead>
            <TR className="bg-surface-2/60">
              <TH>이름</TH>
              <TH className="hidden lg:table-cell">소개</TH>
              <TH className="hidden md:table-cell">전문 분야</TH>
              <TH className="hidden sm:table-cell">연락처</TH>
              <TH className="text-right">완료</TH>
              <TH>검증</TH>
              <TH>활성</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((p) => (
              <ProviderToggleRow key={p.id} provider={p} />
            ))}
          </TBody>
        </Table>
      </div>
      <p className="text-xs text-text-subtle">
        <BadgeCheck className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
        검증 배지는 의뢰자에게 신뢰 신호로 노출됩니다. 비활성 전문가는 마켓플레이스에서 숨겨집니다.
      </p>
    </div>
  )
}

export default function ModerationPage() {
  useDocumentTitle('중계 모더레이션')
  const session = useSession()
  const navigate = useNavigate()

  const me = session.data?.user
  const isAdmin = me ? can(me.role, 'member.manage') : false

  if (session.data && !isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="권한이 없습니다"
        description="중계 모더레이션은 플랫폼 운영자(소유자·관리자)만 접근할 수 있습니다."
        action={
          <Button variant="secondary" onClick={() => navigate('/app')}>
            대시보드로 이동
          </Button>
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        title="중계 모더레이션"
        description="플랫폼에 올라온 모든 의뢰를 중재하고, 전문가의 검증·활성 상태를 관리합니다. (운영자 전용)"
      />

      <Tabs defaultValue="requests">
        <TabsList className="mb-4">
          <TabsTrigger value="requests">의뢰 모더레이션</TabsTrigger>
          <TabsTrigger value="providers">전문가 검증</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <RequestsModerationTab />
        </TabsContent>
        <TabsContent value="providers">
          <ProvidersModerationTab />
        </TabsContent>
      </Tabs>
    </>
  )
}
