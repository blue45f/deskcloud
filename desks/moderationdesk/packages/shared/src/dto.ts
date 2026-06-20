import type { Plan, ReportStatus, RuleAction, RuleKind, Verdict } from './constants'
import type { MatchedRule } from './match-rules'

/** 테넌트 가입 응답 — secret 키는 이 응답에서 **단 한 번만** 평문 노출된다. */
export interface TenantCreatedDto {
  tenant: TenantDto
  /** 브라우저 안전(검사 + 신고). */
  publishableKey: string
  /** 서버 전용(관리). 이 응답 이후로는 다시 볼 수 없다(해시만 저장). */
  secretKey: string
}

/** 테넌트 공개 표현(secret 해시는 절대 노출하지 않음). */
export interface TenantDto {
  id: string
  name: string
  slug: string
  publishableKey: string
  corsOrigins: string[]
  plan: Plan
  usageCount: number
  createdAt: string
}

/** 모더레이션 검사 결과 — 공개 응답. */
export interface ModerateResultDto {
  verdict: Verdict
  /** 매칭된 금칙 규칙(규칙 기반). 없으면 빈 배열. */
  matchedRules: MatchedRule[]
  /**
   * AI 보조 독성 점수(0~1). AI 경로가 실행되어 점수를 산출했을 때만 존재.
   * 키 미설정/오류/useAi:false 면 undefined(필드 생략).
   */
  aiScore?: number
  /** 이 검사로 적재된 로그 id(추적용). */
  logId: string
}

/** 금칙 규칙 — 어드민 표현. */
export interface RuleDto {
  id: string
  tenantId: string
  pattern: string
  kind: RuleKind
  action: RuleAction
  label: string | null
  enabled: boolean
  createdAt: string
}

/** 신고 — 어드민 표현. */
export interface ReportDto {
  id: string
  tenantId: string
  subjectType: string
  subjectId: string
  reason: string
  reporterId: string | null
  status: ReportStatus
  notes: string | null
  createdAt: string
}

/** 신고 접수 영수증 — 접수자에게 돌려주는 최소 정보. */
export interface ReportReceiptDto {
  id: string
  status: ReportStatus
  createdAt: string
}

/** 어드민 신고 목록(페이지네이션). */
export interface ReportListDto {
  items: ReportDto[]
  /** 같은 필터의 전체 건수(X-Total-Count 헤더와 동일 값). */
  total: number
  offset: number
  limit: number
}

/** 모더레이션 로그 — 어드민 표현. */
export interface LogDto {
  id: string
  tenantId: string
  text: string
  verdict: Verdict
  matchedRules: MatchedRule[]
  aiScore: number | null
  source: string | null
  createdAt: string
}

/** 어드민 로그 목록(페이지네이션). */
export interface LogListDto {
  items: LogDto[]
  total: number
  offset: number
  limit: number
}

/**
 * 대시보드 트래픽/애널리틱스 요약 — 어드민(`/api/admin/stats`).
 *
 * 모든 수치는 **실제 집계**다. 다만 데이터별 정직성 등급이 다르므로 각 그룹에
 * 등급 플래그를 함께 실어 프런트가 "추정"·"운영자 전용" 등으로 명확히 라벨링한다.
 *
 * - `scope` — 자격증명 종류. `tenant`(sk) 면 대상 테넌트 1곳, `operator`(글로벌 토큰) 면 운영자.
 * - `traffic` — moderation_logs 행 수(검사=요청/활동 이벤트). 대상 테넌트 기준. **실데이터**.
 * - `visitors` — "고유 방문자"는 검사에 종단 사용자 신원이 없어 도출 불가. 대신 오늘의
 *   distinct actor(reporter 또는 log.source) 수를 **근사치**로 제공한다(`estimated: true`).
 * - `signups` — tenants 행. `operator` 스코프에서만 플랫폼 전체가 의미 있다. `tenant` 스코프에선
 *   대상 테넌트 본인 기준(오늘 가입=0/1, total 은 항상 1) 이며 `operatorOnly: true` 로 표시한다.
 */
export interface StatsDto {
  /** 자격증명 스코프 — 'tenant'(sk) | 'operator'(글로벌 ADMIN_TOKEN). */
  scope: 'tenant' | 'operator'
  /** 총·오늘 트래픽(검사/활동 이벤트 = moderation_logs). 실데이터. */
  traffic: {
    today: number
    total: number
  }
  /** 오늘 방문자 — distinct actor 근사치(고유 방문자 아님). source 는 산출 근거. */
  visitors: {
    today: number
    /** 근사치임을 명시(고유 방문자 정밀값 아님). */
    estimated: boolean
    /** 근거 설명(예: 'distinct sources today'). */
    source: string
  }
  /** 가입 — tenants 행. operator 스코프에서만 플랫폼 전체로 의미 있음. */
  signups: {
    today: number
    total: number
    /** true 면 tenant 스코프라 대상 테넌트 본인 기준(플랫폼 전체 아님). */
    operatorOnly: boolean
  }
}
