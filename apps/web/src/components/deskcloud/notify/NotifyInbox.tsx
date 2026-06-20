/**
 * NotifyDesk — 네이티브 알림 인박스(헤더 벨 + 드롭다운 패널).
 * ──────────────────────────────────────────────────────────────────────────
 * @heejun/deskcloud 의 타입드 브라우저 클라이언트(createNotifyClient)로 인박스를
 * 가져와 TermsDesk 자체 디자인 토큰·컴포넌트(Button·Badge·Spinner·EmptyState)로
 * 렌더합니다. 위젯 임베드/외부 CSS 가 아니라 앱 네이티브 UI 입니다.
 *
 * 활성 조건: VITE_NOTIFYDESK_URL 이 설정된 경우에만(services/deskcloud).
 * 패널을 열면 미읽음을 낙관적으로 읽음 처리하고 서버에 반영합니다.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { type NotifyNotification } from '@heejun/deskcloud'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Check, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState, Spinner } from '@/components/ui/feedback'
import { getNotifyClient, isNotifyEnabled } from '@/services/deskcloud'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/format'

const POLL_MS = 30_000
const LIMIT = 20

export interface NotifyInboxProps {
  /** 알림을 받을 사용자(테넌트 측 식별자). */
  recipientId: string
}

export function NotifyInbox({ recipientId }: NotifyInboxProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const qc = useQueryClient()

  const unreadKey = ['deskcloud', 'notify', 'unread', recipientId] as const
  const inboxKey = ['deskcloud', 'notify', 'inbox', recipientId] as const

  const unread = useQuery({
    queryKey: unreadKey,
    enabled: isNotifyEnabled,
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const client = getNotifyClient()
      if (!client) return 0
      const res = await client.getUnreadCount({ recipientId })
      return res.unreadCount
    },
  })

  const inbox = useQuery({
    queryKey: inboxKey,
    enabled: isNotifyEnabled && open,
    queryFn: () => {
      const client = getNotifyClient()
      if (!client) throw new Error('Notify 통합이 비활성화되어 있습니다.')
      return client.getInbox({ recipientId, limit: LIMIT })
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      const client = getNotifyClient()
      if (!client) return
      await client.markRead({ recipientId, all: true })
    },
    onSuccess: () => {
      qc.setQueryData(unreadKey, 0)
      void inbox.refetch()
    },
  })

  const closePanel = useCallback(() => {
    setOpen(false)
    bellRef.current?.focus()
  }, [])

  // 패널을 여는 행위 = 확인 → 미읽음 전체 낙관적 읽음 처리.
  const openPanel = useCallback(() => {
    setOpen(true)
    if ((unread.data ?? 0) > 0) markAllRead.mutate()
  }, [unread.data, markAllRead])

  // Esc 닫기 + 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closePanel()
      }
    }
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onPointer, true)
    }
  }, [open, closePanel])

  if (!isNotifyEnabled) return null

  const count = unread.data ?? 0
  const items = inbox.data?.items ?? []

  return (
    <div className="relative" ref={rootRef}>
      <Button
        ref={bellRef}
        variant="ghost"
        size="icon-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count > 0 ? `알림, 읽지 않음 ${count}건` : '알림'}
        onClick={() => (open ? closePanel() : openPanel())}
        className="relative"
      >
        <Bell className="size-[1.05rem]" />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 grid min-w-[1rem] place-items-center rounded-full border-2 border-bg bg-accent px-0.5 text-[0.5625rem] font-bold leading-none text-accent-fg"
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex max-h-[min(32rem,80vh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg data-[state=open]:animate-[fade-in_120ms_ease-out]"
          data-state="open"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold text-text">
              알림
            </h2>
            <span className="flex-1" />
            <button
              type="button"
              disabled={count === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-accent-strong outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent-strong disabled:pointer-events-none disabled:text-text-subtle"
            >
              <Check className="size-3.5" aria-hidden />
              모두 읽음
            </button>
          </div>

          <div className="overflow-y-auto">
            {inbox.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
                <Spinner />
                불러오는 중…
              </div>
            ) : inbox.isError ? (
              <EmptyState
                icon={TriangleAlert}
                title="알림을 불러오지 못했어요"
                description="네트워크 상태를 확인해 주세요."
                className="border-0 py-10"
                action={
                  <Button variant="outline" size="sm" onClick={() => void inbox.refetch()}>
                    다시 시도
                  </Button>
                }
              />
            ) : items.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title="새 알림이 없어요"
                description="알림이 도착하면 여기에 표시됩니다."
                className="border-0 py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <NotifyItem key={item.id} item={item} />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function NotifyItem({ item }: { item: NotifyNotification }) {
  const isUnread = item.status !== 'read'
  return (
    <li className={cn('px-4 py-3', isUnread && 'bg-accent-soft/40')}>
      <div className="flex gap-2.5">
        <span
          aria-hidden
          className={cn(
            'mt-1.5 size-2 flex-none rounded-full',
            isUnread ? 'bg-accent' : 'bg-transparent'
          )}
        />
        <div className="min-w-0 flex-1">
          {item.title ? (
            <p className="text-[0.8125rem] font-semibold text-text">{item.title}</p>
          ) : null}
          {item.body ? (
            <p className="mt-0.5 text-[0.8125rem] text-text-muted">{item.body}</p>
          ) : null}
          <p className="mt-1 text-[0.6875rem] text-text-subtle">
            <time dateTime={item.createdAt}>{formatRelative(item.createdAt)}</time>
            {isUnread ? <span className="sr-only"> · 읽지 않음</span> : null}
          </p>
        </div>
      </div>
    </li>
  )
}

export default NotifyInbox
