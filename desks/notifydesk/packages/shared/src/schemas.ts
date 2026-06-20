import { z } from 'zod'

import {
  BODY_MAX,
  CHANNELS,
  PLANS,
  RECIPIENT_ID_RE,
  SLUG_RE,
  TEMPLATE_KEY_RE,
  TITLE_MAX,
} from './constants'

/** 테넌트 slug — 외부 식별자(소문자·숫자·하이픈). */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(SLUG_RE, 'slug는 소문자·숫자·하이픈만 가능합니다')

/** recipientId — 테넌트 측 사용자 식별자(불투명). */
export const recipientIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(RECIPIENT_ID_RE, 'recipientId는 영숫자·._@- 만 가능합니다')

/** 템플릿 key — 테넌트별 알림 종류 식별자. */
export const templateKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(TEMPLATE_KEY_RE, '템플릿 key는 영숫자·._- 만 가능합니다')

/** 채널 열거. */
export const channelSchema = z.enum(CHANNELS)

/** 채널 배열 — 1개 이상, 중복 제거. */
export const channelsSchema = z
  .array(channelSchema)
  .min(1, '채널이 1개 이상 필요합니다')
  .transform((arr) => [...new Set(arr)])

/** 요금제 열거. */
export const planSchema = z.enum(PLANS)

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

// ── 템플릿 ───────────────────────────────────────────────────────────────────

/** 알림 템플릿 본문 — key·channels·subject?·bodyTemplate(mustache-ish). */
export const templateBodySchema = z.object({
  key: templateKeySchema,
  /** 이 템플릿이 기본으로 사용할 채널. notify 호출이 채널을 안 주면 이 값을 쓴다. */
  channels: channelsSchema,
  /** email/web-push 제목(선택). 템플릿 변수 사용 가능. */
  subject: z
    .union([z.string().trim().max(TITLE_MAX), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  /** 본문 템플릿 — `{{var}}` 치환. */
  bodyTemplate: z.string().trim().min(1).max(BODY_MAX),
})
export type TemplateBodyInput = z.infer<typeof templateBodySchema>

/** 템플릿 생성 입력(= 본문). */
export const createTemplateSchema = templateBodySchema
export type CreateTemplateInput = TemplateBodyInput

/** 템플릿 수정 입력 — key 는 경로로 식별하므로 본문만(부분 갱신 아님, 전체 교체). */
export const updateTemplateSchema = templateBodySchema.omit({ key: true })
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>

// ── 알림 발송(notify) ────────────────────────────────────────────────────────

/**
 * 발송 입력 — secret 키로 호출.
 * templateKey 를 주면 템플릿의 channels/subject/bodyTemplate 을 기반으로 렌더.
 * 또는 title/body 를 직접 주는 애드혹 발송도 가능(둘 중 하나는 있어야 함).
 */
export const notifySchema = z
  .object({
    recipientId: recipientIdSchema,
    /** 알림 종류(분류·선호 설정 키). 템플릿 key 와 같을 수도, 임의 분류일 수도 있다. */
    type: templateKeySchema,
    /** 사용할 템플릿 key(선택). 주면 type 와 별개로 이 템플릿을 렌더한다. */
    templateKey: templateKeySchema.optional(),
    /** 보낼 채널(선택). 미지정 시 템플릿 channels, 그것도 없으면 ['in_app']. */
    channels: channelsSchema.optional(),
    /** 애드혹 제목(선택, 템플릿 subject 보다 우선). */
    title: z.string().trim().max(TITLE_MAX).optional(),
    /** 애드혹 본문(선택, 템플릿 body 보다 우선). 템플릿 없으면 필수. */
    body: z.string().trim().max(BODY_MAX).optional(),
    /** 템플릿 렌더 변수 + 인박스에 함께 저장할 구조화 데이터. */
    data: z.record(z.string(), z.unknown()).optional(),
    /** 이메일 발송용 수신자 주소(선택). 없으면 email 채널은 데이터의 email 을 시도. */
    email: z.email().max(320).optional(),
  })
  .refine((v) => Boolean(v.templateKey) || Boolean(v.body), {
    message: 'templateKey 또는 body 중 하나는 필요합니다',
    path: ['body'],
  })
export type NotifyInput = z.infer<typeof notifySchema>

// ── 인박스(publishable) ──────────────────────────────────────────────────────

/** 인박스 읽음 처리 입력 — id 배열 또는 전체(all). */
export const markReadSchema = z
  .object({
    recipientId: recipientIdSchema,
    /** 읽음 처리할 알림 id 목록. */
    ids: z.array(z.uuid()).max(500).optional(),
    /** true 면 해당 recipient 의 미읽음 전부를 읽음 처리. */
    all: z.boolean().optional(),
  })
  .refine((v) => v.all === true || (v.ids != null && v.ids.length > 0), {
    message: 'ids(1개 이상) 또는 all=true 가 필요합니다',
    path: ['ids'],
  })
export type MarkReadInput = z.infer<typeof markReadSchema>

// ── 선호 설정(preferences) ───────────────────────────────────────────────────

/** 선호 항목 — (type, channel) 별 on/off. */
export const preferenceItemSchema = z.object({
  type: templateKeySchema,
  channel: channelSchema,
  enabled: z.boolean(),
})
export type PreferenceItemInput = z.infer<typeof preferenceItemSchema>

/** 선호 설정 일괄 갱신 입력. */
export const updatePreferencesSchema = z.object({
  recipientId: recipientIdSchema,
  preferences: z.array(preferenceItemSchema).max(200),
})
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>

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
