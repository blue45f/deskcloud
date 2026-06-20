import { z } from 'zod'

import {
  CONVERSATION_KINDS,
  DEFAULT_MEMBER_TOKEN_TTL_SEC,
  MAX_ATTACHMENTS,
  MAX_BODY_LEN,
  MAX_GROUP_MEMBERS,
  MAX_MESSAGE_LIMIT,
  MAX_TITLE_LEN,
  MEMBER_ID_RE,
  PLANS,
} from './constants'

/** 멤버 식별자 — 호스트 앱의 사용자 id. 테넌트 범위로 격리된다. */
export const memberIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(MEMBER_ID_RE, '멤버 식별자는 영숫자·:·_·-·.·@ 만 가능합니다')

/** 단일 Origin — corsOrigins allowlist 항목. `*` 는 모든 Origin 허용(데모용). */
export const originSchema = z.union([
  z.literal('*'),
  z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .regex(/^https?:\/\/[^\s/]+$/i, 'Origin 은 http(s)://host[:port] 형태여야 합니다'),
])

/** 메시지 첨부 — 호스트가 올린 파일/링크 메타. 저장만 하고 호스팅은 하지 않는다(URL 참조). */
export const attachmentSchema = z.object({
  /** 표시 이름. */
  name: z.string().trim().min(1).max(300),
  /** 접근 URL(호스트가 책임). */
  url: z.string().trim().url().max(2000),
  /** MIME 타입(선택). */
  contentType: z.string().trim().max(255).optional(),
  /** 바이트 크기(선택). */
  size: z.number().int().nonnegative().optional(),
})
export type Attachment = z.infer<typeof attachmentSchema>

// ── 테넌트(가입/설정) ────────────────────────────────────────────────────────

/** 테넌트 가입 입력 — 이름 + (선택) 허용 Origin 목록. 비우면 ['*'](데모). */
export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** WS 핸드셰이크·pk 엔드포인트에서 허용할 Origin allowlist. 미지정 시 ['*']. */
  corsOrigins: z.array(originSchema).max(50).optional(),
  /** 요금제(미지정 시 free). */
  plan: z.enum(PLANS).optional(),
})
export type CreateTenantInput = z.infer<typeof createTenantSchema>

/**
 * 테넌트 설정 수정 입력(어드민) — 이름·허용 Origin·요금제를 부분 갱신한다.
 * 모든 필드는 선택(보낸 필드만 갱신). 키·사용량은 여기서 바꾸지 않는다(키는 회전 전용).
 */
export const updateTenantSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    corsOrigins: z.array(originSchema).max(50).optional(),
    plan: z.enum(PLANS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: '수정할 필드를 하나 이상 보내야 합니다',
  })
export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>

// ── 방문 추적(공개 ping) ──────────────────────────────────────────────────────

/**
 * 공개 방문 ping 입력 — 위젯/SDK 가 호스트의 pk 로 부른다. visitorId 는 클라이언트가
 * 생성(crypto.randomUUID)해 localStorage 에 보관하는 익명 식별자로, (tenant, day, visitorId)
 * 로 고유 방문자를 dedupe 한다. 미지정 시 pageview 만 +1(고유 방문자엔 미반영).
 */
export const visitPingSchema = z.object({
  /** 클라이언트 생성 익명 방문자 id(고유 방문자 dedupe용, 선택). */
  visitorId: z.string().trim().min(1).max(128).optional(),
})
export type VisitPingInput = z.infer<typeof visitPingSchema>

// ── 대화(생성) ──────────────────────────────────────────────────────────────

/**
 * 대화 생성 입력 — DM 또는 그룹.
 * - DM: `kind:'dm'` + 서로 다른 멤버 1~2명(`memberIds`). 같은 쌍은 기존 대화를 재사용(dedupe).
 * - group: `kind:'group'` + 멤버 1명 이상, `title` 선택.
 */
export const createConversationSchema = z
  .object({
    kind: z.enum(CONVERSATION_KINDS),
    title: z.string().trim().min(1).max(MAX_TITLE_LEN).optional(),
    memberIds: z.array(memberIdSchema).min(1).max(MAX_GROUP_MEMBERS),
  })
  .superRefine((v, ctx) => {
    const unique = new Set(v.memberIds)
    if (v.kind === 'dm' && unique.size > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['memberIds'],
        message: 'DM 은 서로 다른 멤버가 최대 2명이어야 합니다',
      })
    }
  })
