import { channelSchema, eventSchema } from '@realtimedesk/shared'
import {
  Activity,
  BarChart3,
  Eye,
  Plus,
  Radio,
  RefreshCw,
  Send,
  UserPlus,
  Users,
  Users2,
  X,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuthStore } from '@/app/authStore'
import { MiniBar } from '@/components/feature/MiniBar'
import { PageHeader } from '@/components/feature/PageHeader'
import { StatCard } from '@/components/feature/StatCard'
import { Badge, PlanBadge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAdminStats } from '@/services/adminStats'
import { ApiError } from '@/services/api'
import { usePublish, useTenant, useUsage } from '@/services/tenants'
import { useLiveMonitor } from '@/services/useLiveMonitor'
import { cn } from '@/utils/cn'
import { formatNumber, formatTime, prettyJson, usagePct } from '@/utils/format'

const DEFAULT_CHANNELS = ['room:lobby']

export default function DashboardPage() {
  useDocumentTitle('대시보드')
  const pk = useAuthStore((s) => s.publishableKey)
  const tenant = useTenant()
  const usage = useUsage({ refetchInterval: 10_000 })
  const stats = useAdminStats({ refetchInterval: 30_000 })
  const monitor = useLiveMonitor(pk, DEFAULT_CHANNELS)

  const [channelDraft, setChannelDraft] = useState('')

  const addChannel = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = channelSchema.safeParse(channelDraft.trim())
    if (!parsed.success) {
      toast.error('유효한 채널 이름이 아닙니다 (영숫자·:·_·-·.).')
      return
    }
    monitor.addChannel(parsed.data)
    setChannelDraft('')
  }

  const usageData = usage.data
  const msgPct = usageData ? usagePct(usageData.messages, usageData.cap.messages) : 0

  return (
    <>
      <PageHeader
        title="대시보드"
        description="채널·연결·presence 를 실시간으로 보고, 테스트 이벤트를 발행하세요."
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={monitor.status} />
            {tenant.data ? <PlanBadge plan={tenant.data.plan} /> : null}
          </div>
        }
      />

      {tenant.isError ? (
        <Card className="mb-6 border-danger/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-danger">
              테넌트 정보를 불러오지 못했습니다. secret 키가 유효한지 확인하세요.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void tenant.refetch()}
              loading={tenant.isFetching}
            >
              <RefreshCw className="size-4" />
              다시 시도
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {monitor.error ? (
        <Card className="mb-6 border-warning/40">
          <CardContent className="text-sm text-warning">
            라이브 연결 오류 ({monitor.error.code}): {monitor.error.message} — Origin 허용목록에{' '}
            <code className="font-mono">{window.location.origin}</code> 이 포함됐는지 확인하세요.
          </CardContent>
        </Card>
      ) : null}

      {/* 운영 현황 — 플랫폼 전역 트래픽·가입(운영자 관점) */}
      <OperatorOverview stats={stats} />

      {/* 지표 카드 — 내 테넌트 실시간 현황 */}
      <h2 className="mb-3 text-sm font-semibold text-text-muted">내 테넌트 현황</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Radio}
          label="모니터 채널"
          value={monitor.channels.length}
          hint="구독 중인 채널 수"
          tone="accent"
        />
        <StatCard
          icon={Users}
          label="현재 접속(presence)"
          value={monitor.totalPresence}
          hint="모니터 채널 합산"
          tone="success"
        />
        <StatCard
          icon={Send}
          label="누적 메시지"
          value={usage.isLoading ? '…' : formatNumber(usageData?.messages ?? 0)}
          hint={usageData ? `상한 ${formatNumber(usageData.cap.messages)} · ${msgPct}%` : '사용량'}
        />
        <StatCard
          icon={Activity}
          label="누적 연결"
          value={usage.isLoading ? '…' : formatNumber(usageData?.connections ?? 0)}
          hint={usageData ? `상한 ${formatNumber(usageData.cap.connections)}` : '핸드셰이크 성공'}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* 채널 + presence + 빠른 발행 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>채널 & Presence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addChannel} className="flex items-center gap-2">
                <Input
                  value={channelDraft}
                  onChange={(e) => setChannelDraft(e.target.value)}
                  placeholder="채널 추가 (예: room:42)"
                  aria-label="모니터할 채널"
                  className="h-8 text-sm"
                />
                <Button type="submit" size="sm" variant="secondary" disabled={!channelDraft.trim()}>
                  <Plus className="size-4" />
                  추가
                </Button>
              </form>

              {monitor.channels.length === 0 ? (
                <p className="text-sm text-text-subtle">모니터할 채널을 추가하세요.</p>
              ) : (
                <ul className="space-y-2">
                  {monitor.channels.map((c) => (
                    <li
                      key={c.channel}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            c.presence.count > 0 ? 'bg-success' : 'bg-border-strong'
                          )}
                          aria-hidden
                        />
                        <code className="truncate font-mono text-[0.8125rem] text-text">
                          {c.channel}
                        </code>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={c.presence.count > 0 ? 'success' : 'neutral'} size="sm">
                          <Users className="size-3" aria-hidden />
                          {c.presence.count}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => monitor.removeChannel(c.channel)}
                          aria-label={`${c.channel} 모니터 제거`}
                          className="inline-grid size-5 place-items-center rounded text-text-subtle hover:bg-surface hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <QuickPublish defaultChannel={monitor.channels[0]?.channel ?? 'room:lobby'} />

          <Card>
            <CardHeader>
              <CardTitle>사용량</CardTitle>
            </CardHeader>
            <CardContent>
              {usage.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ) : usageData ? (
                <MiniBar
                  rows={[
                    { label: 'messages', count: usageData.messages, tone: 'accent' },
                    { label: 'connections', count: usageData.connections, tone: 'info' },
                  ]}
                  total={Math.max(usageData.cap.messages, usageData.messages, 1)}
                  emptyText="아직 사용량이 없습니다."
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-text-subtle">사용량을 불러올 수 없습니다.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void usage.refetch()}
                    loading={usage.isFetching}
                  >
                    <RefreshCw className="size-4" />
                    다시 시도
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 라이브 메시지 피드 */}
        <Card className="flex flex-col">
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/history">히스토리 →</Link>
              </Button>
            }
          >
            <CardTitle>라이브 메시지 피드</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {monitor.messages.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="아직 흐르는 메시지가 없습니다"
                description="아래 빠른 발행으로 테스트 이벤트를 쏘거나, 구독 중인 클라이언트가 메시지를 보내면 여기에 실시간으로 표시됩니다."
              />
            ) : (
              <ul className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                {monitor.messages.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-md border border-border bg-surface-2 p-3 [animation:slide-up_180ms_cubic-bezier(0.22,1,0.36,1)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge tone="accent" size="sm">
                          {m.event}
                        </Badge>
                        <code className="truncate font-mono text-xs text-text-muted">
                          {m.channel}
                        </code>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-text-subtle">
                        {formatTime(m.publishedAt)}
                      </span>
                    </div>
                    {m.data !== undefined && m.data !== null ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-bg/60 p-2 font-mono text-[0.75rem] leading-relaxed text-text">
                        {prettyJson(m.data)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/**
 * 운영 현황 — 플랫폼 전역 트래픽·가입(운영자 관점). 대시보드 최상단에 둔다.
 * 가입(오늘/총)은 실집계(real), 트래픽(방문자/총 조회)은 추적 누적(tracked-new) — 추적 시작
 * 이후만 카운트되며 카드 설명으로 출처를 명시한다(가짜 숫자를 실데이터로 표기하지 않음).
 */
function OperatorOverview({ stats }: { stats: ReturnType<typeof useAdminStats> }) {
  const data = stats.data
  const loading = stats.isLoading
  const fmt = (n: number | undefined): string => (loading ? '…' : formatNumber(n ?? 0))

  return (
    <section aria-labelledby="operator-overview-heading" className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="operator-overview-heading" className="text-sm font-semibold text-text-muted">
          운영 현황 (트래픽·가입)
        </h2>
        {stats.isError ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void stats.refetch()}
            loading={stats.isFetching}
          >
            <RefreshCw className="size-4" />
            다시 시도
          </Button>
        ) : null}
      </div>

      {stats.isError ? (
        <Card className="border-warning/40">
          <CardContent className="text-sm text-warning">
            운영 현황을 불러오지 못했습니다. 어드민 권한(secret 키)이 유효한지 확인하세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Eye}
            label="오늘 방문자"
            value={fmt(data?.traffic.todayVisitors)}
            hint="오늘(KST) 고유 방문 · 추적 시작 이후"
            tone="accent"
          />
          <StatCard
            icon={BarChart3}
            label="총 트래픽"
            value={fmt(data?.traffic.totalHits)}
            hint="누적 조회수 · 추적 시작 이후"
            tone="info"
          />
          <StatCard
            icon={UserPlus}
            label="오늘 신규 가입"
            value={fmt(data?.signups.today)}
            hint="오늘(KST) 신규 테넌트"
            tone="success"
          />
          <StatCard
            icon={Users2}
            label="총 가입"
            value={fmt(data?.signups.total)}
            hint="전체 테넌트 수"
          />
        </div>
      )}
    </section>
  )
}

/** 빠른 테스트 발행 — 대시보드 인라인 폼(전체 폼은 /app/publish). */
function QuickPublish({ defaultChannel }: { defaultChannel: string }) {
  const publish = usePublish()
  const [channel, setChannel] = useState(defaultChannel)
  const [event, setEvent] = useState('message')
  const [text, setText] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ch = channelSchema.safeParse(channel.trim())
    const ev = eventSchema.safeParse(event.trim())
    if (!ch.success) return toast.error('유효한 채널 이름이 아닙니다.')
    if (!ev.success) return toast.error('유효한 이벤트 이름이 아닙니다.')

    publish.mutate(
      { channel: ch.data, event: ev.data, data: text ? { text } : undefined },
      {
        onSuccess: (res) => {
          toast.success(`발행됨 — ${res.delivered}개 구독자에게 전달`)
          setText('')
        },
        onError: (err) => {
          const msg = err instanceof ApiError ? err.message : '발행에 실패했습니다.'
          toast.error(msg)
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>빠른 테스트 발행</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="채널" htmlFor="qp-channel">
              <Input
                id="qp-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="이벤트" htmlFor="qp-event">
              <Input
                id="qp-event"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>
          <Field label="data.text (선택)" htmlFor="qp-text">
            <Input
              id="qp-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="안녕하세요!"
            />
          </Field>
          <Button type="submit" className="w-full" loading={publish.isPending}>
            <Send className="size-4" />
            발행
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
