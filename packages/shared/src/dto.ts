import type { MemberRole, Plan, UsageMetric } from './constants'

/** 테넌트 공개 표현(서버 직렬화). secretKey/secretKeyHash 는 절대 포함하지 않는다. */
export interface TenantDto {
  id: string
  name: string
  slug: string
  /** 공개 안전 키(프론트 임베드용). */
  publishableKey: string
  corsOrigins: string[]
  plan: Plan
  createdAt: string
  updatedAt: string
}

/**
 * 가입/키 회전 응답 — secret 키 평문을 **이 응답에서 1회만** 돌려준다.
 * 이후에는 어디서도 평문을 조회할 수 없다(해시만 저장).
 */
export interface TenantWithSecretDto extends TenantDto {
  /** 평문 secret 키(`sk_…`) — 안전한 곳에 즉시 저장하세요. 다시 조회 불가. */
  secretKey: string
}

/** 멤버(좌석) 표현. */
export interface MemberDto {
  id: string
  tenantId: string
  email: string
  role: MemberRole
  createdAt: string
}

/** 단일 메트릭의 사용량 + 플랜 한도. */
export interface UsageMetricDto {
  metric: UsageMetric
  used: number
  limit: number
  remaining: number
}

/** 기간별 사용량 요약(테넌트 단위). */
export interface UsageSummaryDto {
  tenantId: string
  plan: Plan
  /** 'current' 또는 'YYYY-MM'. */
  period: string
  metrics: UsageMetricDto[]
}
