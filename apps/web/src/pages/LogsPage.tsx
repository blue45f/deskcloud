import { ChevronLeft, ChevronRight, FileSearch, RotateCw, ScrollText } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { AdminLogQuery, Verdict } from '@moderationdesk/shared'

import { Badge, VerdictBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Select } from '@/components/ui/field'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { useCredKey } from '@/hooks/useCredKey'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useLogs } from '@/services/moderation'
import { formatDateTime, formatNumber } from '@/utils/format'

const PAGE_SIZE = 15

const VERDICT_FILTERS: { value: '' | Verdict; label: string }[] = [
  { value: '', label: '전체 판정' },
  { value: 'allow', label: '허용 (allow)' },
  { value: 'flag', label: '주의 (flag)' },
  { value: 'block', label: '차단 (block)' },
]

export default function LogsPage() {
  useDocumentTitle('검사 로그')
  const credKey = useCredKey()

  const [verdict, setVerdict] = useState<'' | Verdict>('')
  const [page, setPage] = useState(0)

  const query: AdminLogQuery = useMemo(
    () => ({
      ...(verdict ? { verdict } : {}),
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [verdict, page]
  )

  const logsQ = useLogs(credKey, query)
  const items = logsQ.data?.items ?? []
  const total = logsQ.data?.totalCount ?? logsQ.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text">검사 로그</h1>
        <p className="mt-1 max-w-2xl text-sm text-pretty text-text-muted">
          모든 모더레이션 검사가 판정·매칭 규칙·AI 점수·출처와 함께 기록됩니다.
        </p>
      </div>

      <Card>
        <CardContent>
          <Field label="판정 필터" htmlFor="log-verdict" className="max-w-xs">
            <Select
              id="log-verdict"
              value={verdict}
              onChange={(e) => {
                setVerdict(e.target.value as '' | Verdict)
                setPage(0)
              }}
            >
              {VERDICT_FILTERS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        {logsQ.isLoading && !logsQ.data ? (
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        ) : logsQ.isError ? (
          <CardContent>
            <EmptyState
              icon={FileSearch}
              title="로그를 불러오지 못했습니다"
              description={
                logsQ.error instanceof Error ? logsQ.error.message : '잠시 후 다시 시도해 주세요.'
              }
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void logsQ.refetch()}
                  loading={logsQ.isFetching}
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
              icon={ScrollText}
              title="검사 로그가 없습니다"
              description="검사 테스트나 위젯 사전검사·서버 게이트가 텍스트를 검사하면 여기에 쌓입니다."
            />
          </CardContent>
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>시각</TH>
                  <TH>텍스트</TH>
                  <TH>판정</TH>
                  <TH>매칭 규칙</TH>
                  <TH>AI</TH>
                  <TH>출처</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((l) => (
                  <TR key={l.id} className="hover:bg-surface-2/60">
                    <TD className="whitespace-nowrap text-text-muted">
                      {formatDateTime(l.createdAt)}
                    </TD>
                    <TD className="max-w-xs">
                      <span className="line-clamp-1 text-text">{l.text}</span>
                    </TD>
                    <TD>
                      <VerdictBadge verdict={l.verdict} size="sm" />
                    </TD>
                    <TD className="max-w-[14rem]">
                      {l.matchedRules.length === 0 ? (
                        <span className="text-text-subtle">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {l.matchedRules.slice(0, 3).map((m, i) => (
                            <Tooltip key={`${m.id}-${i}`} content={`${m.kind} · ${m.action}`}>
                              <span className="inline-block max-w-[8rem] truncate rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-text-muted">
                                {m.pattern}
                              </span>
                            </Tooltip>
                          ))}
                          {l.matchedRules.length > 3 ? (
                            <span className="text-[0.6875rem] text-text-subtle">
                              +{l.matchedRules.length - 3}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {l.aiScore == null ? (
                        <span className="text-text-subtle">—</span>
                      ) : (
                        <span className="font-mono text-xs tabular-nums text-text-muted">
                          {l.aiScore.toFixed(2)}
                        </span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {l.source ? (
                        <Badge tone="neutral" size="sm">
                          {l.source}
                        </Badge>
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
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
    </div>
  )
}
