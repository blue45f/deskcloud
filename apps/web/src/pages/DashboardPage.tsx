import {
  Activity,
  Eye,
  Gauge,
  MessageSquare,
  MessagesSquare,
  RefreshCw,
  Send,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { ConversationDto, MessageDto } from '@chatdesk/shared'

import { MessageThread } from '@/components/feature/MessageThread'
import { StatCard } from '@/components/feature/StatCard'
import { ConversationKindBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui/feedback'
import { Textarea } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  useAnalytics,
  useConversations,
  useDeleteMessage,
  useMessages,
  useRestoreMessage,
  useSystemSend,
  useTenant,
  useUsage,
} from '@/services/chat'
import { cn } from '@/utils/cn'
import { formatNumber, formatPercent, formatRelative } from '@/utils/format'

/** 대화 한 줄의 표시 제목 — 그룹은 title, DM 은 멤버쌍. */
function conversationTitle(c: ConversationDto): string {
  if (c.title) return c.title
  if (c.kind === 'dm') return c.memberIds.join(' ↔ ') || '1:1 DM'
  return `그룹 · ${c.memberIds.length}명`
}

/** 좌측 대화 목록(선택 가능). */
function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  retrying,
}: {
  conversations: ConversationDto[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  error: boolean
  onRetry: () => void
  retrying: boolean
}) {
  if (loading && conversations.length === 0) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  // 에러를 빈 목록으로 가리지 않는다 — 명시적 에러 + 재시도.
  if (error && conversations.length === 0) {
    return (
      <ErrorState
        title="대화를 불러오지 못했습니다"
        description="네트워크나 인증(secret 키) 문제일 수 있습니다. 다시 시도해 주세요."
        onRetry={onRetry}
        retrying={retrying}
        className="m-3 border-0 py-10"
      />
    )
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="아직 대화가 없습니다"
        description="브라우저가 pk 로 메시지를 보내거나, 서버가 sk 로 대화를 생성하면 여기에 나타납니다."
        className="m-3 border-0 py-10"
      />
    )
  }

  return (
    <ul className="divide-y divide-border">
      {conversations.map((c) => {
        const active = c.id === selectedId
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors',
                active ? 'bg-accent-soft' : 'hover:bg-surface-2'
              )}
            >
              <div className="flex items-center gap-2">
                <ConversationKindBadge kind={c.kind} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm font-medium',
                    active ? 'text-accent-fg' : 'text-text'
                  )}
                >
                  {conversationTitle(c)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[0.6875rem] text-text-subtle">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" aria-hidden />
                  {c.memberIds.length}명
                </span>
                <span>{formatRelative(c.createdAt)}</span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** 우측 메시지 뷰어 + 시스템 발송 작성기. */
function ConversationDetail({ conversationId }: { conversationId: string }) {
  const messages = useMessages(conversationId)
  const systemSend = useSystemSend()
  const deleteMessage = useDeleteMessage()
  const restoreMessage = useRestoreMessage()
  const composerId = useId()
  const [draft, setDraft] = useState('')

  const items = messages.data?.items ?? []

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body) {
      toast.error('보낼 내용을 입력해 주세요.')
      return
    }
    systemSend.mutate(
      { conversationId, input: { body } },
      {
        onSuccess: () => {
          setDraft('')
          toast.success('시스템 메시지를 발송했습니다.')
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : '발송에 실패했습니다.'),
      }
    )
  }

  const moderate = (m: MessageDto) => {
    deleteMessage.mutate(
      { messageId: m.id, conversationId },
      {
        onSuccess: () => toast.success('메시지를 삭제(모더레이션)했습니다.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.'),
      }
    )
  }

  const restore = (m: MessageDto) => {
    restoreMessage.mutate(
      { messageId: m.id, conversationId },
      {
        onSuccess: () => toast.success('메시지를 복원했습니다.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : '복원에 실패했습니다.'),
      }
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <MessageSquare className="size-4 text-text-subtle" aria-hidden />
          메시지
          <span className="font-mono text-xs text-text-subtle">{items.length}</span>
        </div>
        {messages.isFetching ? <Spinner /> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {messages.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-3/4" />
            ))}
          </div>
        ) : messages.isError && items.length === 0 ? (
          <ErrorState
            title="메시지를 불러오지 못했습니다"
            description="이 대화의 메시지를 가져오는 중 문제가 발생했습니다."
            onRetry={() => void messages.refetch()}
            retrying={messages.isFetching}
            className="border-0"
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="이 대화에 메시지가 없습니다"
            description="아래에서 시스템(공지) 메시지를 보내 대화를 시작할 수 있습니다."
            className="border-0"
          />
        ) : (
          <MessageThread
            messages={items}
            onModerate={moderate}
            onRestore={restore}
            moderatingId={deleteMessage.isPending ? deleteMessage.variables?.messageId : null}
            restoringId={restoreMessage.isPending ? restoreMessage.variables?.messageId : null}
          />
        )}
      </div>

      <form onSubmit={send} className="border-t border-border p-4">
        <label htmlFor={composerId} className="mb-1.5 block text-[0.8125rem] font-medium text-text">
          시스템 메시지 발송
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id={composerId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                send(e)
              }
            }}
            placeholder="발신자 없는 공지/자동화 메시지 (⌘/Ctrl + Enter 로 발송)"
            className="min-h-11"
          />
          <Button type="submit" loading={systemSend.isPending} className="shrink-0">
            <Send className="size-4" />
            발송
          </Button>
        </div>
      </form>
    </div>
  )
}

