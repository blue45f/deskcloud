import { z } from 'zod'

import {
  API_KEY_SCOPES,
  CONSENT_DECISIONS,
  CONSENT_METHODS,
  POLICY_TYPES,
  POLICY_VISIBILITIES,
  ROLES,
} from './constants'
import { PLAN_IDS } from './plans'

/** slug: 소문자/숫자/하이픈, 2~64자. URL·API 경로로 쓰입니다. */
export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug은 소문자·숫자·하이픈만 가능합니다')

export const localeSchema = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, '예: ko, en, ko-KR')

// ── 인증 ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginSchema>

/** 셀프서비스 회원가입 — 새 조직 + 첫 소유자(owner)를 생성. */
export const registerSchema = z.object({
  orgName: z.string().min(1).max(120),
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(200),
})
export type RegisterInput = z.infer<typeof registerSchema>

/** Google ID 토큰(GIS)으로 로그인/가입. credential = Google 에서 받은 JWT. */
export const googleAuthSchema = z.object({
  credential: z.string().min(10),
  /** 신규 가입 시 조직명(없으면 이름/이메일에서 유도). */
  orgName: z.string().max(120).optional(),
})
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>

/** 내 프로필 수정 — 이름은 즉시 변경, 이메일·비밀번호 변경은 현재 비밀번호 확인이 필요합니다. */
export const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().min(1).max(200).optional(),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(200).optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined || v.password !== undefined, {
    message: '변경할 항목이 없습니다',
  })
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

/** 내 계정 탈퇴 — 비밀번호 계정은 currentPassword 가 필요합니다. */
export const withdrawAccountSchema = z
  .object({
    currentPassword: z.string().min(1).max(200).optional(),
  })
  .default({})
export type WithdrawAccountInput = z.infer<typeof withdrawAccountSchema>

// ── 정책(문서) ────────────────────────────────────────────────────────────────
export const createPolicySchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(120),
  type: z.enum(POLICY_TYPES),
  jurisdiction: z.string().max(8).default('KR'),
  description: z.string().max(500).optional(),
})
export type CreatePolicyInput = z.infer<typeof createPolicySchema>

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  jurisdiction: z.string().max(8).optional(),
  /** 공개/비공개 — 무인증 공개 렌더 노출 제어(게시·해시 로직 비접촉). */
  visibility: z.enum(POLICY_VISIBILITIES).optional(),
})
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>

// ── 버전 ──────────────────────────────────────────────────────────────────────
export const createVersionSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  locale: localeSchema.default('ko'),
  changeSummary: z.string().max(2000).optional(),
})
export type CreateVersionInput = z.infer<typeof createVersionSchema>

/** 초안(draft) 상태에서만 편집 가능. 게시본은 불변. */
export const updateVersionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  changeSummary: z.string().max(2000).optional(),
})
export type UpdateVersionInput = z.infer<typeof updateVersionSchema>

export const publishVersionSchema = z.object({
  /** 발효일. 미래면 'scheduled'(예약 게시), 과거/현재면 즉시 'published'. */
  effectiveAt: z.string().datetime().optional(),
  /** 사용자에게 불리하거나 중대한 변경 → 재동의 요구. (자동 판단이 아니라 게시자가 명시) */
  requiresReconsent: z.boolean().default(false),
  changeSummary: z.string().max(2000).optional(),
})
export type PublishVersionInput = z.infer<typeof publishVersionSchema>

// ── 동의 영수증 ────────────────────────────────────────────────────────────────
export const consentEvidenceSchema = z
  .object({
    ip: z.string().max(64).optional(),
    userAgent: z.string().max(512).optional(),
    referrer: z.string().max(512).optional(),
    buttonLabel: z.string().max(200).optional(),
    widgetVersion: z.string().max(40).optional(),
    /** 클라이언트가 본 본문의 해시 — 서버 게시본 해시와 대조해 위·변조 탐지 */
    renderedHashEcho: z.string().max(64).optional(),
  })
  .passthrough()
export type ConsentEvidence = z.infer<typeof consentEvidenceSchema>

export const recordConsentSchema = z.object({
  /** 끝단 사용자의 불투명 식별자. 원본 PII를 절대 받지 않습니다(고객이 보관). */
  subjectRef: z.string().min(1).max(200),
  policySlug: slugSchema,
  decision: z.enum(CONSENT_DECISIONS).default('accepted'),
  method: z.enum(CONSENT_METHODS).default('checkbox_clickwrap'),
  locale: localeSchema.default('ko'),
  /** 동의 대상 버전 해시(SDK가 보유). 누락 시 서버가 현재 게시본으로 채움. */
  contentHash: z.string().max(64).optional(),
  evidence: consentEvidenceSchema.optional(),
})
export type RecordConsentInput = z.infer<typeof recordConsentSchema>

// ── API 키 ────────────────────────────────────────────────────────────────────
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).default(['read:current', 'write:consent']),
})
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>

// ── 멤버 ──────────────────────────────────────────────────────────────────────
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  role: z.enum(ROLES).default('viewer'),
  password: z.string().min(8).max(200),
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

// ── 조직 ──────────────────────────────────────────────────────────────────────
/** 조직 로고 URL — 공개 페이지에 그대로 출력되므로 http(s)만 허용(data:·javascript: 차단). */
export const orgLogoUrlSchema = z
  .url({ protocol: /^https?$/, error: '로고는 http(s) URL만 허용됩니다' })
  .max(2048)

export const updateOrgSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    /** 빈 문자열·null → 로고 제거, 미전달(undefined) → 변경 없음. */
    logoUrl: z
      .union([orgLogoUrlSchema, z.literal(''), z.null()])
      .transform((v) => (v === '' ? null : v))
      .optional(),
  })
  .refine((v) => v.name !== undefined || v.logoUrl !== undefined, {
    message: '변경할 항목이 없습니다',
  })
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>

export const updateMemberSchema = z.object({
  role: z.enum(ROLES),
})
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

/** 플랜 변경(mock 청구) — 결정 기록만 남기며 실제 결제가 없습니다. */
export const updateOrgPlanSchema = z.object({
  plan: z.enum(PLAN_IDS),
})
export type UpdateOrgPlanInput = z.infer<typeof updateOrgPlanSchema>
