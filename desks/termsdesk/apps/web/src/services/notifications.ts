import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './api'

import type { NotificationListDto, UnreadCountDto } from '@termsdesk/shared'

/** 인앱 알림 — TanStack Query 훅. */

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: () => api.get<NotificationListDto>('notifications', { limit: 30 }),
    enabled,
  })
}

/** 안 읽음 수 — 배지용. 주기적으로 갱신해 새 알림을 반영. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => api.get<UnreadCountDto>('notifications/unread-count'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ ok: true; updated: number }>('notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
