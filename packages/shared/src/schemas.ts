import { z } from 'zod'

import {
  ALLOWED_IMAGE_TYPES,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_STATUSES,
  CREATIVE_ALT_MAX,
  MAX_IMAGE_BYTES,
  PLANS,
  SIZE_DIMENSION_MAX,
  SIZE_RE,
  SLOT_KEY_RE,
  SLOT_LABEL_MAX,
  SLUG_RE,
  WEIGHT_DEFAULT,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type AllowedImageType,
} from './constants'

/**
 * 사용자 입력 텍스트 살균(sanitize) — 저장 전 위험한 마크업을 무력화한다.
 * - 제어 문자 제거(개행/탭 제외)
 * - `<` `>` 를 엔티티로 치환해 HTML/스크립트 주입 차단(위젯이 textContent/속성으로 렌더해도 이중 안전)
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

/**
 * http(s) 절대 URL — imageUrl·linkUrl 에 사용. javascript:/data: 등 비-http 스킴 차단.
 * (data: 이미지는 위젯에서 크기/추적이 어려워 정책상 외부 호스팅 URL 만 허용한다.)
 */
export const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), 'http(s):// 로 시작하는 절대 URL 이어야 합니다')

/** 배너 사이즈("<W>x<H>", px) — 차원 상한 검사 포함. */
export const sizeSchema = z
  .string()
  .trim()
  .regex(SIZE_RE, '사이즈는 "300x250" 형식(px)이어야 합니다')
  .refine((v) => {
    const m = SIZE_RE.exec(v)
    if (!m) return false
    return Number(m[1]) <= SIZE_DIMENSION_MAX && Number(m[2]) <= SIZE_DIMENSION_MAX
  }, `각 차원은 ${SIZE_DIMENSION_MAX}px 이하여야 합니다`)

/** 슬롯 key — 지면 식별자. */
export const slotKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLOT_KEY_RE, 'slot key 는 소문자·숫자·하이픈만 가능합니다')

/** 테넌트 slug. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug 는 소문자·숫자·하이픈만 가능합니다')

/** 가중치 — 정수 1~1000. */
export const weightSchema = z.number().int().min(WEIGHT_MIN).max(WEIGHT_MAX)

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

/* ── 테넌트 ─────────────────────────────────────────────────────────────────── */

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

/* ── 캠페인 ─────────────────────────────────────────────────────────────────── */

/** 캠페인 기간(선택) — startsAt/endsAt 는 ISO 8601 문자열. */
const isoDateTime = z.iso.datetime({ offset: true })

