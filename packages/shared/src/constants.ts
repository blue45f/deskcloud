/**
 * 도메인 상수. TermsDesk 는 약관을 "작성"하지 않습니다 — 등록·버전 관리·게시·감사만 합니다.
 * 따라서 여기에는 문서의 "종류" 분류만 있을 뿐, 문안 템플릿은 없습니다.
 */

/** 배포 형태 — 같은 코드베이스가 두 모드로 동작합니다. */
export const DEPLOYMENT_MODES = ['self-hosted', 'saas'] as const
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number]

/** 문서 종류(분류용). 회사가 가진 약관/정책의 갈래. */
export const POLICY_TYPES = ['terms', 'privacy', 'marketing', 'refund', 'cookie', 'custom'] as const
export type PolicyType = (typeof POLICY_TYPES)[number]

export const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
  marketing: '마케팅 정보 수신',
  refund: '환불·취소 정책',
  cookie: '쿠키 정책',
  custom: '기타 정책',
}

/**
 * 정책 노출 범위. 게시·해시 로직과 무관한 "노출 제어"만 담당합니다.
 * - public: 무인증 공개 렌더(/api/public/:orgSlug/...)·호스티드 페이지에 노출
 * - private: 공개 경로에서는 404 — 단 API 키 경로(v1/policies, 자사 SDK)는 키 스코프 내 허용
 */
export const POLICY_VISIBILITIES = ['public', 'private'] as const
export type PolicyVisibility = (typeof POLICY_VISIBILITIES)[number]

export const POLICY_VISIBILITY_LABELS: Record<PolicyVisibility, string> = {
  public: '공개',
  private: '비공개',
}

/** 버전 상태. 게시(published)되면 본문·해시는 불변. */
export const VERSION_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const
export type VersionStatus = (typeof VERSION_STATUSES)[number]

/** 동의 영수증의 결정값. 철회/재동의는 새 행으로 append. */
export const CONSENT_DECISIONS = ['accepted', 'declined', 'withdrawn'] as const
export type ConsentDecision = (typeof CONSENT_DECISIONS)[number]

/** 동의가 수집된 방식(증거). */
export const CONSENT_METHODS = ['checkbox_clickwrap', 'api', 'import', 'sso'] as const
export type ConsentMethod = (typeof CONSENT_METHODS)[number]

/** 조직 내 역할(RBAC). publisher 만 게시 가능 — 법무 사인오프 게이트. */
export const ROLES = ['owner', 'admin', 'publisher', 'editor', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: '소유자',
  admin: '관리자',
  publisher: '게시자',
  editor: '편집자',
  viewer: '뷰어',
}

/** 역할별 권한 매트릭스(간단한 role→permission). */
export const PERMISSIONS = {
  'policy.read': ['owner', 'admin', 'publisher', 'editor', 'viewer'],
  'policy.write': ['owner', 'admin', 'publisher', 'editor'],
  'version.create': ['owner', 'admin', 'publisher', 'editor'],
  'version.publish': ['owner', 'admin', 'publisher'],
  'audit.read': ['owner', 'admin', 'publisher', 'viewer'],
  'consent.read': ['owner', 'admin', 'publisher', 'viewer'],
  'apikey.manage': ['owner', 'admin'],
  'member.manage': ['owner', 'admin'],
  // 중앙 문의 보드 — policy.read/write 매트릭스와 동형(읽기는 전 역할, 처리는 편집 가능 역할).
  'inquiry.read': ['owner', 'admin', 'publisher', 'editor', 'viewer'],
  'inquiry.manage': ['owner', 'admin', 'publisher', 'editor'],
  // 약관 의뢰 중계 — 조직의 의뢰를 누가 보고/올리고 처리(수락·완료·취소)하는가.
  // 읽기는 전 역할, 등록·관리는 편집 가능 역할(viewer 제외). 전문가 활동은 역할이 아니라
  // 전문가 프로필(opt-in) 보유로 게이팅되므로 여기에 두지 않는다.
  'request.read': ['owner', 'admin', 'publisher', 'editor', 'viewer'],
  'request.manage': ['owner', 'admin', 'publisher', 'editor'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

/** API 키 스코프(공개 게시/동의 기록용). */
export const API_KEY_SCOPES = ['read:current', 'write:consent', 'read:consent'] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
