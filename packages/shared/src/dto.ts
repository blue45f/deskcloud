import type { Channel, NotificationStatus, Plan } from './constants'

/**
 * 가입 직후에만 반환되는 테넌트 표현 — secretKey 평문은 이때 한 번만 노출된다.
 * (이후 어떤 API 도 secretKey 평문을 돌려주지 않는다. 해시만 저장.)
 */
export interface TenantCredentialsDto {
  id: string
  name: string
  slug: string
  plan: Plan
  publishableKey: string
  /** 평문 secret 키 — 가입/rotate 응답에서만 1회 노출. 저장은 해시. */
  secretKey: string
  corsOrigins: string[]
  createdAt: string
}

/** 일반 테넌트 표현(secret 평문 제외) — 어드민 조회·갱신 응답. */
export interface TenantDto {
  id: string
  name: string
  slug: string
  plan: Plan
  publishableKey: string
  corsOrigins: string[]
  /** 누적 발송(notify 호출이 1건 이상 채널로 나간 횟수) 카운터. */
  usageCount: number
  createdAt: string
}

/** 알림 템플릿 표현. */
export interface TemplateDto {
  tenantId: string
  key: string
  channels: Channel[]
  subject: string | null
  bodyTemplate: string
  createdAt: string
  updatedAt: string
}

/** 인박스 알림 단건(in-app). */
export interface NotificationDto {
  id: string
  tenantId: string
  recipientId: string
  type: string
  channels: Channel[]
  title: string
  body: string
  data: Record<string, unknown> | null
  status: NotificationStatus
  readAt: string | null
  createdAt: string
}

/** 인박스 목록(publishable). */
export interface InboxDto {
  items: NotificationDto[]
  unreadCount: number
  limit: number
}

/** 미읽음 카운트(publishable). */
export interface UnreadCountDto {
  recipientId: string
  unreadCount: number
}

/** 읽음 처리 결과. */
export interface MarkReadResultDto {
  updated: number
  unreadCount: number
}

/** 발송 결과 — 채널별 전달 상태(애드혹/템플릿 공통). */
export interface NotifyResultDto {
  /** 생성된 in-app 알림 id(in_app 채널이 활성일 때). */
  notificationId: string | null
  recipientId: string
  type: string
  /** 실제로 시도/전달된 채널과 결과. */
  deliveries: ChannelDeliveryDto[]
  /** 선호 설정으로 억제된 채널 목록. */
  suppressed: Channel[]
  /** 무료 플랜 캡 초과로 전체 발송이 거부되었는가. */
  capExceeded: boolean
}

/** 채널 1건 전달 결과. */
export interface ChannelDeliveryDto {
  channel: Channel
  status: 'delivered' | 'skipped' | 'failed'
  /** skipped/failed 사유(예: 'vapid-unset', 'no-email', 'preference-off'). */
  detail?: string
}

/** 선호 항목 표현. */
export interface PreferenceDto {
  tenantId: string
  recipientId: string
  type: string
  channel: Channel
  enabled: boolean
}

/** 선호 설정 목록(publishable). */
export interface PreferencesDto {
  recipientId: string
  preferences: PreferenceDto[]
}

/** 어드민 발송 로그(최신순, 페이지네이션). */
export interface SentLogDto {
  items: NotificationDto[]
  total: number
  offset: number
  limit: number
}
