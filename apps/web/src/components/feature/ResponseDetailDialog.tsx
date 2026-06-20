import type { ResponseDto, SurveyQuestion } from '@surveydesk/shared'

import { formatAnswer } from '@/components/feature/AnswerCells'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/utils/format'

/** 응답 단건 상세 — 모든 답 + 응답자·메타. 행 클릭으로 열린다. */
export function ResponseDetailDialog({
  response,
  questions,
  open,
  onOpenChange,
}: {
  response: ResponseDto | null
  questions: SurveyQuestion[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>응답 상세</DialogTitle>
          <DialogDescription>
            {response ? `v${response.surveyVersion} · ${formatDateTime(response.createdAt)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {response ? (
          <div className="space-y-5">
            <dl className="space-y-3.5">
              {questions.map((q) => {
                const raw = response.answers[q.id]
                const empty = raw == null || raw === ''
                return (
                  <div key={q.id}>
                    <dt className="text-xs font-medium text-text-subtle">{q.label}</dt>
                    <dd className="mt-0.5 text-sm text-pretty text-text">
                      {empty ? (
                        <span className="text-text-subtle">— (미응답)</span>
                      ) : (
                        formatAnswer(q, raw)
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>

            <div className="border-t border-border pt-4">
              <h4 className="mb-2 text-xs font-semibold text-text-subtle">응답자 · 컨텍스트</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {response.respondentEmail ? (
                  <Badge tone="info">{response.respondentEmail}</Badge>
                ) : null}
                {response.respondentUserId ? (
                  <Badge tone="neutral">uid: {response.respondentUserId}</Badge>
                ) : null}
                {!response.respondentEmail && !response.respondentUserId ? (
                  <Badge tone="neutral">익명</Badge>
                ) : null}
              </div>
              {response.meta?.pageUrl ? (
                <p
                  className="mt-2 truncate font-mono text-xs text-text-subtle"
                  title={response.meta.pageUrl}
                >
                  {response.meta.pageUrl}
                </p>
              ) : null}
              {response.meta?.referrer ? (
                <p
                  className="mt-1 truncate font-mono text-xs text-text-subtle"
                  title={response.meta.referrer}
                >
                  ref: {response.meta.referrer}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
