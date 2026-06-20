import { z } from 'zod'

import {
  ANON_ID_MAX,
  BODY_MAX,
  CATEGORY_MAX,
  ENTRY_TAGS,
  PLANS,
  SLUG_RE,
  TITLE_MAX,
  VERSION_MAX,
} from './constants'

/** 테넌트 slug — 공개 URL·식별자(소문자·숫자·하이픈). */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug 는 소문자·숫자·하이픈만 가능합니다')

/** Origin 한 개 — 스킴+호스트(+포트) 또는 와일드카드 '*'. */
export const originSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (v) => v === '*' || /^https?:\/\/[^/]+$/.test(v),
    "origin 은 '*' 또는 http(s)://호스트[:포트] 형식이어야 합니다"
  )

/** corsOrigins 배열(최대 50개, 중복 제거). */
export const corsOriginsSchema = z
  .array(originSchema)
  .max(50)
  .transform((arr) => Array.from(new Set(arr)))

// ── 테넌트 ──────────────────────────────────────────────────────────────────

/** 외부 온보딩 — 셀프서브 가입 입력. slug 미지정 시 name 에서 파생. */
export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  /** 위젯을 임베드할 사이트 origin 화이트리스트(가입 시점). 비우면 가입 후 설정. */
  corsOrigins: corsOriginsSchema.optional(),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

/** 어드민 테넌트 설정 변경 — cors 와 plan. */
export const updateTenantSchema = z
  .object({
    corsOrigins: corsOriginsSchema.optional(),
    plan: z.enum(PLANS).optional(),
  })
  .refine((v) => v.corsOrigins !== undefined || v.plan !== undefined, {
    message: 'corsOrigins 또는 plan 중 하나는 있어야 합니다',
  })
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

// ── 체인지로그 항목 ──────────────────────────────────────────────────────────

/** 어드민 항목 생성 입력. publishedAt 미지정 + isPublished=true 면 서버가 now() 로 채운다. */
export const createEntrySchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX),
  bodyMarkdown: z.string().max(BODY_MAX).default(''),
  tag: z.enum(ENTRY_TAGS),
  version: z
    .union([z.string().trim().max(VERSION_MAX), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  category: z
    .union([z.string().trim().max(CATEGORY_MAX), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  isPublished: z.boolean().default(false),
  /** ISO 문자열 — 미지정 시 게시 시점에 서버가 채운다. */
  publishedAt: z
    .union([z.iso.datetime(), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
})
export type CreateEntryInput = z.infer<typeof createEntrySchema>

/** 어드민 항목 수정 입력 — 모든 필드 선택(부분 갱신). */
export const updateEntrySchema = z
  .object({
    title: z.string().trim().min(1).max(TITLE_MAX).optional(),
    bodyMarkdown: z.string().max(BODY_MAX).optional(),
    tag: z.enum(ENTRY_TAGS).optional(),
    version: z
      .union([z.string().trim().max(VERSION_MAX), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
    category: z
      .union([z.string().trim().max(CATEGORY_MAX), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
    isPublished: z.boolean().optional(),
    publishedAt: z
      .union([z.iso.datetime(), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '수정할 필드가 1개 이상 필요합니다' })
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>

// ── 공개(위젯) ──────────────────────────────────────────────────────────────

/** 공개 위젯 목록 쿼리 — since(ISO, 증분)·limit. */
export const listEntriesQuerySchema = z.object({
  since: z
    .union([z.iso.datetime(), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>

/** 익명 식별자 — 위젯이 생성·저장하는 디바이스 로컬 ID. */
export const anonIdSchema = z.string().trim().min(1).max(ANON_ID_MAX)

/** 마지막 본 항목 기록(미읽음 배지) — 공개(pk). */
export const seenSchema = z.object({
  anonId: anonIdSchema,
  /** 마지막으로 본 항목 id(UUID). 없으면 '전부 읽음' 처리(현재 최신 기준). */
  lastSeenEntryId: z.uuid().optional(),
})
export type SeenInput = z.infer<typeof seenSchema>
