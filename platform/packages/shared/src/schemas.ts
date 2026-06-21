import { z } from 'zod'

import {
  INQUIRY_CATEGORIES,
  INQUIRY_LIST_MAX_LIMIT,
  INQUIRY_STATUSES,
  MEMBER_ROLES,
  PLANS,
  SLUG_RE,
  USAGE_METRICS,
  USAGE_PERIOD_RE,
} from './constants'

/** 테넌트 slug — 소문자·숫자·하이픈. URL·식별 키로 쓰인다. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug는 소문자·숫자·하이픈만 가능합니다')

/** CORS origin — 정확한 origin(scheme+host[:port]) 또는 와일드카드 '*'. */
export const corsOriginSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (v) => v === '*' || /^https?:\/\/[^/\s]+$/.test(v),
    "origin은 'https://host[:port]' 형식이거나 '*' 여야 합니다"
  )

/** 가입(테넌트 생성) 입력 — slug 는 선택(미지정 시 name 에서 파생). plan 은 선택(기본 free). */
export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  plan: z.enum(PLANS).optional(),
  corsOrigins: z.array(corsOriginSchema).max(50).optional(),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

/** 테넌트 수정 — name·corsOrigins 만(plan 변경은 빌링 경로, 키 회전은 별도 엔드포인트). */
export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    corsOrigins: z.array(corsOriginSchema).max(50).optional(),
  })
  .refine((v) => v.name !== undefined || v.corsOrigins !== undefined, {
    message: 'name 또는 corsOrigins 중 최소 하나는 있어야 합니다',
  })
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

/** 멤버(좌석) 초대 입력. */
export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(MEMBER_ROLES).optional(),
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

/** 사용량 기록 입력(내부/SDK용) — metric + 증가량(기본 1). */
export const recordUsageSchema = z.object({
  metric: z.enum(USAGE_METRICS),
  n: z.number().int().min(1).max(1_000_000).optional(),
})
export type RecordUsageInput = z.infer<typeof recordUsageSchema>

/** 사용량 조회 기간 — 'current'(이번 달) 또는 'YYYY-MM'. */
export const usagePeriodSchema = z
  .string()
  .trim()
  .refine(
    (v) => v === 'current' || USAGE_PERIOD_RE.test(v),
    "기간은 'current' 또는 'YYYY-MM' 형식이어야 합니다"
  )
export type UsagePeriod = z.infer<typeof usagePeriodSchema>

/**
 * 문의 제출 입력 — 형제 앱이 공개 API 로 그대로 POST 한다(SDK 불필요).
 * `website` 는 허니팟: 봇이 채우는 미끼 필드로, 비어 있어야 통과한다(사람은 보이지 않음).
 */
export const submitInquirySchema = z.object({
  category: z.enum(INQUIRY_CATEGORIES),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
  contactEmail: z.string().trim().toLowerCase().email().max(255).optional(),
  authorName: z.string().trim().min(1).max(80).optional(),
  originUrl: z.string().trim().url().max(2048).optional(),
  /** 허니팟 — 반드시 비어 있어야 한다(채워져 오면 봇으로 간주). */
  website: z.string().max(0, '허니팟 필드는 비어 있어야 합니다').optional().or(z.literal('')),
})
export type SubmitInquiryInput = z.infer<typeof submitInquirySchema>

/** 문의 목록 페이지네이션 쿼리 — limit(1..50, 기본 20) · offset(≥0, 기본 0). */
export const inquiryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(INQUIRY_LIST_MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  /** 어드민 목록 한정 — 상태로 필터(미지정 시 전체). */
  status: z.enum(INQUIRY_STATUSES).optional(),
})
export type InquiryListQuery = z.infer<typeof inquiryListQuerySchema>

/** 문의 상태 변경 입력(어드민 트리아지). */
export const updateInquiryStatusSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
})
export type UpdateInquiryStatusInput = z.infer<typeof updateInquiryStatusSchema>

/**
 * 방문 핑 입력 — 형제 앱이 첫 로드 시 공개 API 로 그대로 POST 한다(SDK 불필요).
 * 본문은 전부 선택: `newVisitor` 가 true 면 고유 방문자도 +1 한다(브라우저 최초 방문).
 * 클라이언트가 일별·세션별 디바운스를 책임지고, 서버는 IP 스로틀로 폭주만 막는다.
 */
export const visitPingSchema = z
  .object({
    /** 이 브라우저의 최초 방문이면 true — 고유 방문자(uniques)도 함께 증가. */
    newVisitor: z.boolean().optional(),
  })
  .optional()
  .default({})
export type VisitPingInput = z.infer<typeof visitPingSchema>
