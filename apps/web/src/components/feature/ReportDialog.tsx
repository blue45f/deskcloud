import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { ReportDto, ReportStatus, UpdateReportInput } from '@moderationdesk/shared'

import { ReportStatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, Select, Textarea } from '@/components/ui/field'
import { useUpdateReport } from '@/services/moderation'
import { formatDateTime } from '@/utils/format'

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: '접수 (open)' },
  { value: 'reviewing', label: '검토중 (reviewing)' },
  { value: 'resolved', label: '처리됨 (resolved)' },
  { value: 'dismissed', label: '기각 (dismissed)' },
]

/** 신고 상세 + 상태 전이/메모 편집 다이얼로그. */
export function ReportDialog({
  report,
  credKey,
  open,
  onOpenChange,
}: {
  report: ReportDto | null
  credKey: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const update = useUpdateReport(credKey)
  const [status, setStatus] = useState<ReportStatus>('open')
  const [notes, setNotes] = useState('')

  // report 가 바뀌면 폼 초기화. 컨트롤드 다이얼로그는 상시 마운트 상태라 서버 데이터를
  // 폼 상태로 동기화하는 이 effect 가 올바른 패턴이다(React Compiler 휴리스틱만 의도적 완화).
  useEffect(() => {
    if (report) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 데이터→폼 동기화(상시 마운트 다이얼로그)
      setStatus(report.status)
      setNotes(report.notes ?? '')
    }
  }, [report])

  if (!report) return null

  const save = () => {
    const input: UpdateReportInput = {}
    if (status !== report.status) input.status = status
    const trimmed = notes.trim()
    if (trimmed !== (report.notes ?? '')) input.notes = trimmed
    if (Object.keys(input).length === 0) {
      toast.info('변경 사항이 없습니다.')
      return
    }
    update.mutate(
      { id: report.id, input },
      {
        onSuccess: () => {
          toast.success('신고가 갱신되었습니다.')
          onOpenChange(false)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : '갱신에 실패했습니다.'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet>
        <DialogHeader>
          <DialogTitle>신고 상세</DialogTitle>
          <DialogDescription>
            대상{' '}
            <span className="font-mono text-text">
              {report.subjectType}/{report.subjectId}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ReportStatusBadge status={report.status} />
            <span className="text-xs text-text-subtle">
              접수 {formatDateTime(report.createdAt)}
            </span>
            {report.reporterId ? (
              <span className="text-xs text-text-subtle">
                · 신고자 <span className="font-mono">{report.reporterId}</span>
              </span>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-surface-2 p-3">
            <p className="mb-1 text-xs font-medium text-text-subtle">신고 사유</p>
            <p className="text-sm whitespace-pre-wrap text-pretty text-text">{report.reason}</p>
          </div>

          <Field label="상태 전이" htmlFor="report-status">
            <Select
              id="report-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ReportStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="운영 메모" htmlFor="report-notes" hint="처리 경과·근거를 남겨 두세요.">
            <Textarea
              id="report-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 게시물 비공개 처리 완료"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button onClick={save} loading={update.isPending}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
