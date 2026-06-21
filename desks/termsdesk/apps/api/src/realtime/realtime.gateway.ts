import { Logger } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { REALTIME_EVENTS } from '@termsdesk/shared'
import { Server, Socket } from 'socket.io'

import { SESSION_COOKIE } from '../auth/session.guard'

import { RealtimeAuthService } from './realtime-auth.service'

import type { AuthUser } from '../common/request-context'
import type {
  NotificationDto,
  RealtimeConnectedDto,
  RealtimeRequestMessageCreatedDto,
  RealtimeRequestRoomInput,
  RealtimeRoomAck,
  RequestMessageDto,
  UnreadCountDto,
} from '@termsdesk/shared'

export const REALTIME_SOCKET_PATH = '/socket.io'

interface ServerToClientEvents {
  [REALTIME_EVENTS.connected]: (payload: RealtimeConnectedDto) => void
  [REALTIME_EVENTS.notificationCreated]: (payload: NotificationDto) => void
  [REALTIME_EVENTS.notificationUnreadCount]: (payload: UnreadCountDto) => void
  [REALTIME_EVENTS.requestMessageCreated]: (payload: RealtimeRequestMessageCreatedDto) => void
}

interface ClientToServerEvents {
  [REALTIME_EVENTS.requestJoin]: (
    payload: RealtimeRequestRoomInput,
    ack?: (result: RealtimeRoomAck) => void
  ) => void
  [REALTIME_EVENTS.requestLeave]: (
    payload: RealtimeRequestRoomInput,
    ack?: (result: RealtimeRoomAck) => void
  ) => void
}

interface SocketData {
  user?: AuthUser
}

type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, never, SocketData>
type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, never, SocketData>

function userRoom(userId: string): string {
  return `user:${userId}`
}

function orgRoom(orgId: string): string {
  return `org:${orgId}`
}

function requestRoom(requestId: string): string {
  return `request:${requestId}`
}

function parseCookie(header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=')
        if (index === -1) return [part, '']
        const value = part.slice(index + 1)
        try {
          return [part.slice(0, index), decodeURIComponent(value)]
        } catch {
          return [part.slice(0, index), value]
        }
      })
  )
}

function authToken(socket: RealtimeSocket): string | null {
  const auth = socket.handshake.auth as { token?: unknown } | undefined
  if (typeof auth?.token === 'string' && auth.token.trim()) return auth.token.trim()
  return parseCookie(socket.handshake.headers.cookie)[SESSION_COOKIE] ?? null
}

@WebSocketGateway({
  path: REALTIME_SOCKET_PATH,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('Realtime')

  @WebSocketServer()
  private server?: RealtimeServer

  constructor(private readonly auth: RealtimeAuthService) {}

  async handleConnection(socket: RealtimeSocket): Promise<void> {
    const token = authToken(socket)
    const user = token ? await this.auth.authenticateToken(token) : null
    if (!user) {
      socket.disconnect(true)
      return
    }

    socket.data.user = user
    await socket.join([userRoom(user.userId), orgRoom(user.orgId)])
    socket.emit(REALTIME_EVENTS.connected, {
      userId: user.userId,
      orgId: user.orgId,
      connectedAt: new Date().toISOString(),
    })
  }

  handleDisconnect(socket: RealtimeSocket): void {
    const userId = socket.data.user?.userId
    if (userId) this.logger.debug(`socket disconnected: ${userId}`)
  }

  @SubscribeMessage(REALTIME_EVENTS.requestJoin)
  async joinRequest(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: RealtimeRequestRoomInput
  ): Promise<RealtimeRoomAck> {
    const user = socket.data.user
    if (!user) return { ok: false, error: 'unauthorized' }
    const requestId = payload?.requestId
    if (!(await this.auth.canJoinRequest(user, requestId))) {
      return { ok: false, error: 'not_found' }
    }
    await socket.join(requestRoom(requestId))
    return { ok: true }
  }

  @SubscribeMessage(REALTIME_EVENTS.requestLeave)
  async leaveRequest(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() payload: RealtimeRequestRoomInput
  ): Promise<RealtimeRoomAck> {
    const requestId = payload?.requestId
    if (requestId) await socket.leave(requestRoom(requestId))
    return { ok: true }
  }

  emitNotification(userId: string, notification: NotificationDto, unreadCount: number): void {
    this.server?.to(userRoom(userId)).emit(REALTIME_EVENTS.notificationCreated, notification)
    this.emitUnreadCount(userId, unreadCount)
  }

  emitUnreadCount(userId: string, count: number): void {
    this.server?.to(userRoom(userId)).emit(REALTIME_EVENTS.notificationUnreadCount, { count })
  }

  emitRequestMessage(message: RequestMessageDto): void {
    this.server?.to(requestRoom(message.requestId)).emit(REALTIME_EVENTS.requestMessageCreated, {
      requestId: message.requestId,
      message,
    })
  }
}
