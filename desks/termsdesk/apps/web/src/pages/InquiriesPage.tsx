import {
  inquiryCategories,
  inquiryStatuses,
  type InquiryCategory,
  type InquiryDto,
  type InquiryStatus,
  type UpdateInquiryInput,
} from '@termsdesk/shared'
import { Inbox, Mail, X } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Select, Textarea } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useInquiries, useInquiry, useUpdateInquiry } from '@/services/inquiries'
import { cn } from '@/utils/cn'
import { formatDateTime, formatRelative } from '@/utils/format'

const CATEGORY_META: Record<InquiryCategory, { label: string; tone: BadgeProps['tone'] }> = {
  contact: { label: '문의', tone: 'accent' },
  partnership: { label: '제휴', tone: 'info' },
  bug: { label: '버그', tone: 'danger' },
  qa: { label: 'QA', tone: 'warning' },
  question: { label: '질문', tone: 'neutral' },
}

const STATUS_META: Record<InquiryStatus, { label: string; tone: BadgeProps['tone'] }> = {
  new: { label: '신규', tone: 'info' },
  in_progress: { label: '처리 중', tone: 'warning' },
  closed: { label: '종결', tone: 'neutral' },
}

function InquiryStatusPill({ status }: { status: InquiryStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} dot={status === 'new'}>
      {meta.label}
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

function DetailMeta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-subtle">{label}</dt>
      <dd className="mt-0.5 break-all text-sm text-text-muted">{children}</dd>
    </div>
  )
}

