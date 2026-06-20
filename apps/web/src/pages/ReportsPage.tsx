import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Flag,
  ListChecks,
  RotateCw,
  ShieldAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { AdminReportQuery, ReportDto, ReportStatus } from '@moderationdesk/shared'

import { ReportDialog } from '@/components/feature/ReportDialog'
import { StatCard } from '@/components/feature/StatCard'
import { Badge, ReportStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Select } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useCredKey } from '@/hooks/useCredKey'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useReports } from '@/services/moderation'
import { formatDateTime, formatNumber } from '@/utils/format'

const PAGE_SIZE = 10

const STATUS_FILTERS: { value: '' | ReportStatus; label: string }[] = [
  { value: '', label: '전체 상태' },
  { value: 'open', label: '접수' },
  { value: 'reviewing', label: '검토중' },
  { value: 'resolved', label: '처리됨' },
  { value: 'dismissed', label: '기각' },
]

export default function ReportsPage() {
  useDocumentTitle('신고 큐')
  const credKey = useCredKey()

  const [statusFilter, setStatusFilter] = useState<'' | ReportStatus>('')
  const [subjectType, setSubjectType] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<ReportDto | null>(null)

  const query: AdminReportQuery = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(subjectType.trim() ? { subjectType: subjectType.trim() } : {}),
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [statusFilter, subjectType, page]
  )

  const reportsQ = useReports(credKey, query)
  // "접수(open)" 건수를 별도로 집계해 큐 헤드라인에 노출.
  const openQ = useReports(credKey, { status: 'open', offset: 0, limit: 1 })

  const items = reportsQ.data?.items ?? []
  const total = reportsQ.data?.totalCount ?? reportsQ.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const openCount = openQ.data?.totalCount ?? openQ.data?.total ?? 0

  const resetPage = () => setPage(0)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">신고 큐</h1>
          <p className="mt-1 text-sm text-text-muted">
            위젯이 보낸 콘텐츠 신고를 검토하고 상태를 전이합니다.
          </p>
        </div>
      </div>

      {/* 요약 */}
      <section aria-label="요약 지표" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={ShieldAlert}
          label="처리 대기 (open)"
          value={openQ.isLoading ? '—' : formatNumber(openCount)}
          hint="검토가 필요한 신고"
          tone={openCount > 0 ? 'danger' : 'success'}
        />
        <StatCard
          icon={ListChecks}
          label="현재 필터 결과"
          value={reportsQ.isLoading ? '—' : formatNumber(total)}
          hint={statusFilter || subjectType ? '필터 적용됨' : '전체 신고'}
        />
        <StatCard
          icon={Flag}
          label="이 페이지"
          value={formatNumber(items.length)}
          hint={`${page + 1} / ${pageCount} 페이지`}
          tone="info"
        />
      </section>

      {/* 필터 */}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="상태" htmlFor="filter-status">
            <Select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as '' | ReportStatus)
                resetPage()
              }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="대상 종류 (subjectType)"
            htmlFor="filter-subject"
            hint="예: comment · post · profile"
          >
            <Input
              id="filter-subject"
              value={subjectType}
              onChange={(e) => {
                setSubjectType(e.target.value)
                resetPage()
              }}
              placeholder="전체"
              className="font-mono"
            />
          </Field>
        </CardContent>
      </Card>

      {/* 신고 테이블 */}
      <section aria-label="신고 목록">
        <Card>
          {reportsQ.isLoading && !reportsQ.data ? (
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </CardContent>
          ) : reportsQ.isError ? (
            <CardContent>
              <EmptyState
                icon={ShieldAlert}
                title="신고를 불러오지 못했습니다"
                description={
                  reportsQ.error instanceof Error
                    ? reportsQ.error.message
                    : '잠시 후 다시 시도해 주세요.'
                }
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void reportsQ.refetch()}
                    loading={reportsQ.isFetching}
                  >
                    <RotateCw className="size-4" />
                    다시 시도
                  </Button>
                }
              />
            </CardContent>
          ) : items.length === 0 ? (
            <CardContent>
              <EmptyState
                icon={Inbox}
                title="표시할 신고가 없습니다"
                description="조건에 맞는 신고가 없습니다. 위젯의 신고 버튼이 접수를 보내면 여기에 표시됩니다."
              />
            </CardContent>
          ) : (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>시각</TH>
                    <TH>대상</TH>
                    <TH>사유</TH>
                    <TH>상태</TH>
                    <TH className="text-right">처리</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map((r) => (
                    <TR key={r.id} className="hover:bg-surface-2/60">
                      <TD className="whitespace-nowrap text-text-muted">
                        {formatDateTime(r.createdAt)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        <span className="font-mono text-xs text-text-muted">
                          {r.subjectType}/{r.subjectId}
                        </span>
                      </TD>
                      <TD className="max-w-sm">
                        <span className="line-clamp-1 text-text-muted">{r.reason}</span>
                      </TD>
                      <TD>
                        <ReportStatusBadge status={r.status} size="sm" />
                      </TD>
                      <TD className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>
                          처리
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-text-subtle">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} /{' '}
                  {formatNumber(total)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="font-mono text-xs text-text-muted">
                    {page + 1} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={page >= pageCount - 1}
                    aria-label="다음 페이지"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
        {reportsQ.isError ? null : (
          <p className="mt-2 text-xs text-text-subtle">
            <Badge tone="neutral" size="sm">
              팁
            </Badge>{' '}
            행의 &ldquo;처리&rdquo; 를 눌러 상태(접수→검토→처리/기각)와 운영 메모를 남길 수
            있습니다.
          </p>
        )}
      </section>

      <ReportDialog
        report={selected}
        credKey={credKey}
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null)
        }}
      />
    </div>
  )
}
