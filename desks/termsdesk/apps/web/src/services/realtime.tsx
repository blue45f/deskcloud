import { useQueryClient } from '@tanstack/react-query'
import {
  REALTIME_EVENTS,
  type NotificationDto,
  type NotificationListDto,
  type RealtimeRequestMessageCreatedDto,
  type RealtimeTokenDto,
  type RequestDetailDto,
  type UnreadCountDto,
} from '@termsdesk/shared'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'

import { api } from './api'
import { brokerageKeys } from './brokerage'
import { notificationKeys } from './notifications'
import { RealtimeSocketContext } from './realtime-context'

import { appPath } from '@/config/urls'

function appendNotification(
  current: NotificationListDto | undefined,
  notification: NotificationDto
): NotificationListDto | undefined {
  if (!current) return current
  if (current.items.some((item) => item.id === notification.id)) return current
  const items = [notification, ...current.items].slice(0, 30)
  return {
    ...current,
    items,
    total: current.total + 1,
    unreadCount: current.unreadCount + (notification.readAt ? 0 : 1),
  }
}

function setUnreadCount(
  current: NotificationListDto | undefined,
  payload: UnreadCountDto
): NotificationListDto | undefined {
  return current ? { ...current, unreadCount: payload.count } : current
}

function appendRequestMessage(
  current: RequestDetailDto | undefined,
  payload: RealtimeRequestMessageCreatedDto
): RequestDetailDto | undefined {
  if (!current || current.request.id !== payload.requestId) return current
  if (current.messages.some((message) => message.id === payload.message.id)) return current
  return {
    ...current,
    request: {
      ...current.request,
      messageCount: current.request.messageCount + 1,
    },
    messages: [...current.messages, payload.message],
  }
}

export function RealtimeProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const qc = useQueryClient()
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    let active = true
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let currentSocket: Socket | null = null

    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = null
    }

    const scheduleReconnect = () => {
      if (!active || retryTimer) return
      retryTimer = setTimeout(() => {
        retryTimer = null
        void connect()
      }, 5_000)
    }

    const connect = async () => {
      clearRetry()
      currentSocket?.close()
      currentSocket = null
      setSocket(null)

      let issued: RealtimeTokenDto
      try {
        issued = await api.get<RealtimeTokenDto>('realtime/token')
      } catch {
        scheduleReconnect()
        return
      }
      if (!active) return

      const socketPath =
        typeof window !== 'undefined' && issued.origin === globalThis.location.origin
          ? appPath(issued.path)
          : issued.path

      const next = io(issued.origin, {
        path: socketPath,
        auth: { token: issued.token },
        transports: ['websocket', 'polling'],
        withCredentials: true,
      })
      currentSocket = next
      setSocket(next)

      next.on(REALTIME_EVENTS.notificationCreated, (notification: NotificationDto) => {
        qc.setQueryData<NotificationListDto>(notificationKeys.list, (current) =>
          appendNotification(current, notification)
        )
        if (notification.requestId) {
          void qc.invalidateQueries({ queryKey: brokerageKeys.request(notification.requestId) })
          void qc.invalidateQueries({ queryKey: brokerageKeys.all })
        }
        toast.info(notification.title, { description: notification.body })
      })

      next.on(REALTIME_EVENTS.notificationUnreadCount, (payload: UnreadCountDto) => {
        qc.setQueryData(notificationKeys.unread, payload)
        qc.setQueryData<NotificationListDto>(notificationKeys.list, (current) =>
          setUnreadCount(current, payload)
        )
      })

      next.on(
        REALTIME_EVENTS.requestMessageCreated,
        (payload: RealtimeRequestMessageCreatedDto) => {
          qc.setQueryData<RequestDetailDto>(brokerageKeys.request(payload.requestId), (current) =>
            appendRequestMessage(current, payload)
          )
          void qc.invalidateQueries({ queryKey: brokerageKeys.request(payload.requestId) })
        }
      )

      next.on('connect_error', () => {
        next.close()
        scheduleReconnect()
      })
    }

    void connect()

    return () => {
      active = false
      clearRetry()
      currentSocket?.close()
      setSocket(null)
    }
  }, [qc, userId])

  const value = useMemo(() => socket, [socket])
  return <RealtimeSocketContext.Provider value={value}>{children}</RealtimeSocketContext.Provider>
}
