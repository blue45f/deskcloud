import type { InquiryCategory, InquiryStatus, MemberRole, Plan, UsageMetric } from './constants'

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

/**
 * 문의 공개 표현 — 공개 게시판이 읽는 안전 필드만.
 * **contactEmail 은 포함하지 않는다**(공개 목록에서 redact). 어드민 표현은 {@link InquiryAdminDto}.
 */
export interface InquiryDto {
  id: string
  /** 문의를 보낸 형제 앱 식별자(예: 'rotifolk', 'offhours'). */
  appId: string
  category: InquiryCategory
  status: InquiryStatus
  title: string
  body: string
  /** 작성자 표시명(선택). */
  authorName: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 문의 어드민 표현 — 공개 필드 + contactEmail·originUrl(트리아지용).
 * AdminTokenGuard 로 보호되는 경로에서만 직렬화한다.
 */
export interface InquiryAdminDto extends InquiryDto {
  /** 회신용 이메일(선택). 공개 목록에서는 노출하지 않는다. */
  contactEmail: string | null
  /** 문의가 제출된 출처 URL(선택). */
  originUrl: string | null
  /** 출처 URL에서 정규화한 host[:port]. 서비스 도메인별 운영 필터에 사용한다. */
  originHost: string | null
}

/** 문의 목록 응답(페이지네이션) — 공개 게시판/어드민 공용 봉투. */
export interface InquiryListDto<T extends InquiryDto = InquiryDto> {
  appId: string
  items: T[]
  limit: number
  offset: number
}

/**
 * 방문/트래픽 집계 응답 — 형제 앱이 공개 API 로 읽는 실데이터(서버 누적).
 * 일별 버킷(daily_visits)을 합산해 오늘/전체를 모두 돌려준다. 키 인증 없이 읽힌다.
 */
export interface VisitStatsDto {
  /** 집계 대상 앱 식별자(예: 'aidigestdesk'). */
  appId: string
  /** 집계 기준 일자('YYYY-MM-DD', UTC). */
  day: string
  /** 오늘 총 방문(pageview) 수. */
  todayVisits: number
  /** 오늘 고유 방문자(브라우저 최초 방문) 수. */
  todayUniques: number
  /** 누적 총 방문(pageview) 수. */
  totalVisits: number
  /** 누적 고유 방문자 수. */
  totalUniques: number
}
