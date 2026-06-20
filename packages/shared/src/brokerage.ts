import { z } from 'zod'

import { POLICY_TYPES, type PolicyType } from './constants'

/**
 * 약관 의뢰 중계(Brokerage) — TermsDesk 의 중계 레이어.
 *
 * 의뢰자(약관 작성·검토·개정·번역이 필요한 회사)와 전문가(검토자·작성자)를 잇고,
 * 운영자(중계자)가 검수·중재합니다. **플랫폼 자체는 약관을 작성하지 않습니다** — 전문가를
 * 연결하고, 진행을 관리하고, 완료된 산출물을 기존 버전 관리(정책 버전)로 넘기는 "중계"만
 * 담당합니다. 금액(견적)은 메타데이터일 뿐 실제 자금 이동은 없습니다(결정 기록만).
 */

// ── 열거형 ────────────────────────────────────────────────────────────────────

/** 의뢰 종류 — 무엇을 맡기는가. */
export const SERVICE_REQUEST_TYPES = ['draft', 'review', 'update', 'translate'] as const
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number]

export const SERVICE_REQUEST_TYPE_LABELS: Record<ServiceRequestType, string> = {
  draft: '신규 작성',
  review: '검토·자문',
  update: '개정·업데이트',
  translate: '번역·현지화',
}

/**
 * 의뢰 상태(라이프사이클). 단방향에 가깝게 흐른다:
 * open → matched → in_progress → delivered → completed. 어느 단계든 cancelled 로 종료 가능.
 */
export const SERVICE_REQUEST_STATUSES = [
  'open',
  'matched',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
] as const
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number]

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  open: '제안 모집 중',
  matched: '전문가 매칭됨',
  in_progress: '진행 중',
  delivered: '검수 대기',
  completed: '완료',
  cancelled: '취소됨',
}

/** 종료(더 이상 제안/진행이 없는) 상태. */
export const TERMINAL_REQUEST_STATUSES: readonly ServiceRequestStatus[] = ['completed', 'cancelled']

/**
 * 모의 에스크로 상태 — **실제 자금 이동 없음**(결정·표시 전용). 제안 수락(견적 있으면) 시 held,
 * 완료 시 released, 보증 중 취소 시 refunded. 견적이 없으면 none(협의).
 */
export const ESCROW_STATUSES = ['none', 'held', 'released', 'refunded'] as const
export type EscrowStatus = (typeof ESCROW_STATUSES)[number]

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  none: '해당 없음',
  held: '보증 중(모의)',
  released: '정산 완료(모의)',
  refunded: '환불(모의)',
}

/** 노출 범위 — public 만 마켓플레이스(전문가 탐색)에 노출. private 은 초대/직접 매칭 전용. */
export const REQUEST_VISIBILITIES = ['public', 'private'] as const
export type RequestVisibility = (typeof REQUEST_VISIBILITIES)[number]

export const REQUEST_VISIBILITY_LABELS: Record<RequestVisibility, string> = {
  public: '공개 모집',
  private: '비공개',
}

/** 제안(견적) 상태. 수락되면 나머지는 자동 reject. */
export const PROPOSAL_STATUSES = ['submitted', 'accepted', 'rejected', 'withdrawn'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  submitted: '검토 대기',
  accepted: '수락됨',
  rejected: '미선정',
  withdrawn: '철회됨',
}

/** 메시지 종류 — delivery 는 전문가의 산출물 제출(상태를 delivered 로 전이). */
export const MESSAGE_KINDS = ['message', 'delivery', 'system'] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

/** 스레드/제안에서 작성자가 의뢰에 대해 갖는 관계. */
export const PARTICIPANT_ROLES = ['requester', 'provider', 'admin'] as const
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number]

/**
 * 뷰어가 이 의뢰에 대해 갖는 관계 — 응답에 동봉해 프런트가 어떤 액션을 보일지 결정.
 * guest = 마켓플레이스에서 보는 비참여 전문가(제안 가능), none = 권한 없음.
 */
export const VIEWER_RELATIONS = ['requester', 'provider', 'admin', 'guest', 'none'] as const
export type ViewerRelation = (typeof VIEWER_RELATIONS)[number]

