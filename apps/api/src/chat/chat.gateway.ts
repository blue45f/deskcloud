import {
  joinConversationSchema,
  typingSchema,
  wsReadSchema,
  WS_AUTH_KEY,
  WS_AUTH_MEMBER,
  WS_AUTH_TOKEN,
  WS_CLIENT_EVENTS,
  WS_SERVER_EVENTS,
  type Ack,
  type MessageDto,
  type PresenceDto,
  type ReadResultDto,
} from '@chatdesk/shared'
import { Inject, Logger, type OnModuleInit } from '@nestjs/common'
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { type Server, type Socket } from 'socket.io'

import { APP_CONFIG, type AppConfig } from '../config'
import { ConversationsService } from '../conversations/conversations.service'
import { TenantsService } from '../tenants/tenants.service'

import { PresenceService } from './presence.service'

/** 소켓에 부착하는 인증 컨텍스트. */
interface SocketData {
  tenantId: string
  publishableKey: string
  memberId: string
}

/**
 * socket.io 게이트웨이 — `CHAT_PATH`(기본 /chat)에 정확 매칭으로 마운트.
 * 핸드셰이크에서 pk(+Origin)+memberId 로 인증하고, 테넌트·대화 범위 룸으로 격리한다.
 * 룸 이름: `tenantId::conversationId`(socket.io 룸은 서버 전역이므로 테넌트로 네임스페이스).
 *
 * 주: @WebSocketGateway 의 path 는 데코레이터 평가 시점에 결정되므로 env 를 직접 읽는다.
 * config.normalizeChatPath 와 동일 규약(선행 슬래시·트레일링 제거).
 */
const CHAT_PATH = (() => {
  const raw = (process.env.CHAT_PATH ?? '/chat').trim() || '/chat'
  const lead = raw.startsWith('/') ? raw : `/${raw}`
  const trimmed = lead.replace(/\/+$/, '')
  return trimmed === '' ? '/chat' : trimmed
})()

