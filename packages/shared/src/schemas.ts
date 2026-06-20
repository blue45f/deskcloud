import { z } from 'zod'

import { CHANNEL_RE, EVENT_RE, MAX_HISTORY_LIMIT, PLANS } from './constants'

/** 채널 이름 — 테넌트 범위로 격리되는 토픽. */
export const channelSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(CHANNEL_RE, '채널 이름은 영숫자·:·_·-·. 만 가능합니다')

/** 이벤트 이름 — publish 페이로드의 타입 힌트. */
export const eventSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(EVENT_RE, '이벤트 이름은 영숫자·:·_·-·. 만 가능합니다')

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
    /** WS 핸드셰이크·pk 엔드포인트에서 허용할 Origin allowlist(전체 치환). */
    corsOrigins: z.array(originSchema).max(50).optional(),
    /** 요금제. */
    plan: z.enum(PLANS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: '수정할 필드를 하나 이상 보내야 합니다',
  })
export type UpdateTenantSettingsInput = z.infer<typeof updateTenantSettingsSchema>

/**
 * publish 입력(서버, sk) — 채널로 이벤트를 브로드캐스트하고 영속화한다.
 * data 는 임의 JSON(객체/배열/원시). 크기 상한은 서버 측에서 강제.
 */
export const publishSchema = z.object({
  channel: channelSchema,
  event: eventSchema,
  /** 임의 JSON 페이로드. 생략 가능(이벤트만 알림). */
  data: z.unknown().optional(),
})
export type PublishInput = z.infer<typeof publishSchema>

/** WS 채널 구독/해제 페이로드. */
export const channelSubscriptionSchema = z.object({
  channel: channelSchema,
})
export type ChannelSubscriptionInput = z.infer<typeof channelSubscriptionSchema>

/** history 조회 쿼리(limit). */
export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_HISTORY_LIMIT).optional(),
})
export type HistoryQueryInput = z.infer<typeof historyQuerySchema>

/**
 * 방문 추적 ping 입력(공개) — 브라우저가 앱 부팅 시 1회 보낸다.
 * `firstToday` 가 true 면 오늘(클라이언트 localStorage 일자 키 기준) 첫 방문으로 보고
 * 고유 방문자(visitors)를 +1 한다. 모든 ping 은 hit 를 +1 한다. 추적은 hit/visitor 만 세며
 * 개인정보(IP·식별자)는 저장하지 않는다.
 */
export const visitPingSchema = z.object({
  /** 오늘 첫 방문이면 true(고유 방문자 카운트). 생략 시 hit 만. */
  firstToday: z.boolean().optional(),
})
export type VisitPingInput = z.infer<typeof visitPingSchema>
