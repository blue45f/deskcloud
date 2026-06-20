import { api } from './api'

import type { StatsOverviewDto } from '@filedesk/shared'

/**
 * 운영 현황(공개 집계) API 클라이언트.
 *
 * GET /api/stats/overview 는 인증이 없는 공개 엔드포인트라 auth:false 로 호출한다.
 * 방문 핑(POST /api/stats/visit)도 공개이며 fire-and-forget(실패는 조용히 무시).
 */

/** 운영 현황 합계 조회(공개) — 총/오늘 가입 수, 총 트래픽, 오늘 방문자 수. */
export function getStatsOverview(): Promise<StatsOverviewDto> {
  return api.get<StatsOverviewDto>('stats/overview', undefined, false)
}

/**
 * 방문 핑 — 브라우저/일 1회. clientId(무작위)만 보낸다.
 * 실패해도 UX 에 영향 없도록 호출부에서 swallow 한다.
 */
export function pingVisit(clientId: string): Promise<unknown> {
  return api.post<unknown>('stats/visit', { clientId }, false)
}
