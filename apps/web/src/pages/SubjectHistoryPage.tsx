import { Fingerprint } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/PageHeader'
import { DecisionPill } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, HashTag, Skeleton } from '@/components/ui/feedback'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSubjectHistory } from '@/services/consents'
import { formatDateTime } from '@/utils/format'

export default function SubjectHistoryPage() {
  const { subjectRef } = useParams<{ subjectRef: string }>()
  const decoded = subjectRef ? decodeURIComponent(subjectRef) : ''
  const history = useSubjectHistory(decoded)
  useDocumentTitle(`동의 이력 · ${decoded}`)

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: '동의 영수증', to: '/app/consents' }, { label: decoded }]}
        title={
          <span className="flex items-center gap-2">
            <Fingerprint className="size-5 text-text-subtle" />
            <span className="font-mono text-lg">{decoded}</span>
          </span>
        }
        description="이 대상의 전체 동의 이력입니다. 규제·소송 대응 시 그대로 제출 가능한 증거입니다."
      />

      {history.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (history.data?.length ?? 0) === 0 ? (
        <EmptyState title="이력이 없습니다" description="이 대상의 동의 기록이 없습니다." />
      ) : (
        <div className="space-y-3">
          {history.data?.map((r) => {
            const ev = r.evidence ?? {}
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">{r.policySlug}</span>
                      <span className="font-mono text-xs text-text-subtle">{r.versionLabel}</span>
                      <DecisionPill decision={r.decision} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-subtle">
                      <span>동의 시각 {formatDateTime(r.createdAt)}</span>
                      {ev.ip ? <span>IP {String(ev.ip)}</span> : null}
                      {ev.buttonLabel ? <span>버튼 “{String(ev.buttonLabel)}”</span> : null}
                    </div>
                    {ev.userAgent ? (
                      <p className="mt-1 truncate font-mono text-[0.6875rem] text-text-subtle">
                        {String(ev.userAgent)}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-xs text-text-subtle">동의한 버전 해시</p>
                    <div className="mt-0.5">
                      <HashTag hash={r.contentHash} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