/**
 * 트래픽 / 분석 패널 — 오늘 방문자·총 트래픽(추적값) + 오늘/총 신규 가입(실측)을 4-up 카드로.
 *
 * 정직성: 트래픽은 위젯/SDK 가 호스트의 pk 로 보내는 방문 ping 으로 신규 추적한다. 아직
 * 임베드하지 않았으면 0 이 정상이며 hint 로 그 맥락을 알린다(가짜 데모 수치 금지). 가입은
 * 이 테넌트에서 처음 등장한 멤버를 DB 에서 실측한다(추가 추적 불필요).
 */
function AnalyticsPanel() {
  const analytics = useAnalytics()
  const a = analytics.data

  const cards = [
    {
      icon: Eye,
      label: '오늘 방문자 수',
      value: a ? formatNumber(a.todayVisitors) : '—',
      srValue: a ? `오늘 방문자 ${formatNumber(a.todayVisitors)}명` : undefined,
      hint: '위젯 임베드 후 집계 · 고유 방문자',
      tone: 'accent' as const,
    },
    {
      icon: TrendingUp,
      label: '총 트래픽',
      value: a ? formatNumber(a.totalTraffic) : '—',
      srValue: a ? `총 트래픽 ${formatNumber(a.totalTraffic)}회` : undefined,
      hint: '위젯 임베드 후 집계 · 누적 조회수',
      tone: 'info' as const,
    },
    {
      icon: UserPlus,
      label: '오늘 신규 가입자 수',
      value: a ? formatNumber(a.todaySignups) : '—',
      srValue: a ? `오늘 신규 가입자 ${formatNumber(a.todaySignups)}명` : undefined,
      hint: '실측 · 오늘 처음 등장한 멤버',
      tone: 'success' as const,
    },
    {
      icon: Users,
      label: '총 가입 수',
      value: a ? formatNumber(a.totalSignups) : '—',
      srValue: a ? `총 가입 ${formatNumber(a.totalSignups)}명` : undefined,
      hint: '실측 · 누적 고유 멤버',
      tone: 'neutral' as const,
    },
  ]

  return (
    <section aria-labelledby="analytics-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="analytics-heading" className="text-sm font-semibold text-text">
          트래픽 · 가입 현황
        </h2>
        {analytics.isFetching ? <Spinner /> : null}
      </div>

      {analytics.isError && !a ? (
        <ErrorState
          title="분석 지표를 불러오지 못했습니다"
          description="네트워크나 인증(secret 키) 문제일 수 있습니다. 다시 시도해 주세요."
          onRetry={() => void analytics.refetch()}
          retrying={analytics.isFetching}
          className="py-8"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {analytics.isLoading && !a
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[6.75rem]" />)
            : cards.map((c) => (
                <StatCard
                  key={c.label}
                  icon={c.icon}
                  label={c.label}
                  value={c.value}
                  srValue={c.srValue}
                  hint={c.hint}
                  tone={c.tone}
                />
              ))}
        </div>
      )}
    </section>
  )
}

