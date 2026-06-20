import { z } from 'zod'

import {
  BODY_MAX,
  CATEGORY_MAX,
  DOC_ID_RE,
  INDEX_NAME_RE,
  MAX_TAGS,
  PLANS,
  SLUG_RE,
  TAG_MAX,
  TITLE_MAX,
  URL_MAX,
} from './constants'

/** 테넌트 slug — 외부 식별자(소문자·숫자·하이픈). */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug는 소문자·숫자·하이픈만 가능합니다')

/** 인덱스 이름 — 테넌트 내 문서 묶음. */
export const indexNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(INDEX_NAME_RE, '인덱스 이름은 영숫자·._- 만 가능합니다')

/** 문서 id — 테넌트 지정 안정적 식별자(upsert 키). */
export const docIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(DOC_ID_RE, '문서 id는 영숫자·._:- 만 가능합니다')

/** 요금제 열거. */
export const planSchema = z.enum(PLANS)

/** 태그 — 자유 문자열(소문자 정규화는 호출 측). */
export const tagSchema = z.string().trim().min(1).max(TAG_MAX)

/**
 * CORS origin 패턴 — publishable 키로 호출 가능한 출처 허용목록.
 * `*`(전체 허용) 또는 스킴 포함 origin(`https://app.example.com`).
 */
export const corsOriginSchema = z.union([
  z.literal('*'),
  z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/[^/]+$/i, 'origin은 http(s)://host 형식이어야 합니다'),
])

// ── 테넌트 가입(signup) ──────────────────────────────────────────────────────

/** 테넌트 셀프 가입 입력 — name 필수, slug/cors/plan 선택. */
export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** 미지정 시 서버가 name 으로부터 생성. */
  slug: slugSchema.optional(),
  /** publishable(검색) 호출을 허용할 origin 목록. 미지정 시 ['*'](개발 편의). */
  corsOrigins: z.array(corsOriginSchema).max(50).optional(),
  /** 가입 시 요금제(기본 free). */
  plan: planSchema.optional(),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

// ── 문서 색인(index/upsert) ──────────────────────────────────────────────────

/**
 * 색인 대상 단일 문서 — title/body 가 전문 검색 대상.
 * category(패싯, 단일) · tags(패싯, 다중) · attrs(임의 구조화 메타, 검색 비대상).
 */
export const documentInputSchema = z.object({
  id: docIdSchema,
  /** 미지정 시 'default' 인덱스로. */
  index: indexNameSchema.optional(),
  title: z.string().trim().min(1).max(TITLE_MAX),
  /** 본문(검색 대상). 빈 문자열 허용(제목만으로도 색인 가능). */
  body: z
    .union([z.string().max(BODY_MAX), z.null()])
    .transform((v) => (v ?? '').trim())
    .optional(),
  /** 결과 클릭 시 이동할 URL(선택). */
  url: z
    .union([z.string().trim().max(URL_MAX), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  /** 패싯/필터용 단일 카테고리(선택). */
  category: z
    .union([z.string().trim().max(CATEGORY_MAX), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  /** 패싯/필터용 태그 목록(선택). 중복 제거. */
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS)
    .transform((arr) => [...new Set(arr)])
    .optional(),
  /** 임의 구조화 메타데이터(검색 비대상, 결과에 그대로 동봉). */
  attrs: z.record(z.string(), z.unknown()).optional(),
})
export type DocumentInput = z.infer<typeof documentInputSchema>

/**
 * 색인 요청 — 단건(document) 또는 배치(documents[]). 둘 중 하나는 있어야 함.
 * 같은 (index, id) 는 upsert(덮어쓰기)된다.
 */
export const upsertDocumentsSchema = z
  .object({
    /** 단건 색인. */
    document: documentInputSchema.optional(),
    /** 배치 색인(최대 200). */
    documents: z.array(documentInputSchema).max(200).optional(),
  })
  .refine((v) => Boolean(v.document) || (v.documents != null && v.documents.length > 0), {
    message: 'document 또는 documents(1개 이상) 가 필요합니다',
    path: ['documents'],
  })
export type UpsertDocumentsInput = z.infer<typeof upsertDocumentsSchema>

// ── 검색(search) — publishable ────────────────────────────────────────────────

/** 쉼표 구분 문자열 또는 배열을 문자열 배열로 정규화(쿼리스트링 친화). */
const csvOrArray = z
  .union([z.string(), z.array(z.string())])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(','))
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  )

/**
 * 검색 쿼리 — 쿼리스트링 기반(모두 문자열로 들어옴).
 * q(검색어) · index · category(단일 필터) · tags(AND 필터) · limit.
 */
export const searchQuerySchema = z.object({
  /** 검색어. 빈 문자열이면 매치 없음(결과 0건 + 패싯만). */
  q: z.string().trim().max(500).optional().default(''),
  /** 검색 대상 인덱스(미지정 시 'default'). */
  index: indexNameSchema.optional(),
  /** 단일 카테고리 필터(선택). */
  category: z.string().trim().max(CATEGORY_MAX).optional(),
  /** 태그 AND 필터(쉼표 구분 또는 반복 파라미터). */
  tags: csvOrArray.optional(),
  /** 결과 개수(서버가 SEARCH_MAX_LIMIT 로 클램프). */
  limit: z.coerce.number().int().min(1).optional(),
})
export type SearchQueryInput = z.infer<typeof searchQuerySchema>

// ── 어드민: 테넌트 갱신 ──────────────────────────────────────────────────────

/** 테넌트 설정 갱신(어드민) — 이름·CORS·요금제. */
export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    corsOrigins: z.array(corsOriginSchema).max(50).optional(),
    plan: planSchema.optional(),
  })
  .refine((v) => v.name != null || v.corsOrigins != null || v.plan != null, {
    message: '갱신할 필드가 하나 이상 필요합니다',
  })
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>
