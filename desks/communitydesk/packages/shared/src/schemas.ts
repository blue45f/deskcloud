import { z } from 'zod'

import {
  AUTHOR_NAME_MAX,
  BOARD_DESC_MAX,
  BOARD_KINDS,
  BOARD_NAME_MAX,
  COMMENT_BODY_MAX,
  COMMENT_MODERATION_ACTIONS,
  CONTENT_STATUSES,
  MEMBER_ID_RE,
  PLANS,
  POST_BODY_MAX,
  POST_MODERATION_ACTIONS,
  POST_SORTS,
  POST_TITLE_MAX,
  REACTION_KINDS,
  REACTION_TARGETS,
  SLUG_RE,
  TAG_MAX,
  TAGS_MAX,
} from './constants'
import { sanitizeText } from './markdown'

/** 위험 제어문자만 제거하는 1줄 살균(제목·이름 등). HTML 은 렌더 시점에 별도 처리. */
const cleanLine = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((v) => sanitizeText(v).replace(/\n+/g, ' '))

const cleanLineOptional = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.null()])
    .transform((v) => (v ? sanitizeText(v).replace(/\n+/g, ' ') : undefined))
    .optional()

/** 게시판 slug. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug는 소문자·숫자·하이픈만 가능합니다')

/** 멤버 식별자(호스트 앱이 보증) — 익명도 anon:xxxx 형태로 넘어올 수 있음. */
export const memberIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(MEMBER_ID_RE, 'memberId는 영숫자·._:- 만 가능합니다')

/** 태그 한 건 — 소문자/숫자/한글/하이픈, 공백 없음. */
export const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAG_MAX)
  .transform((v) => sanitizeText(v).replace(/\s+/g, '-').toLowerCase())

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

// ── 테넌트 ────────────────────────────────────────────────────────────────────

/** 테넌트 셀프 가입 입력. */
export const createTenantSchema = z.object({
  name: cleanLine(120),
  /** 미지정 시 서버가 name 으로 slug 자동 생성. */
  slug: slugSchema.optional(),
  /** 허용 오리진(없으면 빈 목록 → 공개 엔드포인트는 Origin 없는 호출만 통과). */
  corsOrigins: z.array(corsOriginSchema).max(50).default([]),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

/** 어드민 테넌트 설정 수정 입력(부분 갱신). 키/usage 는 여기서 못 바꾼다. */
export const updateTenantSchema = z
  .object({
    name: cleanLine(120).optional(),
    corsOrigins: z.array(corsOriginSchema).max(50).optional(),
    plan: z.enum(PLANS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

// ── 게시판 / 카페 ─────────────────────────────────────────────────────────────

/** 게시판 생성 입력(어드민). */
export const createBoardSchema = z.object({
  slug: slugSchema,
  name: cleanLine(BOARD_NAME_MAX),
  description: cleanLineOptional(BOARD_DESC_MAX),
  kind: z.enum(BOARD_KINDS).default('board'),
})
export type CreateBoardInput = z.infer<typeof createBoardSchema>

/** 게시판 수정 입력(어드민, 부분 갱신). slug 는 불변. */
export const updateBoardSchema = z
  .object({
    name: cleanLine(BOARD_NAME_MAX).optional(),
    description: cleanLineOptional(BOARD_DESC_MAX),
    kind: z.enum(BOARD_KINDS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>

// ── 글 / 댓글 ─────────────────────────────────────────────────────────────────

/** 공개 글 작성 입력(publishable). status/pinned/locked 는 서버 통제(입력 불가). */
export const createPostSchema = z.object({
  /** 대상 게시판 slug. */
  boardSlug: slugSchema,
  authorMemberId: memberIdSchema,
  authorName: cleanLine(AUTHOR_NAME_MAX),
  title: cleanLineOptional(POST_TITLE_MAX),
  /** 마크다운 원문 — 서버가 살균 HTML(bodyHtml)로 변환해 함께 저장. */
  body: z.string().trim().min(1).max(POST_BODY_MAX),
  tags: z.array(tagSchema).max(TAGS_MAX).default([]),
})
export type CreatePostInput = z.infer<typeof createPostSchema>

/** 공개 댓글 작성 입력(publishable). parentId 로 중첩. */
export const createCommentSchema = z.object({
  authorMemberId: memberIdSchema,
  authorName: cleanLine(AUTHOR_NAME_MAX),
  body: z.string().trim().min(1).max(COMMENT_BODY_MAX),
  /** 상위 댓글 id(없으면 최상위). */
  parentId: z.uuid().optional(),
})
export type CreateCommentInput = z.infer<typeof createCommentSchema>

/**
 * 방문 핑 입력(publishable). 호스트 앱/위젯이 글을 열지 않아도 페이지뷰를 1회 기록한다.
 * memberId 가 있으면 그날 고유 방문자 중복 제거에 쓰인다(없으면 트래픽만 +1).
 */
export const trackVisitSchema = z.object({
  memberId: memberIdSchema.optional(),
})
export type TrackVisitInput = z.infer<typeof trackVisitSchema>

/** 반응 토글 입력(publishable). 같은 멤버가 같은 kind 재요청 시 해제. */
export const toggleReactionSchema = z.object({
  targetType: z.enum(REACTION_TARGETS),
  targetId: z.uuid(),
  memberId: memberIdSchema,
  kind: z.enum(REACTION_KINDS),
})
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>

// ── 어드민 운영 / 목록 ────────────────────────────────────────────────────────

/** 글 운영 입력(어드민). */
export const moderatePostSchema = z.object({
  action: z.enum(POST_MODERATION_ACTIONS),
})
export type ModeratePostInput = z.infer<typeof moderatePostSchema>

/** 댓글 운영 입력(어드민). */
export const moderateCommentSchema = z.object({
  action: z.enum(COMMENT_MODERATION_ACTIONS),
})
export type ModerateCommentInput = z.infer<typeof moderateCommentSchema>

/** 공개 글 목록 쿼리(보드별). */
export const publicPostsQuerySchema = z.object({
  sort: z.enum(POST_SORTS).optional(),
  tag: tagSchema.optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type PublicPostsQuery = z.infer<typeof publicPostsQuerySchema>

/** 어드민 글 목록 필터(쿼리). */
export const adminPostsQuerySchema = z.object({
  boardSlug: slugSchema.optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  tag: tagSchema.optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type AdminPostsQuery = z.infer<typeof adminPostsQuerySchema>
