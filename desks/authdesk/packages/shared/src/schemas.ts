import { z } from 'zod'

import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, PLANS, SLUG_RE } from './constants'
import { validatePassword } from './password'

/* ──────────────────────────────────────────────────────────────────────────
   테넌트(앱) 가입 — pk_/sk_ 키를 발급받는 멀티테넌트 루트. end-user 와 구분.
   ────────────────────────────────────────────────────────────────────────── */

/** slug — 테넌트 식별 슬러그(소문자·숫자·하이픈). */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug 는 소문자·숫자·하이픈만 가능합니다')

/** CORS allowlist origin — http(s) origin 형태(경로/쿼리 없이). */
export const originSchema = z
  .string()
  .trim()
  .max(255)
  .regex(/^https?:\/\/[^/\s]+$/, 'origin 은 http(s)://host[:port] 형태여야 합니다')

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  plan: z.enum(PLANS).default('free'),
  /** 공개 위젯 요청을 허용할 Origin allowlist(비면 가입 후 키 추가). */
  corsOrigins: z.array(originSchema).max(50).default([]),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    corsOrigins: z.array(originSchema).max(50).optional(),
  })
  .refine((v) => v.name !== undefined || v.corsOrigins !== undefined, {
    message: 'name 또는 corsOrigins 중 하나는 있어야 합니다',
  })
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>

/* ──────────────────────────────────────────────────────────────────────────
   end-user 인증 — 테넌트 풀의 최종 사용자. publishable 키 + CORS 로 보호되는 공개 경로.
   ────────────────────────────────────────────────────────────────────────── */

/** 이메일 — 320자 이내. 정규화(소문자화)는 서비스가 normalizeEmail 로 수행. */
export const emailSchema = z.email('유효한 이메일이 아닙니다').max(320)

/** 비밀번호 — 정책(길이·문자 다양성)은 공유 validatePassword 로 강제. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `비밀번호는 최소 ${PASSWORD_MIN}자 이상이어야 합니다`)
  .max(PASSWORD_MAX, `비밀번호는 최대 ${PASSWORD_MAX}자 이하여야 합니다`)
  .superRefine((pw, ctx) => {
    const result = validatePassword(pw)
    if (!result.ok) {
      for (const reason of result.reasons) ctx.addIssue({ code: 'custom', message: reason })
    }
  })

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(NAME_MAX),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: emailSchema,
  // 로그인은 정책 재검증 없이 형태만(이미 가입 시 통과). 길이 상한만 둔다(DoS 방지).
  password: z.string().min(1).max(PASSWORD_MAX),
})
export type LoginInput = z.infer<typeof loginSchema>

/* ──────────────────────────────────────────────────────────────────────────
   트래픽 핑 — 위젯/대시보드가 publishable 키로 쏘는 공개 방문 집계(POST /auth/visit).
   ────────────────────────────────────────────────────────────────────────── */

/** 방문 핑 본문 — 선택적 vid(클라이언트 localStorage 의 방문자 id, 고유 방문자 근사용). */
export const visitSchema = z.object({
  /** 클라이언트 생성 방문자 id(고유 방문자 추정용). 없으면 IP 로 폴백. */
  vid: z.string().trim().min(1).max(128).optional(),
})
export type VisitInput = z.infer<typeof visitSchema>

/** 어드민 사용자 목록 페이지네이션 쿼리. */
export const userListQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  /** 이메일 부분 검색(선택). */
  q: z.string().trim().max(320).optional(),
})
export type UserListQuery = z.infer<typeof userListQuerySchema>