@WebSocketGateway({
  path: CHAT_PATH,
  // Origin 검사는 핸드셰이크에서 테넌트별 allowlist 로 직접 수행하므로 여기선 개방.
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger('Chat')

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly tenants: TenantsService,
    private readonly presence: PresenceService,
    private readonly conversations: ConversationsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  onModuleInit(): void {
    // ConversationsService(REST 발송·시스템 발송·모더레이션·읽음)가 대화 룸 구독자에게
    // 실시간 전달할 수 있도록 브로드캐스터를 등록한다.
    this.conversations.setBroadcaster({
      message: (tenantId, message) => this.deliverMessage(tenantId, message),
      messageDeleted: (tenantId, conversationId, messageId) =>
        this.deliverMessageDeleted(tenantId, conversationId, messageId),
      messageRestored: (tenantId, message) => this.deliverMessageRestored(tenantId, message),
      read: (tenantId, payload) => this.deliverRead(tenantId, payload),
    })
    this.logger.log(`WS 게이트웨이 마운트: ${this.cfg.chatPath}`)
  }

  // ── 연결 수명주기 ───────────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const key = this.extractAuth(client, WS_AUTH_KEY)
    const memberId = this.extractAuth(client, WS_AUTH_MEMBER)
    const token = this.extractAuth(client, WS_AUTH_TOKEN)
    const origin = this.extractOrigin(client)

    const tenant = await this.tenants.findByPublishableKey(key)
    if (!tenant) {
      this.emitError(client, 'invalid_key', '유효한 publishable 키가 필요합니다')
      client.disconnect(true)
      return
    }
    if (!this.tenants.isOriginAllowed(tenant, origin)) {
      this.emitError(
        client,
        'origin_not_allowed',
        `Origin 이 허용되지 않습니다: ${origin ?? '(none)'}`
      )
      client.disconnect(true)
      return
    }
    if (!memberId) {
      this.emitError(client, 'missing_member', 'memberId 가 필요합니다')
      client.disconnect(true)
      return
    }
    // 멤버 토큰이 제공되면 검증(강화 인증). 토큰이 있으면 sub 가 memberId 와 일치해야 한다.
    if (token) {
      const payload = this.tenants.verifyMemberToken(tenant, token)
      if (!payload || payload.sub !== memberId) {
        this.emitError(client, 'invalid_member_token', '멤버 토큰이 유효하지 않습니다')
        client.disconnect(true)
        return
      }
    }

    ;(client.data as SocketData) = {
      tenantId: tenant.id,
      publishableKey: tenant.publishableKey,
      memberId,
    }
    this.logger.log(`연결: tenant=${tenant.id} member=${memberId} socket=${client.id}`)
  }

  handleDisconnect(client: Socket): void {
    const left = this.presence.removeSocket(client.id)
    for (const { tenantId, conversationId, memberId } of left) {
      this.server.to(this.room(tenantId, conversationId)).emit(WS_SERVER_EVENTS.presenceLeave, {
        conversationId,
        member: memberId,
        count: this.presence.count(tenantId, conversationId),
      })
    }
  }

  // ── 클라이언트 메시지 ───────────────────────────────────────────────────────

  @SubscribeMessage(WS_CLIENT_EVENTS.join)
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const data = client.data as Partial<SocketData>
    if (!data?.tenantId || !data.memberId)
      return this.ackErr('unauthorized', '인증되지 않은 소켓입니다')

    const parsed = joinConversationSchema.safeParse(body)
    if (!parsed.success) return this.ackErr('bad_request', '유효한 conversationId 가 필요합니다')
    const { conversationId } = parsed.data

    // 멤버십 강제 — 이 멤버가 대화 멤버가 아니면 join 거부.
    let conv
    try {
      conv = await this.conversations.getConversation(data.tenantId, conversationId)
    } catch {
      return this.ackErr('not_found', '대화를 찾을 수 없습니다')
    }
    if (!conv.memberIds.includes(data.memberId)) {
      return this.ackErr('forbidden', '이 대화의 멤버가 아닙니다')
    }

    const room = this.room(data.tenantId, conversationId)
    await client.join(room)
    const isNew = this.presence.add(data.tenantId, conversationId, data.memberId, client.id)

    const snapshot: PresenceDto = {
      conversationId,
      count: this.presence.count(data.tenantId, conversationId),
      members: this.presence.members(data.tenantId, conversationId),
    }
    client.emit(WS_SERVER_EVENTS.presenceState, snapshot)

    if (isNew) {
      client.to(room).emit(WS_SERVER_EVENTS.presenceJoin, {
        conversationId,
        member: data.memberId,
        count: snapshot.count,
      })
    }
    return this.ackOk()
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.leave)
  async onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const data = client.data as Partial<SocketData>
    if (!data?.tenantId || !data.memberId)
      return this.ackErr('unauthorized', '인증되지 않은 소켓입니다')

    const parsed = joinConversationSchema.safeParse(body)
    if (!parsed.success) return this.ackErr('bad_request', '유효한 conversationId 가 필요합니다')
    const { conversationId } = parsed.data

    const room = this.room(data.tenantId, conversationId)
    await client.leave(room)
    const memberLeft = this.presence.remove(data.tenantId, conversationId, data.memberId, client.id)
    if (memberLeft) {
      this.server.to(room).emit(WS_SERVER_EVENTS.presenceLeave, {
        conversationId,
        member: data.memberId,
        count: this.presence.count(data.tenantId, conversationId),
      })
    }
    return this.ackOk()
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.typing)
  onTyping(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Ack {
    const data = client.data as Partial<SocketData>
    if (!data?.tenantId || !data.memberId)
      return this.ackErr('unauthorized', '인증되지 않은 소켓입니다')

    const parsed = typingSchema.safeParse(body)
    if (!parsed.success) return this.ackErr('bad_request', '유효한 typing 페이로드가 필요합니다')
    const { conversationId, typing } = parsed.data

    const room = this.room(data.tenantId, conversationId)
    // 같은 룸의 다른 소켓에게만 릴레이(본인 제외). 멤버십은 join 시점에 보장됨.
    client.to(room).emit(WS_SERVER_EVENTS.typing, {
      conversationId,
      memberId: data.memberId,
      typing,
    })
    return this.ackOk()
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.read)
  async onRead(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<Ack> {
    const data = client.data as Partial<SocketData>
    if (!data?.tenantId || !data.memberId)
      return this.ackErr('unauthorized', '인증되지 않은 소켓입니다')

    const parsed = wsReadSchema.safeParse(body)
    if (!parsed.success) return this.ackErr('bad_request', '유효한 read 페이로드가 필요합니다')
    const { conversationId, lastReadMessageId } = parsed.data

    try {
      // 서비스가 멤버십 강제 + 영속화 + 브로드캐스트(deliverRead)를 수행한다.
      await this.conversations.read(data.tenantId, conversationId, data.memberId, lastReadMessageId)
    } catch {
      return this.ackErr('forbidden', '읽음 처리에 실패했습니다(멤버십/대화 확인)')
    }
    return this.ackOk()
  }

  // ── 브로드캐스트(서비스 → 구독자) ──────────────────────────────────────────

  /** 새 메시지를 대화 룸 구독자에게 전달하고 전달 소켓 수를 돌려준다. */
  private deliverMessage(tenantId: string, message: MessageDto): number {
    if (!this.server) return 0
    const room = this.room(tenantId, message.conversationId)
    this.server.to(room).emit(WS_SERVER_EVENTS.message, message)
    return this.server.sockets.adapter.rooms.get(room)?.size ?? 0
  }

  /** 메시지 삭제(모더레이션) 통지. */
  private deliverMessageDeleted(tenantId: string, conversationId: string, messageId: string): void {
    this.server?.to(this.room(tenantId, conversationId)).emit(WS_SERVER_EVENTS.messageDeleted, {
      conversationId,
      messageId,
    })
  }

  /** 메시지 복원(모더레이션 취소) 통지 — 본문이 복구된 전체 메시지를 다시 전달. */
  private deliverMessageRestored(tenantId: string, message: MessageDto): void {
    this.server
      ?.to(this.room(tenantId, message.conversationId))
      .emit(WS_SERVER_EVENTS.messageRestored, message)
  }

  /** 읽음 리시트 갱신 통지. */
  private deliverRead(tenantId: string, payload: ReadResultDto): void {
    this.server?.to(this.room(tenantId, payload.conversationId)).emit(WS_SERVER_EVENTS.read, {
      conversationId: payload.conversationId,
      memberId: payload.memberId,
      lastReadMessageId: payload.lastReadMessageId,
      readAt: payload.readAt,
    })
  }

  // ── 헬퍼 ────────────────────────────────────────────────────────────────────

  private room(tenantId: string, conversationId: string): string {
    return `${tenantId}::${conversationId}`
  }

  private extractAuth(client: Socket, name: string): string | undefined {
    const auth = client.handshake.auth as Record<string, unknown> | undefined
    const fromAuth = auth?.[name]
    if (typeof fromAuth === 'string' && fromAuth) return fromAuth
    const q = client.handshake.query?.[name]
    const val = Array.isArray(q) ? q[0] : (q as string | undefined)
    return val || undefined
  }

  private extractOrigin(client: Socket): string | undefined {
    const h = client.handshake.headers.origin
    return Array.isArray(h) ? h[0] : h
  }

  private emitError(client: Socket, code: string, message: string): void {
    client.emit(WS_SERVER_EVENTS.error, { code, message })
  }

  private ackOk(): Ack {
    return { ok: true }
  }

  private ackErr(code: string, message: string): Ack {
    return { ok: false, code, message }
  }
}
