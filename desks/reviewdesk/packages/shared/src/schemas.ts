import { z } from 'zod'

import {
  MODERATION_ACTIONS,
  PLANS,
  RATING_MAX,
  RATING_MIN,
  REVIEW_AUTHOR_MAX,
  REVIEW_BODY_MAX,
  REVIEW_REPLY_MAX,
  REVIEW_STATUSES,
  REVIEW_TITLE_MAX,
  SLUG_RE,
  SUBJECT_ID_RE,
} from './constants'

/**
 * 사용자 입력 텍스트 살균(sanitize) — 저장 전 위험한 마크업을 무력화한다.
 * - 제어 문자 제거(개행/탭 제외)
 * - `<` `>` 를 엔티티로 치환해 HTML/스크립트 주입 차단(위젯이 textContent 로 렌더하더라도 이중 안전)
 * - 양끝 공백 정리
 * 순수 함수 — api(저장 직전)·테스트가 공유한다.
 */
export function sanitizeText(input: string): string {
  return (
    input
      // C0 제어문자 제거 — 단, 탭/개행/캐리지리턴(\t\n\r)은 보존.
      // 제어문자 매칭이 이 살균기의 본 목적이라 의도적으로 사용한다.
      // eslint-disable-next-line no-control-regex -- 제어문자 제거가 sanitize 의 목적
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

/** subjectId — 리뷰 대상(product/page/entity) 식별자. */
export const subjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(SUBJECT_ID_RE, 'subjectId는 소문자·숫자·하이픈만 가능합니다')

/** 테넌트 slug. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug는 소문자·숫자·하이픈만 가능합니다')

/** 별점 — 정수 1–5. */
export const ratingSchema = z.number().int().min(RATING_MIN).max(RATING_MAX)

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
  /** 자동 승인 여부(true 면 제출 즉시 approved). 기본 false. */
  autoApprove: z.boolean().default(false),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

/** 응답 메타(전부 선택) — 위젯이 보내는 컨텍스트. */
export const reviewMetaSchema = z
  .object({
    pageUrl: z.string().trim().max(2000).optional(),
    userAgent: z.string().trim().max(1000).optional(),
    referrer: z.string().trim().max(2000).optional(),
  })
  .partial()
export type ReviewMeta = z.infer<typeof reviewMetaSchema>

/** 공개 리뷰 제출 입력(publishable 키). status/featured/reply 는 서버가 통제(입력 불가). */
export const submitReviewSchema = z.object({
  subjectId: subjectIdSchema,
  subjectLabel: sanitizedOptional(200),
  rating: ratingSchema,
  title: sanitizedOptional(REVIEW_TITLE_MAX),
  body: sanitizedString(REVIEW_BODY_MAX),
  authorName: sanitizedString(REVIEW_AUTHOR_MAX),
  /** 비공개 — 어드민에게만 노출. */
  authorEmail: z.email().max(320).optional(),
  source: z.string().trim().max(60).optional(),
  meta: reviewMetaSchema.optional(),
})
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>

/** 어드민 검수 입력 — action 별로 필요한 필드가 다르다(superRefine 으로 일관성 강제). */
export const moderateReviewSchema = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    /** reply 액션에서 필수. 빈 문자열이면 답글 삭제로 간주. */
    reply: z.union([z.string().trim().max(REVIEW_REPLY_MAX), z.literal('')]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'reply' && v.reply === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reply'],
        message: 'reply 액션에는 reply 본문이 필요합니다',
      })
    }
  })
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>

/** 어드민 테넌트 설정 수정 입력(부분 갱신). 키/usage 는 여기서 못 바꾼다. */
export const updateTenantSchema = z
  .object({
    name: sanitizedString(120).optional(),
    corsOrigins: z.array(corsOriginSchema).max(50).optional(),
    autoApprove: z.boolean().optional(),
    plan: z.enum(PLANS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

/** 어드민 리뷰 목록 필터(쿼리). */
export const adminReviewQuerySchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional(),
  subjectId: subjectIdSchema.optional(),
  featured: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>