export default function DashboardPage() {
  useDocumentTitle('대화 모니터')

  const tenant = useTenant()
  const usage = useUsage()
  const conversations = useConversations()
  const [pickedId, setPickedId] = useState<string | null>(null)

  const list = useMemo(() => conversations.data ?? [], [conversations.data])

  // 명시 선택이 없으면 최신 대화를 자동 선택(렌더 중 파생 — effect 불필요).
  // 선택했던 대화가 목록에서 사라지면 다시 최신으로 폴백.
  const selectedId =
    pickedId && list.some((c) => c.id === pickedId) ? pickedId : (list[0]?.id ?? null)

  const messageCount = usage.data?.messages ?? tenant.data?.usage.messages ?? 0
  const cap = usage.data?.cap.messages ?? tenant.data?.usage.cap.messages ?? 0
  const ratio = cap > 0 ? messageCount / cap : 0
  const dmCount = list.filter((c) => c.kind === 'dm').length
  const groupCount = list.filter((c) => c.kind === 'group').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">대화 모니터</h1>
          <p className="mt-1 text-pretty text-text-muted">
            테넌트의 모든 대화를 실시간으로 모니터하고, 시스템 메시지를 발송하거나 모더레이션합니다.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void conversations.refetch()}
          loading={conversations.isFetching}
        >
          <RefreshCw className="size-4" />
          새로고침
        </Button>
      </div>

      {/* 트래픽 · 가입 분석 */}
      <AnalyticsPanel />

      {/* 라이브 대화 통계 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={MessagesSquare}
          label="대화 수"
          value={formatNumber(list.length)}
          hint={`DM ${dmCount} · 그룹 ${groupCount}`}
          tone="accent"
        />
        <StatCard
          icon={Activity}
          label="누적 메시지"
          value={formatNumber(messageCount)}
          hint="10초마다 갱신"
          tone="info"
        />
        <StatCard
          icon={Gauge}
          label="요금제 사용률"
          value={formatPercent(ratio)}
          hint={`상한 ${formatNumber(cap)}`}
          tone={ratio >= 0.9 ? 'danger' : ratio >= 0.7 ? 'warning' : 'success'}
        />
        <StatCard
          icon={Users}
          label="요금제"
          value={tenant.data ? tenant.data.plan.toUpperCase() : '—'}
          hint={tenant.data?.name ?? ''}
        />
      </div>

      {/* 대화 목록 + 상세 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>대화</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[minmax(0,20rem)_1fr] lg:divide-x lg:divide-border">
            <div className="max-h-[34rem] overflow-y-auto border-b border-border lg:border-b-0">
              <ConversationList
                conversations={list}
                selectedId={selectedId}
                onSelect={setPickedId}
                loading={conversations.isLoading}
                error={conversations.isError}
                onRetry={() => void conversations.refetch()}
                retrying={conversations.isFetching}
              />
            </div>
            <div className="h-[34rem]">
              {selectedId ? (
                <ConversationDetail conversationId={selectedId} />
              ) : (
                <div className="grid h-full place-items-center p-6">
                  <EmptyState
                    icon={MessageSquare}
                    title="대화를 선택하세요"
                    description="왼쪽 목록에서 대화를 고르면 메시지를 보고, 시스템 메시지를 보내거나 모더레이션할 수 있습니다."
                    className="border-0"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
