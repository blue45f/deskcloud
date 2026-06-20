import {
  ESCROW_STATUS_LABELS,
  formatBudgetRange,
  formatKrw,
  PROPOSAL_STATUS_LABELS,
  REQUEST_VISIBILITY_LABELS,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  SERVICE_REQUEST_TYPES,
  updateServiceRequestSchema,
  type ProposalDto,
  type RequestAttachmentDto,
  type RequestMessageDto,
  type ServiceRequestDto,
  type ServiceRequestStatus,
  type UpdateServiceRequestInput,
} from '@termsdesk/shared'
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Flag,
  FileDown,
  FileText,
  Inbox,
  Link2,
  PackageCheck,
  Paperclip,
  Pencil,
  PlayCircle,
  RefreshCcw,
  Send,
  ShieldCheck,
  Star,
  Undo2,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import type { z } from 'zod'

import { useConfirm } from '@/app/useConfirm'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, PolicyTypeBadge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, RatingStars, Skeleton, Spinner } from '@/components/ui/feedback'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { apiUrl } from '@/services/api'
import { useSession } from '@/services/auth'
import {
  useAcceptProposal,
  useFlagRequest,
  useImportToPolicy,
  usePostMessage,
  useRequestAction,
  useRequestRevision,
  useServiceRequest,
  useSubmitProposal,
  useSubmitReview,
  useUploadRequestAttachment,
  useUpdateServiceRequest,
  useWithdrawProposal,
} from '@/services/brokerage'
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

function StatusBadge({ status }: { status: ServiceRequestStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot={status === 'open' || status === 'in_progress'}>
      {SERVICE_REQUEST_STATUS_LABELS[status]}
    </Badge>
  )
}

const PROPOSAL_TONE: Record<ProposalDto['status'], BadgeProps['tone']> = {
  submitted: 'info',
  accepted: 'success',
  rejected: 'neutral',
  withdrawn: 'outline',
}

function MetaItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-text-subtle" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-text-subtle">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-text">{children}</dd>
      </div>
    </div>
  )
}

// ── 의뢰 수정 다이얼로그(의뢰자·open 상태) ───────────────────────────────────────

