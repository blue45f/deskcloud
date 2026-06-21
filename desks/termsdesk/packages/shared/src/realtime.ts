import type { RequestMessageDto } from './brokerage'
import type { NotificationDto, UnreadCountDto } from './notification'

/** Socket.IO event names shared by API and web clients. */
export const REALTIME_EVENTS = {
  connected: 'realtime.connected',
  notificationCreated: 'notification.created',
  notificationUnreadCount: 'notification.unread_count',
  requestJoin: 'brokerage.request.join',
  requestLeave: 'brokerage.request.leave',
  requestMessageCreated: 'brokerage.message.created',
} as const

export interface RealtimeConnectedDto {
  userId: string
  orgId: string
  connectedAt: string
}

export interface RealtimeTokenDto {
  token: string
  origin: string
  path: string
  expiresAt: string
}

export interface RealtimeRequestRoomInput {
  requestId: string
}

export interface RealtimeRoomAck {
  ok: boolean
  error?: string
}

export interface RealtimeRequestMessageCreatedDto {
  requestId: string
  message: RequestMessageDto
}

export interface RealtimeServerEventPayloads {
  [REALTIME_EVENTS.connected]: RealtimeConnectedDto
  [REALTIME_EVENTS.notificationCreated]: NotificationDto
  [REALTIME_EVENTS.notificationUnreadCount]: UnreadCountDto
  [REALTIME_EVENTS.requestMessageCreated]: RealtimeRequestMessageCreatedDto
}

export interface RealtimeClientEventPayloads {
  [REALTIME_EVENTS.requestJoin]: RealtimeRequestRoomInput
  [REALTIME_EVENTS.requestLeave]: RealtimeRequestRoomInput
}

export type RealtimeServerEventName = keyof RealtimeServerEventPayloads
export type RealtimeClientEventName = keyof RealtimeClientEventPayloads
