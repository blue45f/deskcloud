import { metricLimit, remainingQuota } from './constants'

import type { Plan, UsageMetric } from './constants'

/* ── 테넌트(앱) ───────────────────────────────────────────────────────────── */

/** 테넌트 공개 표현(secret 평문·해시 제외). */
export interface TenantDto {
  id: string
  name: string
  slug: string
  publishableKey: string
  corsOrigins: string[]
  plan: Plan
  createdAt: string
  updatedAt: string
}

/** 가입/키 회전 응답 — secret 평문을 1회만 포함한다(이후 재노출 불가). */
export interface TenantWithSecretDto extends TenantDto {
  secretKey: string
}

/* ── end-user ─────────────────────────────────────────────────────────────── */

/** end-user 공개 표현 — passwordHash 는 절대 노출하지 않는다. */
export interface EndUserDto {
  id: string
  email: string
  name: string
  verified: boolean
  createdAt: string
}

/** 가입/로그인 응답 — 사용자 + 액세스 토큰(JWT) + 만료(초). */
export interface AuthResultDto {
  user: EndUserDto
  token: string
  /** 액세스 토큰 만료까지 남은 초. */
  expiresIn: number
}

/** 어드민 사용자 목록(페이지네이션). */
export interface UserListDto {
  items: EndUserDto[]
  total: number
  offset: number
  limit: number
}

/**
 * 트래픽/방문자 집계 — 위젯·대시보드의 공개 핑(POST /auth/visit)으로 쌓이는 신규-추적 메트릭.
 *
 * 정직성: 가입 통계(userCount/signups)는 end_users.createdAt 의 실제 데이터지만, 페이지 방문은
 * 신규 기능이라 과거 백필이 불가능하다. 카운트는 추적 시작(since) 이후만 누적되며 운영자에게
 * '추적 시작 이후'로 표기한다. todayVisitors(고유 방문자)는 일별 해시 vid seen-set 기반 정직 근사치.
 */
export interface TrafficStatsDto {
  /** 오늘(서버 tz) 총 방문 수. */
  today: number
  /** 추적 시작 이후 누적 총 방문 수. */
  total: number
  /** 오늘 고유 방문자 수(일별 해시 vid 기준 근사). */
  todayVisitors: number
  /** 추적이 시작된 첫 날(YYYY-MM-DD). 추적 데이터가 없으면 null. */
  since: string | null
}

/** 어드민 통계 — 사용자 수 · 가입(기간별) · 로그인 메트릭 · 트래픽. */
export interface AuthStatsDto {
  /** 현재 테넌트 풀의 총 end-user 수. */
  userCount: number
  /** 오늘(서버 tz) 신규 가입자 수. */
  todaySignups: number
  /** 최근 7일 / 30일 신규 가입 수. */
  signups: { last7d: number; last30d: number }
  /** 누적 로그인 성공 수(usage 메트릭 logins). */
  logins: number
  /** verified 사용자 수. */
  verified: number
  /** 트래픽/방문자 집계(신규-추적, '추적 시작 이후'). */
  traffic: TrafficStatsDto
  plan: Plan
}

/** 방문 핑 응답 — 기록 여부(중복/스로틀 등으로 무시될 수 있어 정보용). */
export interface TrackVisitResultDto {
  /** 방문이 집계됐는지(true). */
  ok: true
  /** 이 방문이 오늘 첫 고유 방문(신규 unique)이었는지. */
  unique: boolean
}

/** 사용량 요약의 메트릭 한 줄(used/limit/remaining; limit·remaining 의 -1 은 무제한). */
export interface UsageMetricSummary {
  metric: UsageMetric
  used: number
  limit: number
  remaining: number
}

/** 사용량 요약(메트릭별 used/limit/remaining). */
export interface UsageSummaryDto {
  tenantId: string
  plan: Plan
  metrics: UsageMetricSummary[]
}

/**
 * 메트릭별 실측 사용량(`used`)을 받아 플랜 한도와 합쳐 UsageSummaryDto 를 만든다 — 순수 빌더.
 * limit·remaining 은 플랜에서 파생(무제한은 -1 표식). 운영자 read API(GET /auth/usage)가 사용.
 */
export function buildUsageSummary(
  tenantId: string,
  plan: Plan,
  used: Record<UsageMetric, number>
): UsageSummaryDto {
  const metrics = (Object.keys(used) as UsageMetric[]).map((metric): UsageMetricSummary => {
    const limit = metricLimit(plan, metric)
    return { metric, used: used[metric], limit, remaining: remainingQuota(used[metric], limit) }
  })
  return { tenantId, plan, metrics }
}

/** 로그아웃 응답. */
export interface LogoutResultDto {
  ok: true
}