// ── 의뢰 빠른 시작 템플릿 ────────────────────────────────────────────────────────

/** 의뢰 작성 폼을 미리 채우는 빠른 시작 템플릿 — 의뢰자의 진입 장벽을 낮춘다. */
export interface RequestTemplate {
  key: string
  label: string
  serviceType: ServiceRequestType
  policyType: PolicyType
  title: string
  description: string
}

export const REQUEST_TEMPLATES: readonly RequestTemplate[] = [
  {
    key: 'saas-tos-draft',
    label: 'SaaS 이용약관 작성',
    serviceType: 'draft',
    policyType: 'terms',
    title: 'SaaS 서비스 이용약관 신규 작성',
    description:
      'B2B SaaS 서비스의 이용약관을 신규로 작성해 주실 전문가를 찾습니다. 구독 결제·해지·환불, 책임 제한, 데이터 처리 위탁, 지식재산권 조항 포함이 필요합니다. 서비스 형태·대상·요금제 등 세부 자료는 매칭 후 공유드리겠습니다.',
  },
  {
    key: 'privacy-review',
    label: '개인정보처리방침 검토',
    serviceType: 'review',
    policyType: 'privacy',
    title: '개인정보처리방침 검토·자문',
    description:
      '현행 개인정보처리방침이 최신 개인정보보호법에 부합하는지 검토하고 개선점을 자문받고자 합니다. 수집 항목·보유 기간·제3자 제공·처리 위탁 현황 자료를 제공하겠습니다.',
  },
  {
    key: 'privacy-update',
    label: '개인정보처리방침 개정',
    serviceType: 'update',
    policyType: 'privacy',
    title: '서비스 개편에 따른 개인정보처리방침 개정',
    description:
      '신규 기능 도입으로 수집 항목과 처리 목적이 변경되어 개인정보처리방침 개정이 필요합니다. 변경 내역을 정리해 전달드리며, 고지·동의 흐름까지 함께 검토해 주시면 좋겠습니다.',
  },
  {
    key: 'tos-translate',
    label: '약관 영문 번역',
    serviceType: 'translate',
    policyType: 'terms',
    title: '이용약관 영문(EN) 번역·현지화',
    description:
      '해외 출시를 위해 국문 이용약관을 영문으로 번역·현지화해 주실 전문가를 찾습니다. 법률 용어의 정확성과 자연스러운 표현이 모두 중요합니다. 대상 국가·서비스 맥락을 공유드리겠습니다.',
  },
  {
    key: 'marketing-consent',
    label: '마케팅 수신 동의 문구',
    serviceType: 'draft',
    policyType: 'marketing',
    title: '마케팅 정보 수신 동의 문구 작성',
    description:
      '이메일·SMS·앱 푸시 마케팅 정보 수신 동의 문구와 수신 거부(철회) 안내를 작성해 주세요. 채널별 분리 동의와 야간 전송 관련 안내가 필요합니다.',
  },
  {
    key: 'refund-review',
    label: '환불·취소 정책 검토',
    serviceType: 'review',
    policyType: 'refund',
    title: '환불·취소 정책 검토',
    description:
      '전자상거래법과 콘텐츠 이용 환불 규정에 부합하는지 환불·취소 정책을 검토받고자 합니다. 현행 정책과 결제·구독 구조 자료를 제공하겠습니다.',
  },
]

// ── 입력 스키마 ────────────────────────────────────────────────────────────────

const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

/**
 * 빈 입력을 미입력(undefined)으로 접는다 — 폼 기본값 호환.
 * react-hook-form `valueAsNumber` 는 빈 숫자 입력을 **NaN** 으로 만들므로 ''/null 과 함께
 * NaN 도 undefined 로 흡수해야 선택 필드를 비운 채 제출해도 검증을 통과한다.
 */
const blankToUndefined = (v: unknown): unknown =>
  v === '' || v === null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v

/** 선택 정수(min..max) — 빈값/NaN 은 미입력으로 접는다. */
const optionalIntInRange = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.number().int().min(min).max(max).optional()).optional()

/** 선택 금액(KRW) — 0 이상. */
const optionalKrw = optionalIntInRange(0, 10_000_000_000)

