import { z } from 'zod'

import {
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
  .refine((v) => v === 'current' || USAGE_PERIOD_RE.test(v), "기간은 'current' 또는 'YYYY-MM' 형식이어야 합니다")
export type UsagePeriod = z.infer<typeof usagePeriodSchema>