/** 어드민 캠페인 생성 입력. */
export const createCampaignSchema = z
  .object({
    name: sanitizedString(CAMPAIGN_NAME_MAX),
    status: z.enum(CAMPAIGN_STATUSES).default('active'),
    /** 서빙 시작 시각(ISO). 미지정 시 즉시 시작(제약 없음). */
    startsAt: z.union([isoDateTime, z.null()]).optional(),
    /** 서빙 종료 시각(ISO). 미지정 시 무기한. */
    endsAt: z.union([isoDateTime, z.null()]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && new Date(v.startsAt) > new Date(v.endsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt 은 startsAt 이후여야 합니다' })
    }
  })
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>

/** 어드민 캠페인 수정 입력(부분 갱신). */
export const updateCampaignSchema = z
  .object({
    name: sanitizedString(CAMPAIGN_NAME_MAX).optional(),
    status: z.enum(CAMPAIGN_STATUSES).optional(),
    startsAt: z.union([isoDateTime, z.null()]).optional(),
    endsAt: z.union([isoDateTime, z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>

/* ── 크리에이티브 ───────────────────────────────────────────────────────────── */

/** 어드민 크리에이티브 생성 입력. */
export const createCreativeSchema = z.object({
  campaignId: z.uuid(),
  /** 슬롯 key(지면). 이 크리에이티브가 노출될 슬롯. */
  slotKey: slotKeySchema,
  imageUrl: httpUrlSchema,
  linkUrl: httpUrlSchema,
  alt: sanitizedString(CREATIVE_ALT_MAX),
  /** 가중 랜덤 선택의 상대 비중(기본 1). */
  weight: weightSchema.default(WEIGHT_DEFAULT),
})
export type CreateCreativeInput = z.infer<typeof createCreativeSchema>

/** 어드민 크리에이티브 수정 입력(부분 갱신). campaignId 는 이동 금지(불변). */
export const updateCreativeSchema = z
  .object({
    slotKey: slotKeySchema.optional(),
    imageUrl: httpUrlSchema.optional(),
    linkUrl: httpUrlSchema.optional(),
    alt: sanitizedString(CREATIVE_ALT_MAX).optional(),
    weight: weightSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
export type UpdateCreativeInput = z.infer<typeof updateCreativeSchema>

/* ── 이미지 업로드 ──────────────────────────────────────────────────────────── */

/**
 * data: URL 또는 순수 base64 문자열을 {contentType?, base64} 로 분해한다(순수 함수, 브라우저 안전).
 * - `data:image/png;base64,AAAA…` → { contentType: 'image/png', base64: 'AAAA…' }
 * - 순수 base64 → { contentType: null, base64 }
 * 공백은 모두 제거한다(개행 포함 base64 허용).
 */
export function parseImageData(input: string): { contentType: string | null; base64: string } {
  const trimmed = input.trim()
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(trimmed)
  if (m) return { contentType: m[1] || null, base64: (m[3] ?? '').replace(/\s+/g, '') }
  return { contentType: null, base64: trimmed.replace(/\s+/g, '') }
}

/** base64 문자열을 디코딩했을 때의 바이트 수(패딩 고려). 크기 검증용 순수 함수. */
export function base64ByteLength(base64: string): number {
  const len = base64.length
  if (len === 0) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - padding
}

/** base64 인코딩 길이 상한 — 2 MiB 바이트의 base64(+ data: 프리픽스 여유). 1차 방어용 cheap guard. */
const MAX_IMAGE_BASE64_LEN = Math.ceil((MAX_IMAGE_BYTES / 3) * 4) + 256

/**
 * 어드민 이미지 업로드 입력 — contentType + (data: URL 또는 base64).
 * 정확한 크기/형식 검증(바이트 한도·base64 유효성)은 서버(AdsService)가 수행한다.
 */
export const uploadImageSchema = z.object({
  contentType: z
    .string()
    .trim()
    .refine(isAllowedImageType, '지원하지 않는 이미지 형식입니다(png·jpeg·gif·webp·svg)'),
  /** 이미지 바이트(표준 base64 또는 data: URL). */
  data: z.string().trim().min(1).max(MAX_IMAGE_BASE64_LEN, '이미지가 너무 큽니다(최대 2 MiB)'),
  /** 선택 — 원본 파일명(표시/로깅용). */
  filename: sanitizedOptional(200),
})
export type UploadImageInput = z.infer<typeof uploadImageSchema>

/* ── 슬롯 ───────────────────────────────────────────────────────────────────── */

/** 어드민 슬롯 생성 입력. */
export const createSlotSchema = z.object({
  key: slotKeySchema,
  label: sanitizedOptional(SLOT_LABEL_MAX),
  /** 이 슬롯이 받는 배너 사이즈 목록(예: ['300x250']). */
  sizes: z.array(sizeSchema).min(1, '사이즈가 1개 이상 필요합니다').max(20),
})
export type CreateSlotInput = z.infer<typeof createSlotSchema>

/** 어드민 슬롯 수정 입력(부분 갱신). key 는 불변. */
export const updateSlotSchema = z
  .object({
    label: sanitizedOptional(SLOT_LABEL_MAX),
    sizes: z.array(sizeSchema).min(1).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, '수정할 필드가 하나 이상 필요합니다')
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>

/* ── 공개(위젯) 서빙 · 트래킹 ───────────────────────────────────────────────── */

/** 서빙 쿼리 — slot key 로 활성 크리에이티브 1개를 가중 랜덤 선택. */
export const serveQuerySchema = z.object({
  slot: slotKeySchema,
})
export type ServeQuery = z.infer<typeof serveQuerySchema>

/** 노출/클릭 추적 입력 — 위젯이 보내는 최소 정보(어떤 크리에이티브인지). */
export const trackEventSchema = z.object({
  creativeId: z.uuid(),
})
export type TrackEventInput = z.infer<typeof trackEventSchema>

/* ── 이미지 파일 검증(순수 유틸) ─────────────────────────────────────────────── */

export interface ImageFileMeta {
  /** MIME 타입(예: 'image/png'). */
  type: string
  /** 바이트 크기. */
  size: number
}

export type ImageValidationError = 'type' | 'size' | 'empty'

export interface ImageValidationResult {
  ok: boolean
  error?: ImageValidationError
  message?: string
}

/** MIME 타입이 허용 목록에 있는지. */
export function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)
}

/**
 * 크리에이티브 이미지 파일 검증(순수 함수) — 어드민 업로드/검증 경로가 공유한다.
 * - 빈 파일(0바이트) 거절
 * - 허용 MIME 타입(png/jpeg/gif/webp/svg)만
 * - MAX_IMAGE_BYTES(2 MiB) 이하
 */
export function validateImageFile(
  meta: ImageFileMeta,
  maxBytes: number = MAX_IMAGE_BYTES
): ImageValidationResult {
  if (!meta.size || meta.size <= 0) {
    return { ok: false, error: 'empty', message: '빈 파일은 업로드할 수 없습니다' }
  }
  if (!isAllowedImageType(meta.type)) {
    return {
      ok: false,
      error: 'type',
      message: `지원하지 않는 이미지 형식입니다 (${ALLOWED_IMAGE_TYPES.join(', ')} 만 허용)`,
    }
  }
  if (meta.size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(1)
    return { ok: false, error: 'size', message: `이미지는 ${mb} MiB 이하여야 합니다` }
  }
  return { ok: true }
}