/** YYYY-MM-DD 마감일(선택). 빈 값은 미입력으로 접는다. */
const optionalDate = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '마감일은 YYYY-MM-DD 형식이어야 합니다'),
    z.literal(''),
    z.null(),
  ])
  .transform((v) => (v ? v : undefined))
  .optional()

/** 전문 분야 태그 — 정책 종류 또는 자유 태그(각 1~40자, 최대 10개). */
const specialtiesSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(10)
  .optional()
  .transform((v) => v ?? [])

export const createServiceRequestSchema = z
  .object({
    title: trimmedText(4, 140),
    description: trimmedText(20, 6000),
    serviceType: z.enum(SERVICE_REQUEST_TYPES),
    policyType: z.enum(POLICY_TYPES),
    jurisdiction: z.string().trim().max(8).default('KR'),
    budgetMin: optionalKrw,
    budgetMax: optionalKrw,
    deadline: optionalDate,
    visibility: z.enum(REQUEST_VISIBILITIES).default('public'),
  })
  .refine(
    (v) => v.budgetMin === undefined || v.budgetMax === undefined || v.budgetMin <= v.budgetMax,
    {
      message: '최소 예산은 최대 예산보다 클 수 없습니다',
      path: ['budgetMax'],
    }
  )
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>

/** 의뢰자가 open 상태에서 메타데이터를 수정. 상태 전이는 전용 액션으로 처리. */
export const updateServiceRequestSchema = z
  .object({
    title: trimmedText(4, 140).optional(),
    description: trimmedText(20, 6000).optional(),
    serviceType: z.enum(SERVICE_REQUEST_TYPES).optional(),
    policyType: z.enum(POLICY_TYPES).optional(),
    jurisdiction: z.string().trim().max(8).optional(),
    budgetMin: optionalKrw,
    budgetMax: optionalKrw,
    deadline: optionalDate,
    visibility: z.enum(REQUEST_VISIBILITIES).optional(),
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), {
    message: '변경할 항목이 없습니다',
  })
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>

export const createProposalSchema = z.object({
  message: trimmedText(20, 4000),
  quotedAmount: optionalKrw,
  estimatedDays: optionalIntInRange(1, 3650),
})
export type CreateProposalInput = z.infer<typeof createProposalSchema>

export const createMessageSchema = z.object({
  body: trimmedText(1, 6000),
  /** delivery 는 배정된 전문가만 사용(서버 강제) — 산출물 제출로 간주. */
  kind: z.enum(['message', 'delivery']).default('message'),
  /** 이 메시지에 연결할 업로드 완료 첨부 ID. */
  attachmentIds: z
    .array(z.string().uuid())
    .max(5)
    .optional()
    .transform((v) => v ?? []),
})
export type CreateMessageInput = z.input<typeof createMessageSchema>

/** 참여자의 신고·이의제기 — 의뢰 전체 또는 특정 메시지를 운영자 분쟁 큐에 올린다. */
export const flagRequestSchema = z.object({
  note: trimmedText(5, 2000),
  messageId: z.string().uuid().optional(),
})
export type FlagRequestInput = z.infer<typeof flagRequestSchema>

/** 검수 반려 — 의뢰자가 delivered 산출물에 재작업 사유를 남기고 in_progress 로 되돌린다. */
export const requestRevisionSchema = z.object({
  note: trimmedText(5, 2000),
})
export type RequestRevisionInput = z.infer<typeof requestRevisionSchema>

