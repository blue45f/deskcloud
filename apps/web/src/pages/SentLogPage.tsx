import { type NotificationDto } from '@notifydesk/shared'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { useState } from 'react'

import { ChannelBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSentLog } from '@/services/notifications'
import { formatDateTime, formatNumber, formatRelative } from '@/utils/format'

const PAGE_SIZE = 20

export default function SentLogPage() {
  useDocumentTitle('발송 로그')
  const [page, setPage] = useState(0)
  const offset = page * PAGE_SIZE
  const sent = useSentLog(offset, PAGE_SIZE)
  const [detail, setDetail] = useState<NotificationDto | null>(null)

  const items = sent.data?.items ?? []
  const total = sent.data?.totalCount ?? sent.data?.total ?? 0
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">발송 로그</h1>
        <p className="mt-1 text-sm text-text-muted">
          이 테넌트의 in-app 알림(인박스 행) 최신순. 총 {formatNumber(total)}건.
        </p>
      </div>

      {sent.isLoading && items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : sent.isError && items.length === 0 ? (
        <ErrorState
          title="발송 로그를 불러오지 못했습니다"
          description="네트워크 또는 인증 문제일 수 있습니다. 다시 시도해 주세요."
          onRetry={() => void sent.refetch()}
          retrying={sent.isFetching}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="아직 발송된 알림이 없습니다"
          description="대시보드의 발송 컴포저나 SDK 로 알림을 보내면 여기에 쌓입니다."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>제목 / 본문</TH>
                <TH>recipient</TH>
                <TH>type</TH>
                <TH>채널</TH>
                <TH>상태</TH>
                <TH>시각</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((n) => (
                <TR
                  key={n.id}
                  className="cursor-pointer hover:bg-surface-2"
                  onClick={() => setDetail(n)}
                >
                  <TD className="max-w-[28ch]">
                    <p className="truncate font-medium text-text">{n.title || '(제목 없음)'}</p>
                    <p className="truncate text-xs text-text-subtle">{n.body}</p>
                  </TD>
                  <TD className="font-mono text-[0.8125rem] text-text-muted">{n.recipientId}</TD>
                  <TD className="font-mono text-[0.8125rem] text-text-muted">{n.type}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {n.channels.map((c) => (
                        <ChannelBadge key={c} channel={c} />
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <StatusBadge status={n.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-text-subtle">
                    {formatRelative(n.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-subtle">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {formatNumber(total)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" /> 이전
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= maxPage}
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            >
              다음 <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title || '(제목 없음)'}</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.type} · ${formatDateTime(detail.createdAt)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 text-sm">
              <p className="whitespace-pre-wrap text-text">{detail.body}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
                <dt className="text-text-subtle">recipient</dt>
                <dd className="font-mono text-text">{detail.recipientId}</dd>
                <dt className="text-text-subtle">채널</dt>
                <dd className="flex flex-wrap gap-1">
                  {detail.channels.map((c) => (
                    <ChannelBadge key={c} channel={c} />
                  ))}
                </dd>
                <dt className="text-text-subtle">상태</dt>
                <dd>
                  <StatusBadge status={detail.status} />
                </dd>
                <dt className="text-text-subtle">읽은 시각</dt>
                <dd className="text-text">{formatDateTime(detail.readAt) || '—'}</dd>
              </dl>
              {detail.data && Object.keys(detail.data).length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[0.8125rem] font-medium text-text">data</p>
                  <pre className="overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs text-text-muted">
                    {JSON.stringify(detail.data, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
