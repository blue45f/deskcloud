import type {
  ApiKeyScope,
  ConsentDecision,
  ConsentMethod,
  PolicyType,
  PolicyVisibility,
  Role,
  VersionStatus,
} from './constants'
import type { PlanId, PlanLimits } from './plans'
import type { ConsentEvidence } from './schemas'

/** API ↔ Web 가 주고받는 응답 DTO (드리즐 엔티티의 직렬화 형태). */

export interface OrgDto {
  id: string
  name: string
  slug: string
  /** 조직(프로젝트) 로고 URL — 공개 페이지 헤더 아이콘. 없으면 이니셜 모노그램 폴백. */
  logoUrl: string | null
  /** 현재 플랜(free|pro|team) — mock 청구: 변경은 결정 기록만, 실제 결제 없음. */
  plan: PlanId
  /** 마지막 플랜 변경 시각(없으면 가입 이후 변경 이력 없음). */
  planChangedAt: string | null
  createdAt: string
}

export interface MemberDto {
  id: string
  email: string
  name: string
  role: Role
  createdAt: string
}

export interface SessionDto {
  user: MemberDto
  org: OrgDto
  mode: 'self-hosted' | 'saas'
}

/** 공개 인증 설정 — 로그인/가입 화면이 어떤 방식을 노출할지 결정. */
export interface AuthConfigDto {
  mode: 'self-hosted' | 'saas'
  /** 이메일/비밀번호 셀프 가입 허용 여부. */
  signupEnabled: boolean
  /** Google 로그인 사용 가능 여부(GOOGLE_CLIENT_ID 설정 시). */
  googleEnabled: boolean
  /** GIS 버튼용 공개 클라이언트 ID(googleEnabled 일 때만). */
  googleClientId: string | null
  /** 로그인 없이 둘러보기(데모 게스트 세션) 허용 여부. */
  demoEnabled: boolean
}

export interface PolicyDto {
  id: string
  slug: string
  name: string
  type: PolicyType
  jurisdiction: string
  description: string | null
  /** 공개/비공개 — private 이면 무인증 공개 렌더에서 404(API 키 경로는 허용). */
  visibility: PolicyVisibility
  currentVersionId: string | null
  currentVersionLabel: string | null
  versionCount: number
  createdAt: string
  updatedAt: string
}

export interface PolicyVersionSummaryDto {
  id: string
  policyId: string
  versionNumber: number
  versionLabel: string
  title: string
  status: VersionStatus
  locale: string
  contentHash: string | null
  requiresReconsent: boolean
  changeSummary: string | null
  effectiveAt: string | null
  createdByName: string | null
  publishedByName: string | null
  createdAt: string
  publishedAt: string | null
}

export interface PolicyVersionDetailDto extends PolicyVersionSummaryDto {
  body: string
}

export interface ConsentReceiptDto {
  id: string
  policySlug: string
  policyVersionId: string
  versionLabel: string
  contentHash: string
  subjectRef: string
  decision: ConsentDecision
  method: ConsentMethod
  locale: string
  evidence: ConsentEvidence | null
  parentReceiptId: string | null
  createdAt: string
}

export interface AuditEventDto {
  id: string
  actorName: string | null
  action: string
  targetType: string
  targetId: string | null
  summary: string | null
  ip: string | null
  createdAt: string
}