/** 전문가 프로필 등록/수정(opt-in) — 누구나 전문가로 활동할 수 있다. */
export const upsertProviderProfileSchema = z.object({
  displayName: trimmedText(2, 80),
  headline: trimmedText(4, 120),
  bio: trimmedText(20, 4000),
  specialties: specialtiesSchema,
  jurisdictions: z.string().trim().max(120).default('KR'),
  hourlyRate: optionalKrw,
  /** 회신 받을 연락처(선택) — 운영자·매칭된 의뢰자에게만 노출. */
  contact: z
    .union([z.string().trim().max(200), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  active: z.boolean().default(true),
})
export type UpsertProviderProfileInput = z.infer<typeof upsertProviderProfileSchema>

/** 운영자 모더레이션 — 전문가 검증 배지·활성 토글. */
export const adminUpdateProviderSchema = z
  .object({
    verified: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.verified !== undefined || v.active !== undefined, {
    message: '변경할 항목이 없습니다',
  })
export type AdminUpdateProviderInput = z.infer<typeof adminUpdateProviderSchema>

/**
 * 완료 산출물 → 약관 버전 가져오기. 제출본(delivery 메시지)을 기존 버전 관리의 초안으로 옮긴다.
 * name 미지정 시 의뢰 제목을 정책명으로 사용(서버가 고유 slug 생성).
 */
export const importToPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
  })
  .default({})
export type ImportToPolicyInput = z.infer<typeof importToPolicySchema>

/** 전문가 평가(완료 의뢰) — 별점 1~5 + 선택 후기. */
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .union([z.string().trim().max(2000), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
})
export type CreateReviewInput = z.infer<typeof createReviewSchema>

/** 운영자 에스크로 결정 — 실제 자금 이동 없이 정산/환불 결정만 기록한다. */
export const ADMIN_ESCROW_DECISIONS = ['release', 'refund'] as const
export type AdminEscrowDecision = (typeof ADMIN_ESCROW_DECISIONS)[number]

/** 운영자 모더레이션 — 강제 종료·분쟁 처리·모의 에스크로 결정 + 운영 메모. */
export const adminUpdateRequestSchema = z
  .object({
    status: z.enum(['cancelled']).optional(),
    adminNote: z.string().trim().max(2000).nullable().optional(),
    flagged: z.boolean().optional(),
    disputeNote: z.string().trim().max(4000).nullable().optional(),
    escrowDecision: z.enum(ADMIN_ESCROW_DECISIONS).optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.adminNote !== undefined ||
      v.flagged !== undefined ||
      v.disputeNote !== undefined ||
      v.escrowDecision !== undefined,
    {
      message: '변경할 항목이 없습니다',
    }
  )
export type AdminUpdateRequestInput = z.infer<typeof adminUpdateRequestSchema>

// ── 응답 DTO ───────────────────────────────────────────────────────────────────

export interface ServiceRequestDto {
  id: string
  requesterOrgId: string
  requesterOrgName: string
  /** 의뢰자 담당자 이름 — 마켓플레이스(비참여 전문가) 뷰에서는 null(프라이버시). */
  requesterName: string | null
  title: string
  description: string
  serviceType: ServiceRequestType
  policyType: PolicyType
  jurisdiction: string
  budgetMin: number | null
  budgetMax: number | null
  /** ISO date(YYYY-MM-DD) 또는 null. */
  deadline: string | null
  status: ServiceRequestStatus
  visibility: RequestVisibility
  assignedProviderUserId: string | null
  assignedProviderName: string | null
  /** 모의 에스크로 상태(자금 이동 없음, 표시 전용). */
  escrowStatus: EscrowStatus
  /** 보증된 금액(KRW) — 수락 제안의 견적. null 이면 협의. */
  escrowAmount: number | null
  /** 신고·이의제기 또는 운영자 판단으로 분쟁 큐에 올라간 의뢰인지. */
  flagged: boolean
  /** 분쟁 사유/검토 메모 — 참여자·운영자에게만 채워짐. */
  disputeNote: string | null
  proposalCount: number
  messageCount: number
  /** 운영 메모 — 운영자에게만 채워짐. */
  adminNote: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  /** 뷰어와 이 의뢰의 관계 — 프런트 액션 게이팅. */
  viewerRelation: ViewerRelation
  /** 뷰어(전문가)가 이미 제출한 제안 id(있으면). */
  myProposalId: string | null
  /** 완료 의뢰에 대해 이미 전문가 평가가 등록됐는지(평가 버튼 게이팅). */
  hasReview: boolean
}

export interface ServiceRequestListDto {
  items: ServiceRequestDto[]
  total: number
}

/** 제안에 동봉하는 전문가 요약(카드용). */
export interface ProposalProviderDto {
  headline: string | null
  verified: boolean
  completedCount: number
  /** 평균 별점(1~5, 후기가 없으면 null)과 후기 수 — 신뢰 신호. */
  avgRating: number | null
  reviewCount: number
}

export interface ProposalDto {
  id: string
  requestId: string
  providerUserId: string
  providerName: string
  providerOrgName: string
  message: string
  quotedAmount: number | null
  estimatedDays: number | null
  status: ProposalStatus
  provider: ProposalProviderDto | null
  createdAt: string
  updatedAt: string
}

export interface RequestMessageDto {
  id: string
  requestId: string
  authorUserId: string
  authorName: string
  authorRole: ParticipantRole
  kind: MessageKind
  body: string
  attachments: RequestAttachmentDto[]
  createdAt: string
}

export interface RequestAttachmentDto {
  id: string
  requestId: string
  messageId: string | null
  uploaderUserId: string | null
  uploaderName: string
  uploaderRole: ParticipantRole
  fileName: string
  contentType: string
  sizeBytes: number
  createdAt: string
}

/** 의뢰 상세 묶음 — 참여자(의뢰자/배정 전문가)·운영자가 소비. */
export interface RequestDetailDto {
  request: ServiceRequestDto
  /** 제안 목록 — 의뢰자/운영자는 전체, 전문가는 본인 것만. */
  proposals: ProposalDto[]
  /** 스레드 — 매칭 이후의 의뢰자↔전문가(+운영자) 대화. */
  messages: RequestMessageDto[]
}

export interface ProviderProfileDto {
  id: string
  userId: string
  orgId: string
  orgName: string
  displayName: string
  headline: string
  bio: string
  specialties: string[]
  jurisdictions: string
  hourlyRate: number | null
  /** 연락처 — 본인·운영자·매칭된 의뢰자에게만(그 외 null). */
  contact: string | null
  verified: boolean
  active: boolean
  completedCount: number
  /** 평균 별점(1~5, 후기 없으면 null)과 후기 수 — 신뢰 신호. */
  avgRating: number | null
  reviewCount: number
  /** 최근 후기 — 단건 조회(GET /providers/:id)에서만 채워짐. 목록에선 생략. */
  reviews?: ProviderReviewDto[]
  createdAt: string
  updatedAt: string
}

export interface ProviderProfileListDto {
  items: ProviderProfileDto[]
  total: number
}

/** 완료 의뢰에 대한 의뢰자의 전문가 평가. 의뢰당 1건. */
export interface ProviderReviewDto {
  id: string
  providerUserId: string
  requestId: string
  requestTitle: string
  reviewerName: string
  rating: number
  comment: string | null
  createdAt: string
}

/** 중계 현황 요약 — 대시보드/운영자 카드. */
export interface BrokerageStatsDto {
  openRequests: number
  inProgressRequests: number
  completedRequests: number
  activeProviders: number
  /** 본인 기준(의뢰자) — 내가 올린 의뢰 수. */
  myRequests: number
  /** 본인 기준(전문가) — 내가 제출한 제안 수. */
  myProposals: number
  /** 의뢰자로서 처리 대기 — 제안이 도착한 모집 의뢰 + 검수 대기(delivered) 수. */
  actionableAsRequester: number
  /** 전문가로서 처리 대기 — 내게 배정돼 시작/납품이 필요한 의뢰(matched·in_progress) 수. */
  actionableAsProvider: number
}

/** 산출물 → 약관 버전 가져오기 결과 — 새로 만든 정책·초안 버전 식별자. */
export interface ImportToPolicyDto {
  policyId: string
  policySlug: string
  policyName: string
  versionId: string
  versionLabel: string
}

/** 통화 표기 도우미 — 견적/예산 표시(KRW). */
export function formatKrw(amount: number | null | undefined): string {
  if (amount == null) return '협의'
  return `₩${amount.toLocaleString('ko-KR')}`
}

/** 예산 범위 표기. */
export function formatBudgetRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '협의'
  if (min != null && max != null)
    return `₩${min.toLocaleString('ko-KR')} ~ ₩${max.toLocaleString('ko-KR')}`
  if (min != null) return `₩${min.toLocaleString('ko-KR')} 이상`
  return `₩${max!.toLocaleString('ko-KR')} 이하`
}
