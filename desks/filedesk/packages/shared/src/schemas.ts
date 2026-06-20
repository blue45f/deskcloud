import { z } from 'zod'

import {
  CONTENT_TYPE_MAX,
  DEFAULT_SIGNED_URL_TTL_SEC,
  FILENAME_MAX,
  PLANS,
  SLUG_RE,
  VISIBILITIES,
} from './constants'

/** 테넌트 slug — 외부 식별자(소문자·숫자·하이픈). */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug는 소문자·숫자·하이픈만 가능합니다')

/** 요금제 열거. */
export const planSchema = z.enum(PLANS)

/** 가시성 열거. */
export const visibilitySchema = z.enum(VISIBILITIES)

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
  /** publishable 호출을 허용할 origin 목록. 미지정 시 ['*'](개발 편의). */
  corsOrigins: z.array(corsOriginSchema).max(50).optional(),
  /** 가입 시 요금제(기본 free). */
  plan: planSchema.optional(),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

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

// ── 파일 업로드 ───────────────────────────────────────────────────────────────

/** 파일명 — 경로 구분자 금지(디렉터리 탈출 방지), 1~255자. */
export const filenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(FILENAME_MAX)
  .refine((v) => !v.includes('/') && !v.includes('\\') && v !== '.' && v !== '..', {
    message: '파일명에 경로 구분자(/ \\)를 쓸 수 없습니다',
  })

/** MIME 타입 문자열(상세 검증은 validateUpload 가 담당). */
export const contentTypeSchema = z.string().trim().min(1).max(CONTENT_TYPE_MAX)

/**
 * base64 JSON 업로드 입력 — multipart 대안.
 * `dataBase64` 는 표준/URL-safe base64(접두 data:URL 은 컨트롤러에서 분리).
 */
export const uploadJsonSchema = z.object({
  filename: filenameSchema,
  contentType: contentTypeSchema,
  /** base64 인코딩된 파일 바이트. data:URL 접두는 서버가 허용·분리. */
  dataBase64: z.string().min(1, '파일 데이터가 비어 있습니다'),
  /** 가시성(기본 public). */
  visibility: visibilitySchema.optional(),
})
export type UploadJsonInput = z.infer<typeof uploadJsonSchema>

/**
 * multipart 업로드의 동반 필드(가시성 등). 파일 바이트는 multipart 파트에서 온다.
 * 폼 필드는 문자열로 오므로 visibility 만 검증한다.
 */
export const uploadMultipartFieldsSchema = z.object({
  visibility: visibilitySchema.optional(),
})
export type UploadMultipartFields = z.infer<typeof uploadMultipartFieldsSchema>

// ── 파일 목록(어드민) ─────────────────────────────────────────────────────────

const positiveIntString = z.string().trim().regex(/^\d+$/, '정수여야 합니다').optional()

/** 파일 목록 쿼리(어드민) — 페이지네이션 + 가시성 필터. */
export const listFilesQuerySchema = z.object({
  limit: positiveIntString,
  offset: positiveIntString,
  visibility: visibilitySchema.optional(),
})
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>

// ── 서명 URL(private 파일 한시 접근) ──────────────────────────────────────────

/** 서명 토큰 발급 입력 — 만료(초) 선택. */
export const signUrlSchema = z.object({
  /** 만료까지 초(기본 300, 최대 24h). */
  expiresInSec: z.number().int().min(10).max(86_400).optional().default(DEFAULT_SIGNED_URL_TTL_SEC),
})
export type SignUrlInput = z.infer<typeof signUrlSchema>

// ── 방문 핑(공개 트래픽 집계) ──────────────────────────────────────────────────

/**
 * 방문 핑 입력 — 브라우저가 localStorage 에 보관한 무작위 clientId 만 보낸다.
 * 서버는 이를 페퍼와 함께 SHA-256 해시해 '브라우저/일' 단위 고유 방문자만 식별한다.
 * IP·PII 는 저장하지 않는다(프라이버시 안전, 정직한 고유 방문자 집계).
 */
export const visitPingSchema = z.object({
  /** 브라우저가 1회 생성해 localStorage 에 보관하는 무작위 식별자(UUID 등). */
  clientId: z.string().trim().min(8).max(200),
})
export type VisitPingInput = z.infer<typeof visitPingSchema>

/**
 * 운영 현황(공개 집계) 응답 스키마 — 크로스 테넌트 합계만(테넌트 이름·키 절대 미포함).
 * 인증 없이 노출해도 안전하도록 카운터(숫자)만 담는다.
 */
export const statsOverviewSchema = z.object({
  /** 총 가입 수 — tenants 행 개수(실데이터). */
  totalSignups: z.number().int().min(0),
  /** 오늘 신규 가입자 수 — created_at 이 오늘인 tenants(실데이터). */
  todaySignups: z.number().int().min(0),
  /** 총 트래픽 — 누적 페이지뷰 합계(방문 핑 기반). */
  totalTraffic: z.number().int().min(0),
  /** 오늘 방문자 수 — 오늘의 고유 브라우저 수(방문 핑 기반). */
  todayVisitors: z.number().int().min(0),
})
export type StatsOverviewDto = z.infer<typeof statsOverviewSchema>