export type CreateConversationInput = z.infer<typeof createConversationSchema>

// ── 메시지(발송) ────────────────────────────────────────────────────────────

/** pk 발송 입력 — 보낸 멤버(senderMemberId) + 본문(+첨부). */
export const sendMessageSchema = z
  .object({
    senderMemberId: memberIdSchema,
    body: z.string().trim().max(MAX_BODY_LEN),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
  })
  .refine((v) => v.body.length > 0 || (v.attachments?.length ?? 0) > 0, {
    message: '본문 또는 첨부가 하나 이상 필요합니다',
  })
export type SendMessageInput = z.infer<typeof sendMessageSchema>

/** 어드민 시스템 발송 입력 — 발신자 없는 시스템 메시지(공지·자동화). */
export const systemMessageSchema = z
  .object({
    body: z.string().trim().max(MAX_BODY_LEN),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
  })
  .refine((v) => v.body.length > 0 || (v.attachments?.length ?? 0) > 0, {
    message: '본문 또는 첨부가 하나 이상 필요합니다',
  })
export type SystemMessageInput = z.infer<typeof systemMessageSchema>

/** 읽음 리시트 입력 — 어떤 멤버가 어디까지 읽었는지. */
export const readReceiptSchema = z.object({
  memberId: memberIdSchema,
  /** 마지막으로 읽은 메시지 id. 생략하면 대화의 최신 메시지까지 읽음 처리. */
  lastReadMessageId: z.string().uuid().optional(),
})
export type ReadReceiptInput = z.infer<typeof readReceiptSchema>

// ── 쿼리 ────────────────────────────────────────────────────────────────────

/** 내 대화 목록 쿼리 — memberId 필수. */
export const myConversationsQuerySchema = z.object({
  memberId: memberIdSchema,
})
export type MyConversationsQueryInput = z.infer<typeof myConversationsQuerySchema>

/** 히스토리 조회 쿼리 — memberId(멤버 범위) + 커서(before)·limit. */
export const messageHistoryQuerySchema = z.object({
  memberId: memberIdSchema,
  /** 이 메시지 id 이전(더 오래된) 것들. 페이지네이션 커서. */
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_MESSAGE_LIMIT).optional(),
})
export type MessageHistoryQueryInput = z.infer<typeof messageHistoryQuerySchema>

/** 어드민 히스토리 조회 쿼리 — 멤버십 무관(운영자 모니터). 커서(before)·limit. */
export const adminMessageHistoryQuerySchema = z.object({
  /** 이 메시지 id 이전(더 오래된) 것들. 페이지네이션 커서. */
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_MESSAGE_LIMIT).optional(),
})
export type AdminMessageHistoryQueryInput = z.infer<typeof adminMessageHistoryQuerySchema>

// ── WS 와이어 페이로드 ───────────────────────────────────────────────────────

/** WS join/leave 페이로드. */
export const joinConversationSchema = z.object({
  conversationId: z.string().uuid(),
})
export type JoinConversationInput = z.infer<typeof joinConversationSchema>

/** WS 타이핑 인디케이터 페이로드. */
export const typingSchema = z.object({
  conversationId: z.string().uuid(),
  /** 타이핑 시작/종료. */
  typing: z.boolean(),
})
export type TypingInput = z.infer<typeof typingSchema>

/** WS 읽음 통지 페이로드(리시트와 동일 의미, 소켓 경로). */
export const wsReadSchema = z.object({
  conversationId: z.string().uuid(),
  lastReadMessageId: z.string().uuid().optional(),
})
export type WsReadInput = z.infer<typeof wsReadSchema>

// ── 멤버 토큰 발급(sk) ───────────────────────────────────────────────────────

/** 멤버 토큰 발급 입력(호스트 서버, sk) — 어떤 멤버에게 얼마 동안. */
export const issueMemberTokenSchema = z.object({
  memberId: memberIdSchema,
  /** 만료까지 초(기본 3600). */
  ttlSec: z.coerce
    .number()
    .int()
    .min(60)
    .max(86_400)
    .optional()
    .default(DEFAULT_MEMBER_TOKEN_TTL_SEC),
})
export type IssueMemberTokenInput = z.infer<typeof issueMemberTokenSchema>
