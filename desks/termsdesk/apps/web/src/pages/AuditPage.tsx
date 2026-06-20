import { History } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAudit } from '@/services/admin'
import { formatDateTime } from '@/utils/format'

const ACTION_TONE: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  'version.published': 'success',
  'policy.archived': 'warning',
  'apikey.revoked': 'warning',
  'consent.recorded': 'info',
}

export default function AuditPage() {
  useDocumentTitle('감사 로그')
  const audit = useAudit(200)

  return (
    <>
      <PageHeader
        title="감사 로그"
        description="모든 변경은 append-only로 기록됩니다. 누가 무엇을 언제 했는지 추적합니다."
      />

      {audit.isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (audit.data?.length ?? 0) === 0 ? (
        <EmptyState icon={History} title="기록이 없습니다" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <THead>
              <TR className="bg-surface-2/60">
                <TH>활동</TH>
                <TH>내용</TH>
                <TH className="hidden sm:table-cell">실행자</TH>
                <TH className="hidden lg:table-cell">IP</TH>
                <TH>시각</TH>
              </TR>
            </THead>
            <TBody>
              {audit.data?.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <Badge tone={ACTION_TONE[e.action] ?? 'neutral'} size="sm">
                      {e.action}
                    </Badge>
                  </TD>
                  <TD className="text-text">{e.summary ?? '—'}</TD>
                  <TD className="hidden text-text-muted sm:table-cell">
                    {e.actorName ?? '시스템'}
                  </TD>
                  <TD className="hidden font-mono text-xs text-text-subtle lg:table-cell">
                    {e.ip ?? '—'}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-text-subtle">
                    {formatDateTime(e.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </>
  )
}
