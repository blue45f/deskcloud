import { z } from 'zod'

import {
  MODERATE_TEXT_MAX,
  PLANS,
  REPORT_NOTES_MAX,
  REPORT_REASON_MAX,
  REPORT_STATUSES,
  REPORTER_ID_MAX,
  RULE_ACTIONS,
  RULE_KINDS,
  RULE_LABEL_MAX,
  RULE_PATTERN_MAX,
  SLUG_RE,
  SUBJECT_ID_MAX,
  SUBJECT_TYPE_MAX,
} from './constants'

/**
 * 사용자 입력 텍스트 살균(sanitize) — 저장·표시 전 위험한 마크업을 무력화한다.
 * - 제어 문자 제거(개행/탭 제외)
 * - `<` `>` 를 엔티티로 치환해 HTML/스크립트 주입 차단(이중 안전)
 * - 양끝 공백 정리
 * 순수 함수 — api(저장 직전)·테스트가 공유한다.
 */
export function sanitizeText(input: string): string {
  return (
    input
      // C0 제어문자 제거 — 단, 탭/개행/캐리지리턴(\t\n\r)은 보존.
      // 제어문자 매칭이 이 살균기의 목적이므로 no-control-regex 는 의도적으로 비활성한다.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim()
  )
}

/** Zod transform 으로 살균을 적용하는 헬퍼(길이 제한은 살균 전 원문 기준). */
const sanitizedString = (max: number) => z.string().trim().min(1).max(max).transform(sanitizeText)

const sanitizedOptional = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.null()])
    .transform((v) => (v ? sanitizeText(v) : undefined))
    .optional()

/** 테넌트 slug. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug는 소문자·숫자·하이픈만 가능합니다')

/** CORS 허용 오리진 한 건 — `*`(전체) 또는 절대 origin(http/https). */
export const corsOriginSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (v) => v === '*' || /^https?:\/\/[^\s/]+$/i.test(v),
    'origin 은 "*" 또는 http(s)://host 형태여야 합니다'
  )

/** 테넌트 셀프 가입 입력. */
export const createTenantSchema = z.object({
  name: sanitizedString(120),
  /** 미지정 시 서버가 name 으로 slug 자동 생성. */
  slug: slugSchema.optional(),
  /** 허용 오리진(없으면 빈 목록 → 공개 엔드포인트는 Origin 없는 호출만 통과). */
  corsOrigins: z.array(corsOriginSchema).max(50).default([]),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

/** 어드민 테넌트 설정 수정 입력(부분 갱신). 키/usage 는 여기서 못 바꾼다. */
export const updateTenantSchema = z
  .object({
    name: sanitizedString(120).optional(),
    corsOrigins: z.array(corsOriginSchema).max(50).optional(),
    plan: z.enum(PLANS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

/** 모더레이션 컨텍스트 메타(전부 선택) — 호출자가 보내는 부가 정보. */
export const moderateMetaSchema = z
  .object({
    pageUrl: z.string().trim().max(2000).optional(),
    userId: z.string().trim().max(200).optional(),
    source: z.string().trim().max(60).optional(),
  })
  .partial()
export type ModerateMeta = z.infer<typeof moderateMetaSchema>

/** 모더레이션 검사 입력(publishable 또는 secret 키). */
export const moderateSchema = z.object({
  text: sanitizedString(MODERATE_TEXT_MAX),
  /** AI 보조를 강제로 끄려면 false(키가 있어도 규칙만). 기본은 키 존재 시 사용. */
  useAi: z.boolean().optional(),
  meta: moderateMetaSchema.optional(),
})
export type ModerateInput = z.infer<typeof moderateSchema>

/** 금칙 규칙 생성 입력(어드민). */
export const createRuleSchema = z
  .object({
    pattern: z.string().trim().min(1).max(RULE_PATTERN_MAX),
    kind: z.enum(RULE_KINDS).default('substring'),
    action: z.enum(RULE_ACTIONS).default('block'),
    label: sanitizedOptional(RULE_LABEL_MAX),
    enabled: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    // regex 규칙은 컴파일 가능해야 한다(잘못된 정규식 저장 방지).
    if (v.kind === 'regex') {
      try {
        new RegExp(v.pattern, 'iu')
      } catch {
        ctx.addIssue({ code: 'custom', path: ['pattern'], message: '유효한 정규식이 아닙니다' })
      }
    }
  })
export type CreateRuleInput = z.infer<typeof createRuleSchema>

/** 금칙 규칙 수정 입력(부분 갱신). */
export const updateRuleSchema = z
  .object({
    pattern: z.string().trim().min(1).max(RULE_PATTERN_MAX).optional(),
    kind: z.enum(RULE_KINDS).optional(),
    action: z.enum(RULE_ACTIONS).optional(),
    label: sanitizedOptional(RULE_LABEL_MAX),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
  .superRefine((v, ctx) => {
    if (v.kind === 'regex' && v.pattern !== undefined) {
      try {
        new RegExp(v.pattern, 'iu')
      } catch {
        ctx.addIssue({ code: 'custom', path: ['pattern'], message: '유효한 정규식이 아닙니다' })
      }
    }
  })
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>

/** 신고 접수 입력(publishable 키). status/notes 는 서버가 통제(입력 불가). */
export const submitReportSchema = z.object({
  subjectType: z.string().trim().min(1).max(SUBJECT_TYPE_MAX),
  subjectId: z.string().trim().min(1).max(SUBJECT_ID_MAX),
  reason: sanitizedString(REPORT_REASON_MAX),
  reporterId: z.string().trim().max(REPORTER_ID_MAX).optional(),
})
export type SubmitReportInput = z.infer<typeof submitReportSchema>

/** 어드민 신고 갱신 입력 — 상태 전이 그리고/또는 메모. */
export const updateReportSchema = z
  .object({
    status: z.enum(REPORT_STATUSES).optional(),
    notes: sanitizedOptional(REPORT_NOTES_MAX),
  })
  .refine(
    (v) => v.status !== undefined || v.notes !== undefined,
    'status 또는 notes 중 하나는 필요합니다'
  )
export type UpdateReportInput = z.infer<typeof updateReportSchema>

/** 어드민 신고 목록 필터(쿼리). */
export const adminReportQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  subjectType: z.string().trim().max(SUBJECT_TYPE_MAX).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>

/** 어드민 로그 목록 필터(쿼리). */
export const adminLogQuerySchema = z.object({
  verdict: z.enum(['allow', 'flag', 'block']).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type AdminLogQuery = z.infer<typeof adminLogQuerySchema>
