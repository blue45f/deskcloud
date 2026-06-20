import { NOTIFICATION_TYPE_LABELS, type NotificationDto } from '@termsdesk/shared'
import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Dropdown, DropdownContent, DropdownTrigger } from '@/components/ui/dropdown'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/services/notifications'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/format'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const unread = useUnreadCount()
  const list = useNotifications(open)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const count = unread.data?.count ?? 0
  const items = list.data?.items ?? []

  const onOpenNotification = (n: NotificationDto) => {
    if (!n.readAt) markRead.mutate(n.id)
    setOpen(false)
    if (n.requestId) navigate(`/app/requests/${n.requestId}`)
  }

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `알림 ${count}건 안 읽음` : '알림'}
          className="relative grid size-8 place-items-center rounded-md text-text-muted outline-none transition-colors hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
        >
          <Bell className="size-[1.05rem]" />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-4 text-white">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold text-text">알림</span>
          {count > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                markAll.mutate()
              }}
              className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
            >
              <CheckCheck className="size-3.5" aria-hidden /> 모두 읽음
            </button>
          ) : null}
        </div>

        <div className="max-h-[22rem] overflow-y-auto py-1">
          {list.isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-text-subtle">불러오는 중…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-text-subtle">새 알림이 없습니다.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onOpenNotification(n)}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2',
                  !n.readAt && 'bg-accent-soft/40'
                )}
              >
                <div className="flex items-center gap-1.5">
                  {!n.readAt ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-accent-strong" aria-hidden />
                  ) : null}
                  <span className="text-[0.8125rem] font-medium text-text">{n.title}</span>
                  <span className="ml-auto shrink-0 text-[0.6875rem] text-text-subtle">
                    {NOTIFICATION_TYPE_LABELS[n.type]}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-text-muted">{n.body}</p>
                <p className="text-[0.6875rem] text-text-subtle">{formatRelative(n.createdAt)}</p>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => {
              setOpen(false)
              navigate('/app/requests')
            }}
          >
            내 의뢰로 이동
          </Button>
        </div>
      </DropdownContent>
    </Dropdown>
  )
}