function EditRequestDialog({
  request,
  onClose,
}: {
  request: ServiceRequestDto
  onClose: () => void
}) {
  const update = useUpdateServiceRequest(request.id)
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<z.input<typeof updateServiceRequestSchema>, unknown, UpdateServiceRequestInput>({
    resolver: zodFormResolver(updateServiceRequestSchema),
    defaultValues: {
      title: request.title,
      description: request.description,
      serviceType: request.serviceType,
      budgetMin: request.budgetMin ?? '',
      budgetMax: request.budgetMax ?? '',
      deadline: request.deadline ?? '',
    },
  })

  const onSubmit = (values: UpdateServiceRequestInput) => {
    update.mutate(values, {
      onSuccess: () => {
        toast.success('의뢰 내용을 수정했습니다')
        onClose()
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '수정에 실패했습니다'),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>의뢰 수정</DialogTitle>
          <DialogDescription>제안 모집 중일 때만 의뢰 내용을 수정할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="제목" htmlFor="edit-title" error={errors.title?.message} required>
            <Input id="edit-title" {...register('title')} />
          </Field>
          <Field label="의뢰 종류" htmlFor="edit-service-type" error={errors.serviceType?.message}>
            <Select id="edit-service-type" {...register('serviceType')}>
              {SERVICE_REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SERVICE_REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="상세 설명"
            htmlFor="edit-description"
            error={errors.description?.message}
            required
          >
            <Textarea id="edit-description" rows={8} {...register('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="최소 예산 (KRW)"
              htmlFor="edit-budget-min"
              error={errors.budgetMin?.message}
            >
              <Input
                id="edit-budget-min"
                type="number"
                min={0}
                placeholder="협의"
                {...register('budgetMin', { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="최대 예산 (KRW)"
              htmlFor="edit-budget-max"
              error={errors.budgetMax?.message}
            >
              <Input
                id="edit-budget-max"
                type="number"
                min={0}
                placeholder="협의"
                {...register('budgetMax', { valueAsNumber: true })}
              />
            </Field>
          </div>
          <Field label="희망 마감일" htmlFor="edit-deadline" error={errors.deadline?.message}>
            <Input id="edit-deadline" type="date" {...register('deadline')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!isDirty}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── 제안 작성 다이얼로그(전문가·guest, open 상태) ────────────────────────────────

function SubmitProposalDialog({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [quotedAmount, setQuotedAmount] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('')
  const submit = useSubmitProposal(requestId)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit.mutate(
      {
        message: message.trim(),
        quotedAmount: quotedAmount === '' ? undefined : Number(quotedAmount),
        estimatedDays: estimatedDays === '' ? undefined : Number(estimatedDays),
      },
      {
        onSuccess: () => {
          toast.success('제안을 제출했습니다')
          onClose()
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : '제안 제출에 실패했습니다'),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>제안 보내기</DialogTitle>
          <DialogDescription>
            의뢰자가 검토할 제안 내용과 견적(선택)을 작성합니다. 금액은 협의용 메타데이터입니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            label="제안 메시지"
            htmlFor="proposal-message"
            hint="접근 방식, 경험, 진행 계획 등(20자 이상)"
            required
          >
            <Textarea
              id="proposal-message"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="이 의뢰를 어떻게 진행할지 설명해 주세요…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="견적 금액 (KRW)" htmlFor="proposal-amount" hint="비우면 협의">
              <Input
                id="proposal-amount"
                type="number"
                min={0}
                value={quotedAmount}
                onChange={(e) => setQuotedAmount(e.target.value)}
                placeholder="협의"
              />
            </Field>
            <Field label="예상 소요일" htmlFor="proposal-days" hint="작업 일수(선택)">
              <Input
                id="proposal-days"
                type="number"
                min={1}
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(e.target.value)}
                placeholder="예: 7"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" loading={submit.isPending}>
              제안 제출
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── 제안 카드 ───────────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  canAccept,
  onAccept,
  accepting,
  canWithdraw,
  onWithdraw,
  withdrawing,
}: {
  proposal: ProposalDto
  canAccept: boolean
  onAccept: () => void
  accepting: boolean
  canWithdraw: boolean
  onWithdraw: () => void
  withdrawing: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-text">{proposal.providerName}</span>
            {proposal.provider?.verified ? (
              <Badge tone="info" size="sm">
                <BadgeCheck className="size-3" aria-hidden /> 검증됨
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {proposal.providerOrgName}
            {proposal.provider?.headline ? ` · ${proposal.provider.headline}` : ''}
          </p>
        </div>
        <Badge tone={PROPOSAL_TONE[proposal.status]} size="sm">
          {PROPOSAL_STATUS_LABELS[proposal.status]}
        </Badge>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text">
        {proposal.message}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-text-muted">
        <div className="flex items-center gap-1">
          <Wallet className="size-3.5 text-text-subtle" aria-hidden />
          <dt className="sr-only">견적</dt>
          <dd className="font-medium text-text">{formatKrw(proposal.quotedAmount)}</dd>
        </div>
        {proposal.estimatedDays != null ? (
          <div className="flex items-center gap-1">
            <CalendarClock className="size-3.5 text-text-subtle" aria-hidden />
            <dt className="sr-only">예상 소요</dt>
            <dd>예상 {proposal.estimatedDays}일</dd>
          </div>
        ) : null}
        {proposal.provider ? (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-text-subtle" aria-hidden />
            <dt className="sr-only">완료 이력</dt>
            <dd>완료 {proposal.provider.completedCount}건</dd>
          </div>
        ) : null}
        {proposal.provider ? (
          <div className="flex items-center gap-1">
            <dt className="sr-only">평점</dt>
            <dd>
              <RatingStars
                value={proposal.provider.avgRating}
                count={proposal.provider.reviewCount}
              />
            </dd>
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <dt className="sr-only">제출</dt>
          <dd className="text-text-subtle" title={proposal.createdAt}>
            {formatRelative(proposal.createdAt)}
          </dd>
        </div>
      </dl>

      {canAccept || canWithdraw ? (
        <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
          {canWithdraw ? (
            <Button size="sm" variant="ghost" loading={withdrawing} onClick={onWithdraw}>
              <Undo2 className="size-4" aria-hidden /> 제안 철회
            </Button>
          ) : null}
          {canAccept ? (
            <Button size="sm" variant="accent" loading={accepting} onClick={onAccept}>
              <CheckCircle2 className="size-4" aria-hidden /> 이 제안 수락
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── 메시지 스레드 ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<RequestMessageDto['authorRole'], string> = {
  requester: '의뢰자',
  provider: '전문가',
  admin: '운영자',
}

function formatAttachmentSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`
  return `${bytes}B`
}

function AttachmentList({
  requestId,
  attachments,
}: {
  requestId: string
  attachments: RequestAttachmentDto[]
}) {
  if (attachments.length === 0) return null
  return (
    <ul className="mt-2 space-y-1.5 border-t border-current/10 pt-2">
      {attachments.map((file) => (
        <li key={file.id}>
          <a
            href={apiUrl(`requests/${requestId}/attachments/${file.id}`)}
            className="inline-flex max-w-full items-center gap-2 rounded-md border border-current/15 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-current/5 focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            <FileDown className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{file.fileName}</span>
            <span className="shrink-0 text-current/65">{formatAttachmentSize(file.sizeBytes)}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function MessageBubble({
  message,
  mine,
  canFlag,
  onFlag,
}: {
  message: RequestMessageDto
  mine: boolean
  canFlag: boolean
  onFlag: () => void
}) {
  if (message.kind === 'system') {
    return (
      <div className="flex justify-center">
        <p className="rounded-full bg-surface-2 px-3 py-1 text-xs text-text-subtle">
          {message.body}
        </p>
      </div>
    )
  }

  const isDelivery = message.kind === 'delivery'
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div className="flex items-center gap-1.5 px-1 text-xs text-text-subtle">
        <span className="font-medium text-text-muted">{message.authorName}</span>
        <span>· {ROLE_LABEL[message.authorRole]}</span>
        {isDelivery ? (
          <Badge tone="success" size="sm">
            <PackageCheck className="size-3" aria-hidden /> 산출물
          </Badge>
        ) : null}
      </div>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-6',
          isDelivery
            ? 'border border-success-soft bg-success-soft/40 text-text'
            : mine
              ? 'bg-accent-soft text-accent-fg'
              : 'border border-border bg-surface text-text'
        )}
      >
        {message.body}
        <AttachmentList requestId={message.requestId} attachments={message.attachments} />
      </div>
      <span className="px-1 text-[0.6875rem] text-text-subtle" title={message.createdAt}>
        {formatRelative(message.createdAt)}
      </span>
      {canFlag ? (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onFlag}>
          <Flag className="size-3.5" aria-hidden /> 이의제기
        </Button>
      ) : null}
    </div>
  )
}

function MessageComposer({ requestId, canDeliver }: { requestId: string; canDeliver: boolean }) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const post = usePostMessage(requestId)
  const upload = useUploadRequestAttachment(requestId)
  const confirm = useConfirm()
  const busy = post.isPending || upload.isPending

  const send = async (kind: 'message' | 'delivery') => {
    const trimmed = body.trim()
    if (!trimmed) return
    try {
      const attachmentIds: string[] = []
      for (const file of files) {
        const uploaded = await upload.mutateAsync(file)
        attachmentIds.push(uploaded.id)
      }
      post.mutate(
        { body: trimmed, kind, attachmentIds },
        {
          onSuccess: () => {
            setBody('')
            setFiles([])
            if (kind === 'delivery') toast.success('산출물을 제출했습니다')
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : '전송에 실패했습니다'),
        }
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '파일 업로드에 실패했습니다')
    }
  }

  const onDeliver = async () => {
    const ok = await confirm({
      title: '산출물로 제출할까요?',
      description: '제출하면 의뢰가 검수 대기 상태로 전환되고, 의뢰자가 완료 처리할 수 있습니다.',
      confirmText: '산출물 제출',
    })
    if (ok) void send('delivery')
  }

  const selectFiles = (selected: FileList | null) => {
    if (!selected) return
    setFiles((current) => [...current, ...Array.from(selected)].slice(0, 5))
  }

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index))
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <Field label="메시지" htmlFor="message-body">
        <Textarea
          id="message-body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="의뢰 진행 상황을 공유하세요…"
        />
      </Field>
      <div className="mt-3">
        <Field
          label="첨부 파일"
          htmlFor="message-files"
          hint="참고자료나 산출물을 최대 5개까지 첨부할 수 있습니다."
        >
          <Input
            id="message-files"
            type="file"
            multiple
            onChange={(e) => {
              selectFiles(e.target.files)
              e.currentTarget.value = ''
            }}
          />
        </Field>
        {files.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-2 text-xs text-text-muted"
              >
                <Paperclip className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-text-subtle">{formatAttachmentSize(file.size)}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => removeFile(index)}
                  aria-label={`${file.name} 첨부 제거`}
                >
                  <XCircle className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {canDeliver ? (
          <Button
            variant="outline"
            loading={busy}
            disabled={body.trim() === ''}
            onClick={() => void onDeliver()}
          >
            <PackageCheck className="size-4" aria-hidden /> 산출물 제출
          </Button>
        ) : null}
        <Button loading={busy} disabled={body.trim() === ''} onClick={() => void send('message')}>
          <Send className="size-4" aria-hidden /> 보내기
        </Button>
      </div>
    </div>
  )
}

function RequestRevisionDialog({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [note, setNote] = useState('')
  const revision = useRequestRevision(requestId)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    revision.mutate(
      { note: note.trim() },
      {
        onSuccess: () => {
          toast.success('재작업 요청을 보냈습니다')
          onClose()
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : '재작업 요청에 실패했습니다'),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" sheet>
        <DialogHeader>
          <DialogTitle>재작업 요청</DialogTitle>
          <DialogDescription>
            산출물이 검수 기준에 맞지 않으면 사유를 남기고 진행 중 상태로 되돌립니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="반려 사유" htmlFor="revision-note" required>
            <Textarea
              id="revision-note"
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="보강이 필요한 조항, 근거, 형식 등을 구체적으로 남겨 주세요."
              maxLength={2000}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" loading={revision.isPending} disabled={note.trim().length < 5}>
              재작업 요청
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FlagRequestDialog({
  requestId,
  target,
  onClose,
}: {
  requestId: string
  target: RequestMessageDto | null
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const flag = useFlagRequest(requestId)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    flag.mutate(
      { note: note.trim(), messageId: target?.id },
      {
        onSuccess: () => {
          toast.success('이의제기를 접수했습니다')
          onClose()
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : '이의제기 접수에 실패했습니다'),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" sheet>
        <DialogHeader>
          <DialogTitle>{target ? '메시지 이의제기' : '의뢰 이의제기'}</DialogTitle>
          <DialogDescription>
            접수하면 운영자 분쟁 큐에 등록되고 의뢰 참여자에게 알림이 전달됩니다.
          </DialogDescription>
        </DialogHeader>
        {target ? (
          <div className="rounded-md border border-border bg-surface-2/50 px-3.5 py-3">
            <div className="text-xs text-text-subtle">
              {target.authorName} · {ROLE_LABEL[target.authorRole]}
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
              {target.body}
            </p>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="이의제기 사유" htmlFor="flag-note" required>
            <Textarea
              id="flag-note"
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="합의 범위, 검수 기준, 소통 문제 등 운영자가 판단할 수 있는 내용을 남겨 주세요."
              maxLength={2000}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              type="submit"
              variant="accent"
              loading={flag.isPending}
              disabled={note.trim().length < 5}
            >
              이의제기 접수
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── 페이지 ──────────────────────────────────────────────────────────────────────

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const detail = useServiceRequest(id)
  const session = useSession()
  const confirm = useConfirm()

  const request = detail.data?.request
  useDocumentTitle(request ? request.title : '의뢰 상세')

  const [editing, setEditing] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [revising, setRevising] = useState(false)
  const [flagTarget, setFlagTarget] = useState<RequestMessageDto | null | undefined>(undefined)

  const navigate = useNavigate()
  const accept = useAcceptProposal(id ?? '')
  const withdraw = useWithdrawProposal(id ?? '')
  const action = useRequestAction(id ?? '')
  const importMut = useImportToPolicy(id ?? '')

  // 수정/제안 다이얼로그는 해당 액션이 불가능해지면(상태 변경) 자동으로 닫는다.
  useEffect(() => {
    if (request && request.status !== 'open') {
      setEditing(false)
      setProposing(false)
    }
  }, [request])

  if (detail.isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-2/3" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  if (detail.isError || !detail.data || !request) {
    return (
      <EmptyState
        icon={Inbox}
        title="의뢰를 찾을 수 없습니다"
        description="이미 종료되었거나 접근 권한이 없는 의뢰입니다."
        action={
          <Button asChild variant="secondary">
            <Link to="/app/requests">의뢰 목록으로</Link>
          </Button>
        }
      />
    )
  }

  const { proposals, messages } = detail.data
  const relation = request.viewerRelation
  const isRequester = relation === 'requester'
  const isProvider = relation === 'provider'
  const isAdmin = relation === 'admin'
  const canPropose = (relation === 'guest' || isProvider) && request.status === 'open'

  const currentUserId = session.data?.user.id
  const canFlag =
    (isRequester || isAdmin || (isProvider && request.assignedProviderUserId === currentUserId)) &&
    request.status !== 'cancelled'

  const showThread = isAdmin || ((isRequester || isProvider) && request.status !== 'open')
  const canSendMessage =
    (isRequester || isProvider) && !['open', 'completed', 'cancelled'].includes(request.status)
  const canDeliver = isProvider && request.status === 'in_progress'

  const hasDelivery = messages.some((m) => m.kind === 'delivery')
  const canImport =
    isRequester && hasDelivery && (request.status === 'delivered' || request.status === 'completed')

  const myProposal = proposals.find((p) => p.id === request.myProposalId)

  const onCancel = async () => {
    const ok = await confirm({
      title: '의뢰를 취소할까요?',
      description: '취소하면 모집이 종료되고 더 이상 제안을 받을 수 없습니다.',
      confirmText: '의뢰 취소',
      danger: true,
    })
    if (!ok) return
    action.mutate('cancel', {
      onSuccess: () => toast.success('의뢰를 취소했습니다'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '취소에 실패했습니다'),
    })
  }

  const onComplete = async () => {
    const ok = await confirm({
      title: '완료 처리할까요?',
      description: '산출물을 확인했다면 완료 처리합니다. 전문가의 완료 이력에 반영됩니다.',
      confirmText: '완료 처리',
    })
    if (!ok) return
    action.mutate('complete', {
      onSuccess: () => toast.success('의뢰를 완료 처리했습니다'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '완료 처리에 실패했습니다'),
    })
  }

  const onStart = () => {
    action.mutate('start', {
      onSuccess: () => toast.success('작업을 시작했습니다'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '시작에 실패했습니다'),
    })
  }

  const onImport = async () => {
    const ok = await confirm({
      title: '약관 버전으로 가져올까요?',
      description:
        '제출된 산출물을 새 정책의 초안 버전으로 만듭니다. 게시·해시 동결은 이후 정책 화면에서 직접 결정합니다.',
      confirmText: '초안으로 가져오기',
    })
    if (!ok) return
    importMut.mutate(
      {},
      {
        onSuccess: (result) => {
          toast.success(`약관 초안을 만들었습니다 — ${result.policyName} ${result.versionLabel}`)
          navigate(`/app/policies/${result.policySlug}`)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '가져오기에 실패했습니다'),
      }
    )
  }

  const onAccept = async (proposal: ProposalDto) => {
    const ok = await confirm({
      title: '이 제안을 수락할까요?',
      description: `${proposal.providerName} 님을 배정하고 나머지 제안은 자동으로 미선정 처리됩니다.`,
      confirmText: '제안 수락',
    })
    if (!ok) return
    accept.mutate(proposal.id, {
      onSuccess: () => toast.success('제안을 수락하고 전문가를 배정했습니다'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '수락에 실패했습니다'),
    })
  }

  const onWithdraw = async (proposal: ProposalDto) => {
    const ok = await confirm({
      title: '제안을 철회할까요?',
      description: '철회하면 의뢰자에게 더 이상 노출되지 않습니다.',
      confirmText: '제안 철회',
      danger: true,
    })
    if (!ok) return
    withdraw.mutate(proposal.id, {
      onSuccess: () => toast.success('제안을 철회했습니다'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '철회에 실패했습니다'),
    })
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {isRequester && request.status === 'open' ? (
        <>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> 의뢰 수정
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={action.isPending}
            onClick={() => void onCancel()}
          >
            <XCircle className="size-4" aria-hidden /> 취소
          </Button>
        </>
      ) : null}
      {isRequester && request.status === 'delivered' ? (
        <>
          <Button variant="secondary" size="sm" onClick={() => setRevising(true)}>
            <RefreshCcw className="size-4" aria-hidden /> 재작업 요청
          </Button>
          <Button
            variant="accent"
            size="sm"
            loading={action.isPending}
            onClick={() => void onComplete()}
          >
            <CheckCircle2 className="size-4" aria-hidden /> 완료 처리
          </Button>
        </>
      ) : null}
      {isProvider && request.status === 'matched' ? (
        <Button variant="accent" size="sm" loading={action.isPending} onClick={onStart}>
          <PlayCircle className="size-4" aria-hidden /> 작업 시작
        </Button>
      ) : null}
      {canImport ? (
        <Button
          variant="secondary"
          size="sm"
          loading={importMut.isPending}
          onClick={() => void onImport()}
        >
          <FileDown className="size-4" aria-hidden /> 약관 버전으로 가져오기
        </Button>
      ) : null}
      {isRequester && request.status === 'completed' && !request.hasReview ? (
        <Button variant="accent" size="sm" onClick={() => setReviewing(true)}>
          <Star className="size-4" aria-hidden /> 전문가 평가
        </Button>
      ) : null}
      {/* 비공개(미등록) 의뢰는 마켓에 노출되지 않으므로 링크로 특정 전문가에게 공유한다. */}
      {isRequester && request.visibility === 'private' && request.status === 'open' ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(globalThis.location.href)
            toast.success('의뢰 링크를 복사했습니다 — 전문가에게 공유하세요')
          }}
        >
          <Link2 className="size-4" aria-hidden /> 링크 복사
        </Button>
      ) : null}
      {canPropose && !request.myProposalId ? (
        <Button variant="accent" size="sm" onClick={() => setProposing(true)}>
          <Send className="size-4" aria-hidden /> 제안 보내기
        </Button>
      ) : null}
      {canFlag ? (
        <Button
          variant={request.flagged ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setFlagTarget(null)}
        >
          <Flag className="size-4" aria-hidden /> {request.flagged ? '분쟁 접수됨' : '이의제기'}
        </Button>
      ) : null}
    </div>
  )

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '의뢰 중계', to: '/app/requests' }, { label: request.title }]}
        title={request.title}
        actions={headerActions}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={request.status} />
        <Badge tone="neutral" size="sm">
          {SERVICE_REQUEST_TYPE_LABELS[request.serviceType]}
        </Badge>
        <PolicyTypeBadge type={request.policyType} />
        {request.visibility === 'private' ? (
          <Badge tone="outline" size="sm">
            {REQUEST_VISIBILITY_LABELS.private}
          </Badge>
        ) : null}
        {isAdmin ? (
          <Badge tone="warning" size="sm">
            <ShieldCheck className="size-3" aria-hidden /> 운영자 보기
          </Badge>
        ) : null}
        {request.flagged ? (
          <Badge tone="warning" size="sm">
            <Flag className="size-3" aria-hidden /> 분쟁 검토
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {/* 설명 */}
          <Card>
            <CardHeader>
              <CardTitle>의뢰 내용</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text">
                {request.description}
              </p>
            </CardContent>
          </Card>

          {/* 제안 목록(의뢰자·운영자: 전체 / 전문가: 본인 것만) */}
          {(isRequester || isAdmin) && request.status === 'open' ? (
            <Card>
              <CardHeader>
                <CardTitle>받은 제안</CardTitle>
                <CardDescription>{proposals.length}건의 제안</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {proposals.length === 0 ? (
                  <EmptyState
                    icon={Send}
                    title="아직 받은 제안이 없습니다"
                    description="전문가가 제안을 보내면 여기에 표시됩니다."
                  />
                ) : (
                  proposals.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      canAccept={isRequester && p.status === 'submitted'}
                      onAccept={() => void onAccept(p)}
                      accepting={accept.isPending}
                      canWithdraw={false}
                      onWithdraw={() => undefined}
                      withdrawing={false}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* 전문가 본인 제안 상태 */}
          {(isProvider || canPropose) && myProposal ? (
            <Card>
              <CardHeader>
                <CardTitle>내 제안</CardTitle>
              </CardHeader>
              <CardContent>
                <ProposalCard
                  proposal={myProposal}
                  canAccept={false}
                  onAccept={() => undefined}
                  accepting={false}
                  canWithdraw={myProposal.status === 'submitted' && request.status === 'open'}
                  onWithdraw={() => void onWithdraw(myProposal)}
                  withdrawing={withdraw.isPending}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* 스레드 */}
          {showThread ? (
            <Card>
              <CardHeader>
                <CardTitle>진행 스레드</CardTitle>
                <CardDescription>의뢰자와 배정 전문가의 대화</CardDescription>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-subtle">
                    아직 메시지가 없습니다.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        mine={m.authorUserId === currentUserId}
                        canFlag={canFlag && m.kind !== 'system'}
                        onFlag={() => setFlagTarget(m)}
                      />
                    ))}
                  </div>
                )}
                {canSendMessage ? (
                  <MessageComposer requestId={request.id} canDeliver={canDeliver} />
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* 분쟁 메모(참여자·운영자) */}
          {request.flagged || request.disputeNote ? (
            <Card>
              <CardHeader>
                <CardTitle>분쟁 검토</CardTitle>
                <CardDescription>운영자 중재 큐에 등록된 의뢰입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {request.disputeNote ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
                    {request.disputeNote}
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">
                    이의제기가 접수되어 운영자 검토를 기다리고 있습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* 운영 메모(운영자만) */}
          {isAdmin && request.adminNote ? (
            <Card>
              <CardHeader>
                <CardTitle>운영 메모</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">
                  {request.adminNote}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* 사이드 메타 */}
        <aside className="lg:order-last">
          <Card>
            <CardContent>
              <dl className="space-y-4">
                <MetaItem icon={Building2} label="의뢰 조직">
                  {request.requesterOrgName}
                  {request.requesterName ? (
                    <span className="block text-xs font-normal text-text-muted">
                      {request.requesterName}
                    </span>
                  ) : null}
                </MetaItem>
                <MetaItem icon={Wallet} label="예산">
                  {formatBudgetRange(request.budgetMin, request.budgetMax)}
                </MetaItem>
                <MetaItem icon={CalendarClock} label="희망 마감일">
                  {formatDate(request.deadline)}
                </MetaItem>
                <MetaItem icon={FileText} label="관할">
                  {request.jurisdiction}
                </MetaItem>
                {request.assignedProviderName ? (
                  <MetaItem icon={BadgeCheck} label="배정 전문가">
                    {request.assignedProviderName}
                  </MetaItem>
                ) : null}
                {request.escrowStatus !== 'none' ? (
                  <MetaItem icon={Wallet} label="에스크로(모의)">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {ESCROW_STATUS_LABELS[request.escrowStatus]}
                      {request.escrowAmount != null ? (
                        <span className="text-text-muted">· {formatKrw(request.escrowAmount)}</span>
                      ) : null}
                    </span>
                  </MetaItem>
                ) : null}
                <MetaItem icon={Send} label="제안">
                  {request.proposalCount}건
                </MetaItem>
                <MetaItem icon={CalendarClock} label="등록">
                  <span title={request.createdAt}>{formatRelative(request.createdAt)}</span>
                </MetaItem>
              </dl>
              {action.isPending || accept.isPending || withdraw.isPending ? (
                <div className="mt-4 flex items-center gap-2 text-xs text-text-subtle">
                  <Spinner /> 처리 중…
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      {editing ? <EditRequestDialog request={request} onClose={() => setEditing(false)} /> : null}
      {proposing ? (
        <SubmitProposalDialog requestId={request.id} onClose={() => setProposing(false)} />
      ) : null}
      {reviewing ? (
        <ReviewDialog
          requestId={request.id}
          providerName={request.assignedProviderName}
          onClose={() => setReviewing(false)}
        />
      ) : null}
      {revising ? (
        <RequestRevisionDialog requestId={request.id} onClose={() => setRevising(false)} />
      ) : null}
      {flagTarget !== undefined ? (
        <FlagRequestDialog
          requestId={request.id}
          target={flagTarget}
          onClose={() => setFlagTarget(undefined)}
        />
      ) : null}
    </>
  )
}

function ReviewDialog({
  requestId,
  providerName,
  onClose,
}: {
  requestId: string
  providerName: string | null
  onClose: () => void
}) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const submit = useSubmitReview(requestId)

  const onSubmit = () => {
    submit.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('전문가 평가를 등록했습니다')
          onClose()
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '평가 등록에 실패했습니다'),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" sheet>
        <DialogHeader>
          <DialogTitle>전문가 평가</DialogTitle>
          <DialogDescription>
            {providerName ? `${providerName} 님의 작업은 어떠셨나요?` : '작업은 어떠셨나요?'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n}점`}
              onClick={() => setRating(n)}
              className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
            >
              <Star
                className={cn(
                  'size-7 transition-colors',
                  n <= rating ? 'fill-warning text-warning' : 'text-text-subtle'
                )}
                aria-hidden
              />
            </button>
          ))}
          <span className="ml-1 text-sm font-medium text-text">{rating}.0</span>
        </div>

        <div className="mt-4">
          <Field label="후기 (선택)" htmlFor="review-comment">
            <Textarea
              id="review-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="협업 경험을 간단히 남겨 주세요. 다른 의뢰자에게 도움이 됩니다."
              maxLength={2000}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="button" loading={submit.isPending} onClick={onSubmit}>
            평가 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
