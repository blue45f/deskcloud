/**
 * Zod 스키마 — 요청 바디/쿼리 검증의 단일 소스. api(ZodValidationPipe)·web 폼이 공유한다.
 * z.infer 로 입력 타입을 파생한다(중복 정의 금지).
 */
import { z } from 'zod'

import {
  FOLDER_RE,
  PLANS,
  SLUG_RE,
  TRANSFORM_FORMATS,
  TRANSFORM_MAX_DIM,
  TRANSFORM_MIN_DIM,
  TRANSFORM_QUALITY_MAX,
  TRANSFORM_QUALITY_MIN,
} from './constants'

/** 가입(self-register) — 테넌트 이름(+선택 slug·CORS·플랜). slug 미지정 시 서버가 name 으로 생성. */
export const signupSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요').max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, 'slug 는 소문자/숫자/하이픈만 가능합니다')
    .min(1)
    .max(64)
    .optional(),
  plan: z.enum(PLANS).optional(),
  corsOrigins: z.array(z.string().trim().min(1)).max(20).optional(),
})
export type SignupInput = z.infer<typeof signupSchema>

/** 테넌트 설정 변경(어드민) — CORS 허용목록·플랜. */
export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    plan: z.enum(PLANS).optional(),
    corsOrigins: z.array(z.string().trim().min(1)).max(20).optional(),
  })
  .refine((v) => v.name !== undefined || v.plan !== undefined || v.corsOrigins !== undefined, {
    message: '변경할 항목이 없습니다',
  })
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

/** 업로드 시 폼 필드(folder) — 멀티파트 본문이라 file 은 인터셉터가 처리, folder 만 검증. */
export const uploadFieldsSchema = z.object({
  folder: z.string().trim().regex(FOLDER_RE, '폴더 형식이 올바르지 않습니다').max(128).optional(),
})
export type UploadFieldsInput = z.infer<typeof uploadFieldsSchema>

const intFromQuery = z.coerce.number().int()

/** 자산 목록 쿼리(공개·어드민 공통). */
export const listAssetsQuerySchema = z.object({
  folder: z.string().trim().max(128).optional(),
  limit: intFromQuery.min(1).max(200).optional(),
  offset: intFromQuery.min(0).optional(),
})
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>

/**
 * 방문 핑(공개) — 운영 트래픽 집계용 가벼운 신호. 브라우저가 localStorage 의
 * 'md-visit-YYYY-MM-DD' 플래그로 "오늘 첫 방문인가"만 알려준다(IP/쿠키 저장 없음).
 * 서버는 이를 advisory 로만 취급하고 hits 는 항상 +1, visitors 는 newToday 일 때만 +1.
 */
export const visitPingSchema = z.object({
  newToday: z.boolean().optional().default(false),
})
export type VisitPingInput = z.infer<typeof visitPingSchema>

/** 온더플라이 변환 쿼리(?w=&h=&format=&q=). 잘못된 값은 검증에서 걸러지거나 무시된다. */
export const transformQuerySchema = z.object({
  w: intFromQuery.min(TRANSFORM_MIN_DIM).max(TRANSFORM_MAX_DIM).optional(),
  h: intFromQuery.min(TRANSFORM_MIN_DIM).max(TRANSFORM_MAX_DIM).optional(),
  format: z.enum(TRANSFORM_FORMATS).optional(),
  q: intFromQuery.min(TRANSFORM_QUALITY_MIN).max(TRANSFORM_QUALITY_MAX).optional(),
})
export type TransformQuery = z.infer<typeof transformQuerySchema>
