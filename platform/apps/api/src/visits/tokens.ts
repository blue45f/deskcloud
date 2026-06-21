import type { VisitStatsDto } from '@desk/shared'

/** 방문 집계 스토어 DI 토큰. */
export const VISITS_STORE = Symbol('VISITS_STORE')

/** 핑 1회 입력 — appId·day(서비스가 정규화) + 고유 방문자 여부. */
export interface PingVisitRecord {
  appId: string
  /** 'YYYY-MM-DD'(UTC) — 서비스가 산출해 넘긴다. */
  day: string
  /** 이 브라우저 최초 방문이면 true — uniques 도 +1. */
  newVisitor: boolean
}

/**
 * 방문 영속화 포트 — apps/api 가 Drizzle 로 구현해 주입한다(테스트는 인메모리/PGlite).
 * ping 은 (appId, day) 버킷을 원자적으로 증가(upsert)하고, stats 는 오늘/전체 합계를 돌려준다.
 */
export interface VisitsStorePort {
  /** 오늘 버킷을 원자적으로 증가(visits +1, newVisitor 면 uniques +1). */
  ping(rec: PingVisitRecord): Promise<void>
  /** 앱별 집계 — 오늘(day 일치) + 전체(SUM) 방문/고유 방문자. */
  stats(appId: string, day: string): Promise<VisitStatsDto>
}