export interface ApiKeyDto {
  id: string
  name: string
  keyPrefix: string
  scopes: ApiKeyScope[]
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

/** 생성 직후 1회만 평문 키를 반환(이후 해시만 저장). */
export interface ApiKeyCreatedDto extends ApiKeyDto {
  plaintextKey: string
}

/** 공개 게시(서빙) 응답 — SDK 가 소비. */
export interface PublicPolicyDto {
  policySlug: string
  name: string
  type: PolicyType
  locale: string
  versionId: string
  versionLabel: string
  contentHash: string
  body: string
  effectiveAt: string | null
  publishedAt: string | null
  changeSummary: string | null
  /** 조직(프로젝트) 로고 URL — 임베드/호스티드 헤더 아이콘용(없으면 모노그램 폴백). */
  orgLogoUrl?: string | null
  /** subjectRef/knownHash 가 함께 오면 채워짐: 재동의 필요 여부 */
  reconsentRequired?: boolean
}

export interface ConsentReceiptCreatedDto {
  receiptId: string
  policySlug: string
  versionLabel: string
  contentHash: string
  decision: ConsentDecision
  createdAt: string
}

/**
 * 공개(인증 없음) 약관 렌더 응답 — 호스티드 페이지·iframe·임베드 위젯이 소비.
 * URL 파라미터로 버전(`version`)·로케일·템플릿 변수 치환을 지원합니다.
 */
export interface PublicRenderDto {
  orgName: string
  /** 조직(프로젝트) 로고 URL — 공개 페이지 헤더 아이콘용(없으면 모노그램 폴백). */
  orgLogoUrl?: string | null
  policySlug: string
  name: string
  type: PolicyType
  locale: string
  versionId: string
  versionLabel: string
  contentHash: string
  /** 템플릿 변수 치환이 적용된 표시용 본문(원문 해시는 불변). */
  body: string
  effectiveAt: string | null
  publishedAt: string | null
  changeSummary: string | null
  /** 이 정책에서 선택 가능한(게시 이력이 있는) 버전 라벨, 최신순. */
  availableVersions: string[]
  /** 본문에 남은(값이 주어지지 않은) 템플릿 변수 키. */
  unresolvedVars: string[]
}

// ── 플랜 · 사용량 ─────────────────────────────────────────────────────────────

/** 조직의 현재 플랜·한도·사용량 묶음 — 설정(플랜 카드)·대시보드(미터 카드)가 소비. */
export interface PlanUsageDto {
  plan: PlanId
  planChangedAt: string | null
  /** 현재 플랜의 한도(-1 = 무제한). */
  limits: PlanLimits
  usage: {
    /** 조직 멤버 수 */
    members: number
    /** 활성(보관 제외) 정책 수 */
    policies: number
    /** 활성(폐기 제외) API 키 수 */
    apiKeys: number
    /** 이번 달(UTC) API 키 경유 호출 수 */
    apiCallsThisMonth: number
  }
  /** 집계 월(UTC) — 'YYYY-MM' */
  month: string
}

// ── 운영 인사이트(대시보드) ────────────────────────────────────────────────────

/** 동의 추이 — 일자(UTC) 버킷 집계. 기록이 없는 날도 0으로 채워 연속 구간을 보장. */
export interface ConsentTrendPointDto {
  /** YYYY-MM-DD (UTC) */
  date: string
  accepted: number
  declined: number
  withdrawn: number
  total: number
}

/** 정책별 재동의 필요 현황 — 현재 게시본 해시 기준(게시 이력이 있는 정책만). */
export interface ReconsentStatusDto {
  policyId: string
  policySlug: string
  policyName: string
  currentVersionLabel: string | null
  /** 영수증을 가진 고유 subjectRef 수(전체). */
  totalSubjects: number
  /** 현재 게시본 해시에 'accepted' 영수증이 있는 고유 subjectRef 수. */
  acceptedCurrent: number
  /** 재동의 필요 = totalSubjects - acceptedCurrent. */
  pendingReconsent: number
}

/**
 * API 키 사용 현황. 키별 호출 카운터 컬럼은 스키마에 없으므로(추가하지 않음)
 * 키별로는 last_used_at 만, 호출량은 audit_events(consent.recorded) 30일 집계로 보완.
 */
export interface ApiKeyUsageDto {
  keys: ApiKeyDto[]
  /** 최근 30일 API 경유 동의 기록 수 — audit_events action='consent.recorded' 집계. */
  consentWrites30d: number
}

/**
 * 변조 검증(공개·무인증) 응답. 저장된 게시본을 지금 다시 해싱해 (a) 게시 시점 해시와
 * 일치하는지(자가 무결성), (b) 제시한 해시가 실제 게시 버전인지 증명합니다. 외부 감사자가
 * 영수증의 content_hash 진위를 독립적으로 확인하는 "증거 검증" 경로.
 */
export interface PublicVerifyDto {
  verified: boolean
  orgName: string
  policySlug: string
  versionLabel: string | null
  /** 매칭된(또는 현재) 버전의 게시 시점 동결 해시. */
  contentHash: string | null
  /** 저장된 본문을 지금 다시 계산한 해시(= contentHash 면 무결). */
  recomputedHash: string
  effectiveAt: string | null
  publishedAt: string | null
  /** verified=false 사유. */
  reason?: string
}
