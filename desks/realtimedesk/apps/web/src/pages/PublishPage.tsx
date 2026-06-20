import { channelSchema, eventSchema, type PublishResultDto } from '@realtimedesk/shared'
import { Check, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/feature/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ApiError } from '@/services/api'
import { usePublish } from '@/services/tenants'
import { formatTime, prettyJson } from '@/utils/format'

const SAMPLES: Array<{ label: string; event: string; data: string }> = [
  {
    label: '채팅 메시지',
    event: 'message',
    data: '{\n  "user": "kim",\n  "text": "안녕하세요!"\n}',
  },
  { label: '타이핑 시작', event: 'typing', data: '{\n  "user": "kim"\n}' },
  { label: '커서 이동', event: 'cursor', data: '{\n  "user": "kim",\n  "x": 120,\n  "y": 64\n}' },
  { label: '알림', event: 'notification', data: '{\n  "title": "새 댓글",\n  "level": "info"\n}' },
]

export default function PublishPage() {
  useDocumentTitle('테스트 퍼블리셔')
  const publish = usePublish()
  const [channel, setChannel] = useState('room:lobby')
  const [event, setEvent] = useState('message')
  const [dataRaw, setDataRaw] = useState('{\n  "text": "안녕하세요!"\n}')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<PublishResultDto | null>(null)

  const applySample = (s: (typeof SAMPLES)[number]) => {
    setEvent(s.event)
    setDataRaw(s.data)
    setJsonError(null)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ch = channelSchema.safeParse(channel.trim())
    if (!ch.success) return toast.error('유효한 채널 이름이 아닙니다 (영숫자·:·_·-·.).')
    const ev = eventSchema.safeParse(event.trim())
    if (!ev.success) return toast.error('유효한 이벤트 이름이 아닙니다.')

    let data: unknown
    const trimmed = dataRaw.trim()
    if (trimmed) {
      try {
        data = JSON.parse(trimmed)
        setJsonError(null)
      } catch {
        setJsonError('유효한 JSON 이 아닙니다.')
        return
      }
    }

    publish.mutate(
      { channel: ch.data, event: ev.data, data },
      {
        onSuccess: (res) => {
          setLastResult(res)
          toast.success(`발행됨 — ${res.delivered}개 구독자에게 전달`)
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : '발행에 실패했습니다.'
          toast.error(msg)
        },
      }
    )
  }

  return (
    <>
      <PageHeader
        title="테스트 퍼블리셔"
        description="secret 키로 채널에 이벤트를 발행합니다. 구독 중인 모든 클라이언트에 즉시 전달되고, 히스토리가 켜져 있으면 저장됩니다."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>이벤트 발행</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="채널" htmlFor="pub-channel" required hint="테넌트 범위로 격리됩니다.">
                  <Input
                    id="pub-channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="font-mono"
                    placeholder="room:42"
                  />
                </Field>
                <Field label="이벤트" htmlFor="pub-event" required>
                  <Input
                    id="pub-event"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className="font-mono"
                    placeholder="message"
                  />
                </Field>
              </div>

              <Field
                label="data (JSON)"
                htmlFor="pub-data"
                error={jsonError ?? undefined}
                hint="임의 JSON 페이로드. 비우면 이벤트만 알립니다."
              >
                <Textarea
                  id="pub-data"
                  value={dataRaw}
                  onChange={(e) => {
                    setDataRaw(e.target.value)
                    if (jsonError) setJsonError(null)
                  }}
                  className="min-h-40 font-mono text-[0.8125rem]"
                  spellCheck={false}
                  aria-invalid={jsonError ? true : undefined}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-subtle">
                  <Sparkles className="size-3.5" aria-hidden />
                  예시
                </span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => applySample(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <Button type="submit" loading={publish.isPending}>
                <Send className="size-4" />
                발행
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>마지막 발행 결과</CardTitle>
          </CardHeader>
          <CardContent>
            {lastResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success-soft px-3.5 py-2.5 text-success">
                  <Check className="size-4 shrink-0" aria-hidden />
                  <span className="text-sm font-medium">
                    {lastResult.delivered}개 구독자에게 전달됨
                  </span>
                </div>
                {lastResult.message ? (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <Badge tone="accent" size="sm">
                        {lastResult.message.event}
                      </Badge>
                      <span className="font-mono text-xs text-text-subtle">
                        {formatTime(lastResult.message.publishedAt)}
                      </span>
                    </div>
                    <pre className="overflow-x-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[0.75rem] leading-relaxed text-text">
                      {prettyJson(lastResult.message)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-text-subtle">
                    히스토리가 비활성이라 메시지는 저장되지 않았습니다(전달만).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-subtle">
                왼쪽에서 이벤트를 발행하면 전달 수와 저장된 메시지가 여기에 표시됩니다.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
