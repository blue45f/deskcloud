import { channelSchema } from '@realtimedesk/shared'
import { History, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/feature/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useHistory } from '@/services/tenants'
import { formatTime, prettyJson } from '@/utils/format'

export default function HistoryPage() {
  useDocumentTitle('메시지 히스토리')
  const [channelInput, setChannelInput] = useState('room:lobby')
  const [channel, setChannel] = useState('room:lobby')

  const history = useHistory(channel, { limit: 100 })

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = channelSchema.safeParse(channelInput.trim())
    if (!parsed.success) {
      toast.error('유효한 채널 이름이 아닙니다 (영숫자·:·_·-·.).')
      return
    }
    setChannel(parsed.data)
  }

  const items = history.data?.items ?? []

  return (
    <>
      <PageHeader
        title="메시지 히스토리"
        description="채널에 저장된 최근 메시지를 봅니다(오래된 → 최신). 히스토리는 publishable 키 + Origin 으로 조회합니다."
      />

      <Card className="mb-6">
        <CardContent>
          <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="채널" htmlFor="hist-channel" hint="조회할 채널 이름">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-subtle"
                  aria-hidden
                />
                <Input
                  id="hist-channel"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  className="pl-9 font-mono sm:w-72"
                  placeholder="room:42"
                />
              </div>
            </Field>
            <div className="flex items-center gap-2">
              <Button type="submit">
                <Search className="size-4" />
                조회
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void history.refetch()}
                loading={history.isFetching}
                aria-label="새로고침"
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          action={
            <Badge tone="neutral" size="sm">
              {items.length}건
            </Badge>
          }
        >
          <CardTitle>
            <code className="font-mono">{channel}</code>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : history.isError ? (
            <EmptyState
              icon={History}
              title="히스토리를 불러올 수 없습니다"
              description={
                (history.error as Error | undefined)?.message ??
                'publishable 키가 없거나 Origin 이 허용되지 않았을 수 있습니다.'
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={History}
              title="저장된 메시지가 없습니다"
              description="이 채널에 아직 발행된 메시지가 없거나, 서버 히스토리(REALTIME_HISTORY_LIMIT)가 비활성입니다."
            />
          ) : (
            <ul className="space-y-2">
              {items.map((m) => (
                <li key={m.id} className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="accent" size="sm">
                      {m.event}
                    </Badge>
                    <span className="font-mono text-xs text-text-subtle">
                      {formatTime(m.publishedAt)}
                    </span>
                  </div>
                  {m.data !== undefined && m.data !== null ? (
                    <pre className="mt-2 overflow-x-auto rounded bg-bg/60 p-2 font-mono text-[0.75rem] leading-relaxed text-text">
                      {prettyJson(m.data)}
                    </pre>
                  ) : (
                    <p className="mt-1.5 text-xs text-text-subtle">(데이터 없음 — 이벤트만)</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