/** 상세 + 처리 폼 — 로드된 문의로만 마운트(부모가 key=id 로 리마운트). */
function InquiryDetail({ inquiry, onDone }: { inquiry: InquiryDto; onDone: () => void }) {
  const [status, setStatus] = useState<InquiryStatus>(inquiry.status)
  const [adminNote, setAdminNote] = useState(inquiry.adminNote ?? '')
  const update = useUpdateInquiry(inquiry.id)

  const onSave = () => {
    const input: UpdateInquiryInput = {
      status,
      adminNote: adminNote.trim() === '' ? null : adminNote.trim(),
    }
    update.mutate(input, {
      onSuccess: () => {
        toast.success('문의 처리 내용을 저장했습니다')
        onDone()
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : '저장에 실패했습니다'),
    })
  }

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CATEGORY_META[inquiry.category].tone} size="sm">
            {CATEGORY_META[inquiry.category].label}
          </Badge>
          <InquiryStatusPill status={inquiry.status} />
          <span className="text-xs text-text-subtle">{formatDateTime(inquiry.createdAt)}</span>
        </div>
        <DialogTitle>{inquiry.title}</DialogTitle>
        <DialogDescription>
          {inquiry.siteSlug}
          {inquiry.contactEmail ? (
            <>
              {' · '}
              <a
                href={`mailto:${inquiry.contactEmail}`}
                className="text-accent-strong hover:underline"
              >
                {inquiry.contactEmail}
              </a>
            </>
          ) : (
            ' · 회신 연락처 없음'
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-md border border-border bg-surface-2/40 px-3.5 py-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text">
          {inquiry.body}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailMeta label="접수 페이지">
          {inquiry.originUrl ? (
            /^https?:\/\//i.test(inquiry.originUrl) ? (
              <a
                href={inquiry.originUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-strong hover:underline"
              >
                {inquiry.originUrl}
              </a>
            ) : (
              // 과거에 저장된 비 http(s) 값은 링크 대신 평문으로만 표시 (stored XSS 방어)
              <span className="break-all">{inquiry.originUrl}</span>
            )
          ) : (
            '—'
          )}
        </DetailMeta>
        <DetailMeta label="IP">{inquiry.ip ?? '—'}</DetailMeta>
        <div className="sm:col-span-2">
          <DetailMeta label="User-Agent">{inquiry.userAgent ?? '—'}</DetailMeta>
        </div>
      </dl>

      <div className="mt-5 space-y-4 border-t border-border pt-4">
        <Field label="상태" htmlFor="inquiry-status">
          <Select
            id="inquiry-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as InquiryStatus)}
          >
            {inquiryStatuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="운영 메모"
          htmlFor="inquiry-admin-note"
          hint="내부 기록용 — 제출자에게 보이지 않습니다."
        >
          <Textarea
            id="inquiry-admin-note"
            rows={4}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="처리 내용, 담당자, 후속 작업 등"
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={onSave} loading={update.isPending}>
            저장
          </Button>
        </div>
      </div>
    </>
  )
}

function InquiryDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const inquiry = useInquiry(id)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        {inquiry.isLoading ? (
          <>
            <DialogHeader>
              <DialogTitle>문의 상세</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </>
        ) : inquiry.isError || !inquiry.data ? (
          <>
            <DialogHeader>
              <DialogTitle>문의 상세</DialogTitle>
            </DialogHeader>
            <EmptyState
              icon={Inbox}
              title="문의를 불러오지 못했습니다"
              description={inquiry.error instanceof Error ? inquiry.error.message : undefined}
            />
          </>
        ) : (
          <InquiryDetail key={inquiry.data.id} inquiry={inquiry.data} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function InquiriesPage() {
  useDocumentTitle('문의 보드')
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rawStatus = searchParams.get('status')
  const status: InquiryStatus | 'all' = inquiryStatuses.includes(rawStatus as InquiryStatus)
    ? (rawStatus as InquiryStatus)
    : 'all'
  const rawCategory = searchParams.get('category')
  const category: InquiryCategory | 'all' = inquiryCategories.includes(
    rawCategory as InquiryCategory
  )
    ? (rawCategory as InquiryCategory)
    : 'all'
  const site = searchParams.get('site') ?? ''

  const setParam = (key: 'status' | 'category' | 'site', value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value === 'all' || value === '') params.delete(key)
    else params.set(key, value)
    setSearchParams(params, { replace: true })
  }

  const inquiries = useInquiries({
    status: status === 'all' ? undefined : status,
    category: category === 'all' ? undefined : category,
    site: site || undefined,
  })

  return (
    <>
      <PageHeader
        title="문의 보드"
        description="형제 사이트와 조직 공개 페이지에서 접수된 비공개 문의를 한곳에서 처리합니다."
      />

      <div className="mb-4 space-y-2">
        <FilterPills
          label="상태 필터"
          value={status}
          options={inquiryStatuses}
          optionLabel={(o) => (o === 'all' ? '전체' : STATUS_META[o].label)}
          onChange={(next) => setParam('status', next)}
        />
        <FilterPills
          label="유형 필터"
          value={category}
          options={inquiryCategories}
          optionLabel={(o) => (o === 'all' ? '모든 유형' : CATEGORY_META[o].label)}
          onChange={(next) => setParam('category', next)}
        />
        {site ? (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            사이트 필터
            <Badge tone="outline" className="gap-1 pr-1">
              {site}
              <button
                type="button"
                onClick={() => setParam('site', '')}
                aria-label="사이트 필터 해제"
                className="rounded-full p-0.5 transition-colors hover:bg-surface-2 hover:text-text"
              >
                <X className="size-3" />
              </button>
            </Badge>
          </div>
        ) : null}
      </div>

      {inquiries.isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : inquiries.isError ? (
        <EmptyState
          icon={Inbox}
          title="문의를 불러오지 못했습니다"
          description={inquiries.error instanceof Error ? inquiries.error.message : undefined}
        />
      ) : (inquiries.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Inbox}
          title="접수된 문의가 없습니다"
          description="형제 사이트의 문의 폼이 이 보드로 모입니다."
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-text-subtle">총 {inquiries.data?.total ?? 0}건</p>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <THead>
                <TR className="bg-surface-2/60">
                  <TH>유형</TH>
                  <TH>제목</TH>
                  <TH className="hidden sm:table-cell">사이트</TH>
                  <TH className="hidden md:table-cell">연락처</TH>
                  <TH>상태</TH>
                  <TH>접수</TH>
                </TR>
              </THead>
              <TBody>
                {inquiries.data?.items.map((q) => (
                  <TR
                    key={q.id}
                    onClick={() => setSelectedId(q.id)}
                    className="cursor-pointer hover:bg-surface-2/50"
                  >
                    <TD>
                      <Badge tone={CATEGORY_META[q.category].tone} size="sm">
                        {CATEGORY_META[q.category].label}
                      </Badge>
                    </TD>
                    <TD className="max-w-[320px]">
                      <button
                        type="button"
                        onClick={() => setSelectedId(q.id)}
                        className="block max-w-full truncate text-left font-medium text-text outline-none hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong"
                      >
                        {q.title}
                      </button>
                    </TD>
                    <TD className="hidden text-text-muted sm:table-cell">{q.siteSlug}</TD>
                    <TD className="hidden md:table-cell">
                      {q.contactEmail ? (
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <Mail className="size-3.5" aria-hidden /> 있음
                        </span>
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
                    </TD>
                    <TD>
                      <InquiryStatusPill status={q.status} />
                    </TD>
                    <TD
                      className="whitespace-nowrap text-xs text-text-subtle"
                      title={formatDateTime(q.createdAt)}
                    >
                      {formatRelative(q.createdAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}

      {selectedId ? (
        <InquiryDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  )
}
