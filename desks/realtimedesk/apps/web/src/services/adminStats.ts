import { useQuery } from '@tanstack/react-query'

import { api } from './api'

import type { AdminStatsDto } from '@realtimedesk/shared'

import { useAuthStore } from '@/app/authStore'

/**
 * 운영 현황(어드민) — 플랫폼 전역 가입·트래픽 지표.
 * GET /api/admin/stats (AdminGuard: sk 로 통과). api 클라이언트가 X-Realtime-Key: sk_… 를 싣는다.
 * 가입은 실집계(real), 트래픽은 추적 누적(tracked-new) — 출처는 DTO 라벨로 구분된다.
 */
export const adminStatsKey = ['admin', 'stats'] as const

/** 운영 현황 폴링 훅. 기본 30초 간격으로 갱신. */
export function useAdminStats(options?: { refetchInterval?: number }) {
  const isAuthed = useAuthStore((s) => s.isAuthed)
  return useQuery({
    queryKey: adminStatsKey,
    queryFn: () => api.get<AdminStatsDto>('admin/stats'),
    enabled: isAuthed,
    retry: false,
    refetchInterval: options?.refetchInterval ?? 30_000,
  })
}
