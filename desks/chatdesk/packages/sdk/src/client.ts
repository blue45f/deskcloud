/**
 * ChatDesk 브라우저 클라이언트 — pk + memberId 로 연결해, 자신이 속한 대화에서
 * 메시지를 주고받는다. socket.io-client(실시간) + REST(히스토리·발송·읽음) 결합.
 *
 *   const chat = createChatClient({ publishableKey, memberId, endpoint })
 *   await chat.connect()
 *   const { items } = await chat.conversations()
 *   const room = await chat.open(conversationId)   // 히스토리 로드 + join + 구독
 *   room.onMessage((m) => …)
 *   await chat.send(conversationId, '안녕!')
 *   chat.typing(conversationId, true)
 *   await chat.markRead(conversationId)
 *
 * 의존성: socket.io-client(런타임) + @chatdesk/shared(타입·상수). 그 외 0.
 */
import {
  DEFAULT_CHAT_PATH,
  WS_AUTH_KEY,
  WS_AUTH_MEMBER,
  WS_AUTH_TOKEN,
  WS_CLIENT_EVENTS,
  WS_SERVER_EVENTS,
  type Ack,
  type MessageDto,
  type MessageHistoryDto,
  type MyConversationsDto,
  type ReadResultDto,
  type SendMessageInput,
  type SendResultDto,
  type ServerMessageDeletedEvent,
  type ServerMessageRestoredEvent,
  type ServerPresenceDeltaEvent,
  type ServerPresenceStateEvent,
  type ServerReadEvent,
  type ServerTypingEvent,
} from '@chatdesk/shared'
import { io, type Socket } from 'socket.io-client'

import { ChatDeskError, createRest, qs, type Rest } from './rest'

export { ChatDeskError } from './rest'
export type {
  ConversationListItemDto,
  MessageDto,
  MessageHistoryDto,
  MyConversationsDto,
  SendResultDto,
} from '@chatdesk/shared'

export interface ChatClientOptions {
  /** publishable 키(pk_…) — 브라우저용. */
  publishableKey: string
  /** 이 클라이언트가 대변하는 멤버(호스트 앱의 사용자 id). */
  memberId: string
  /** API 베이스 URL. 예: 'https://chat.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** socket.io 마운트 경로(서버 CHAT_PATH 와 일치). 기본 '/chat'. */
  path?: string
  /** 호스트 서버가 sk 로 발급한 멤버 토큰(선택, 강화 인증). */
  memberToken?: string
  /** 커스텀 fetch(SSR/테스트). 기본 전역 fetch. */
  fetch?: typeof fetch
  /** 자동 재연결 비활성(기본 활성). */
  noReconnect?: boolean
}

/** 클라이언트 연결 상태. */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected'

type Unsubscribe = () => void

/** 대화 하나에 대한 라이브 핸들 — open() 이 반환한다. */
export interface ConversationRoom {
  conversationId: string
  /** open 시 로드한 초기 히스토리(오래된→최신). */
  messages: MessageDto[]
  /** 이전 페이지 더 있는지. fetchOlder() 로 추가 로드. */
  hasMore: boolean
  /** 이 대화의 새 메시지 구독(자신·타인·시스템). 해제 함수 반환. */
  onMessage: (cb: (m: MessageDto) => void) => Unsubscribe
  /** 타이핑 인디케이터 구독(타인). */
  onTyping: (cb: (e: ServerTypingEvent) => void) => Unsubscribe
  /** 읽음 리시트 갱신 구독. */
  onRead: (cb: (e: ServerReadEvent) => void) => Unsubscribe
  /** presence(온라인) 변경 구독 — 스냅샷/참여/이탈. */
  onPresence: (cb: (count: number, members: string[]) => void) => Unsubscribe
  /** 메시지 삭제(모더레이션) 구독. */
  onMessageDeleted: (cb: (e: ServerMessageDeletedEvent) => void) => Unsubscribe
  /** 메시지 복원(모더레이션 취소) 구독 — 본문이 복구된 전체 메시지. */
  onMessageRestored: (cb: (e: ServerMessageRestoredEvent) => void) => Unsubscribe
  /** 더 오래된 메시지 페이지 로드(prepend 후 messages·hasMore 갱신). */
  fetchOlder: () => Promise<MessageDto[]>
  /** 이 대화에서 나가기(룸 leave + 구독 해제). */
  close: () => Promise<void>
}

const DEFAULT_HISTORY_LIMIT = 30

export interface ChatClient {
  /** 현재 연결 상태. */
  readonly state: ConnectionState
  /** 이 클라이언트의 memberId. */
  readonly memberId: string
  /** 소켓 연결. 이미 연결돼 있으면 즉시 resolve. */
  connect: () => Promise<void>
  /** 연결 종료(모든 룸 leave·구독 해제). */
  disconnect: () => void
  /** 내 대화 목록 + unread(REST). */
  conversations: (signal?: AbortSignal) => Promise<MyConversationsDto>
  /** 대화 열기 — 히스토리 로드 + WS join + 라이브 구독 핸들 반환. */
  open: (conversationId: string, opts?: { limit?: number }) => Promise<ConversationRoom>
  /** 메시지 발송(REST). 영속화 후 WS 로 모든 구독자(자신 포함)에게 브로드캐스트된다. */
  send: (
    conversationId: string,
    body: string,
    attachments?: SendMessageInput['attachments']
  ) => Promise<SendResultDto>
  /** 타이핑 인디케이터 전송(WS, fire-and-forget). */
  typing: (conversationId: string, typing: boolean) => void
  /** 읽음 처리(WS). lastReadMessageId 생략 시 대화 최신까지. */
  markRead: (conversationId: string, lastReadMessageId?: string) => Promise<void>
  /** 모든 대화에 걸친 새 메시지 글로벌 구독(목록 unread 갱신 등). */
  onMessage: (cb: (m: MessageDto) => void) => Unsubscribe
  /** 연결 상태 변화 구독. */
  onStateChange: (cb: (s: ConnectionState) => void) => Unsubscribe
  /** WS/핸드셰이크 오류 구독. */
  onError: (cb: (e: { code: string; message: string }) => void) => Unsubscribe
}

export function createChatClient(options: ChatClientOptions): ChatClient {
  const { publishableKey, memberId, endpoint } = options
  if (!publishableKey) throw new ChatDeskError('publishableKey 가 필요합니다', 0)
  if (!memberId) throw new ChatDeskError('memberId 가 필요합니다', 0)

  const base = endpoint.replace(/\/+$/, '')
  const path = normalizePath(options.path ?? DEFAULT_CHAT_PATH)
  const rest: Rest = createRest({ endpoint: base, key: publishableKey, fetch: options.fetch })

  let socket: Socket | null = null
  let state: ConnectionState = 'idle'
  const stateListeners = new Set<(s: ConnectionState) => void>()
  const errorListeners = new Set<(e: { code: string; message: string }) => void>()
  const globalMessageListeners = new Set<(m: MessageDto) => void>()

  // 룸별 리스너 레지스트리(여러 open 동시 지원).
  type RoomListeners = {
    message: Set<(m: MessageDto) => void>
    typing: Set<(e: ServerTypingEvent) => void>
    read: Set<(e: ServerReadEvent) => void>
    presence: Set<(count: number, members: string[]) => void>
    deleted: Set<(e: ServerMessageDeletedEvent) => void>
    restored: Set<(e: ServerMessageRestoredEvent) => void>
    presenceMembers: Set<string>
  }
  const rooms = new Map<string, RoomListeners>()

  const setState = (s: ConnectionState): void => {
    if (s === state) return
    state = s
    for (const cb of stateListeners) cb(s)
  }

  const emitError = (e: { code: string; message: string }): void => {
    for (const cb of errorListeners) cb(e)
  }

  const ensureSocket = (): Socket => {
    if (socket) return socket
    const auth: Record<string, string> = {
      [WS_AUTH_KEY]: publishableKey,
      [WS_AUTH_MEMBER]: memberId,
    }
    if (options.memberToken) auth[WS_AUTH_TOKEN] = options.memberToken

    const s = io(base, {
      path,
      transports: ['websocket', 'polling'],
      auth,
      autoConnect: false,
      reconnection: !options.noReconnect,
      withCredentials: true,
    })

    s.on('connect', () => setState('connected'))
    s.on('disconnect', () => setState('disconnected'))
    s.on('connect_error', (err: Error) => {
      setState('disconnected')
      emitError({ code: 'connect_error', message: err.message })
    })

    s.on(WS_SERVER_EVENTS.error, (e: { code: string; message: string }) => emitError(e))

    s.on(WS_SERVER_EVENTS.message, (m: MessageDto) => {
      for (const cb of globalMessageListeners) cb(m)
      const r = rooms.get(m.conversationId)
      if (r) for (const cb of r.message) cb(m)
    })
    s.on(WS_SERVER_EVENTS.typing, (e: ServerTypingEvent) => {
      const r = rooms.get(e.conversationId)
      if (r) for (const cb of r.typing) cb(e)
    })
    s.on(WS_SERVER_EVENTS.read, (e: ServerReadEvent) => {
      const r = rooms.get(e.conversationId)
      if (r) for (const cb of r.read) cb(e)
    })
    s.on(WS_SERVER_EVENTS.messageDeleted, (e: ServerMessageDeletedEvent) => {
      const r = rooms.get(e.conversationId)
      if (r) for (const cb of r.deleted) cb(e)
    })
    s.on(WS_SERVER_EVENTS.messageRestored, (m: ServerMessageRestoredEvent) => {
      const r = rooms.get(m.conversationId)
      if (r) for (const cb of r.restored) cb(m)
    })
    s.on(WS_SERVER_EVENTS.presenceState, (e: ServerPresenceStateEvent) => {
      const r = rooms.get(e.conversationId)
      if (!r) return
      r.presenceMembers = new Set(e.members)
      for (const cb of r.presence) cb(e.count, [...r.presenceMembers])
    })
    s.on(WS_SERVER_EVENTS.presenceJoin, (e: ServerPresenceDeltaEvent) => {
      const r = rooms.get(e.conversationId)
      if (!r) return
      r.presenceMembers.add(e.member)
      for (const cb of r.presence) cb(e.count, [...r.presenceMembers])
    })
    s.on(WS_SERVER_EVENTS.presenceLeave, (e: ServerPresenceDeltaEvent) => {
      const r = rooms.get(e.conversationId)
      if (!r) return
      r.presenceMembers.delete(e.member)
      for (const cb of r.presence) cb(e.count, [...r.presenceMembers])
    })

    socket = s
    return s
  }

  const emit = <T>(event: string, payload: unknown): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const s = socket
      if (!s || !s.connected) {
        reject(new ChatDeskError('소켓이 연결되어 있지 않습니다. connect() 를 먼저 호출하세요.', 0))
        return
      }
      s.timeout(8000).emit(event, payload, (timeoutErr: Error | null, ack: T) => {
        if (timeoutErr) {
          reject(new ChatDeskError('서버 응답 시간 초과', 0))
          return
        }
        resolve(ack)
      })
    })

  const ensureRoom = (conversationId: string): RoomListeners => {
    let r = rooms.get(conversationId)
    if (!r) {
      r = {
        message: new Set(),
        typing: new Set(),
        read: new Set(),
        presence: new Set(),
        deleted: new Set(),
        restored: new Set(),
        presenceMembers: new Set(),
      }
      rooms.set(conversationId, r)
    }
    return r
  }

  return {
    get state() {
      return state
    },
    get memberId() {
      return memberId
    },

    connect() {
      const s = ensureSocket()
      if (s.connected) return Promise.resolve()
      setState('connecting')
      return new Promise<void>((resolve, reject) => {
        const onConnect = (): void => {
          cleanup()
          resolve()
        }
        const onErr = (err: Error): void => {
          cleanup()
          reject(new ChatDeskError(`연결 실패: ${err.message}`, 0))
        }
        const cleanup = (): void => {
          s.off('connect', onConnect)
          s.off('connect_error', onErr)
        }
        s.once('connect', onConnect)
        s.once('connect_error', onErr)
        s.connect()
      })
    },

    disconnect() {
      if (socket) {
        socket.disconnect()
        socket = null
      }
      rooms.clear()
      setState('disconnected')
    },

    conversations(signal) {
      return rest.get<MyConversationsDto>(`/api/conversations${qs({ memberId })}`, signal)
    },

    async open(conversationId, opts) {
      const limit = opts?.limit ?? DEFAULT_HISTORY_LIMIT
      const history = await rest.get<MessageHistoryDto>(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages${qs({ memberId, limit })}`
      )
      const r = ensureRoom(conversationId)

      // WS join(멤버십·presence). 소켓 미연결이면 connect 를 시도.
      if (!socket?.connected) await this.connect()
      const ack = await emit<Ack>(WS_CLIENT_EVENTS.join, { conversationId })
      if (!ack.ok) {
        rooms.delete(conversationId)
        throw new ChatDeskError(ack.message, 403, ack.code)
      }

      const room: ConversationRoom = {
        conversationId,
        messages: history.items,
        hasMore: history.hasMore,
        onMessage(cb) {
          r.message.add(cb)
          return () => r.message.delete(cb)
        },
        onTyping(cb) {
          r.typing.add(cb)
          return () => r.typing.delete(cb)
        },
        onRead(cb) {
          r.read.add(cb)
          return () => r.read.delete(cb)
        },
        onPresence(cb) {
          r.presence.add(cb)
          // 이미 스냅샷을 받은 상태면 즉시 1회 전달.
          if (r.presenceMembers.size > 0) cb(r.presenceMembers.size, [...r.presenceMembers])
          return () => r.presence.delete(cb)
        },
        onMessageDeleted(cb) {
          r.deleted.add(cb)
          return () => r.deleted.delete(cb)
        },
        onMessageRestored(cb) {
          r.restored.add(cb)
          return () => r.restored.delete(cb)
        },
        async fetchOlder() {
          const oldest = room.messages[0]
          const page = await rest.get<MessageHistoryDto>(
            `/api/conversations/${encodeURIComponent(conversationId)}/messages${qs({
              memberId,
              limit,
              before: oldest?.id,
            })}`
          )
          room.messages = [...page.items, ...room.messages]
          room.hasMore = page.hasMore
          return page.items
        },
        async close() {
          if (socket?.connected) {
            try {
              await emit<Ack>(WS_CLIENT_EVENTS.leave, { conversationId })
            } catch {
              /* leave 실패는 무시(연결 종료 등) */
            }
          }
          rooms.delete(conversationId)
        },
      }
      return room
    },

    send(conversationId, body, attachments) {
      const input: SendMessageInput = { senderMemberId: memberId, body, attachments }
      return rest.post<SendResultDto>(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        input
      )
    },

    typing(conversationId, typing) {
      if (!socket?.connected) return
      socket.emit(WS_CLIENT_EVENTS.typing, { conversationId, typing })
    },

    async markRead(conversationId, lastReadMessageId) {
      if (socket?.connected) {
        const ack = await emit<Ack>(WS_CLIENT_EVENTS.read, { conversationId, lastReadMessageId })
        if (!ack.ok) throw new ChatDeskError(ack.message, 403, ack.code)
        return
      }
      // 소켓 미연결 폴백 — REST 로 읽음 처리.
      await rest.post<ReadResultDto>(
        `/api/conversations/${encodeURIComponent(conversationId)}/read`,
        { memberId, lastReadMessageId }
      )
    },

    onMessage(cb) {
      globalMessageListeners.add(cb)
      return () => globalMessageListeners.delete(cb)
    },

    onStateChange(cb) {
      stateListeners.add(cb)
      return () => stateListeners.delete(cb)
    },

    onError(cb) {
      errorListeners.add(cb)
      return () => errorListeners.delete(cb)
    },
  }
}

/** socket.io path 정규화 — 선행 슬래시 보장, 트레일링 제거(게이트웨이 정확 매칭). */
function normalizePath(raw: string): string {
  const p = (raw || DEFAULT_CHAT_PATH).trim() || DEFAULT_CHAT_PATH
  const lead = p.startsWith('/') ? p : `/${p}`
  const trimmed = lead.replace(/\/+$/, '')
  return trimmed === '' ? DEFAULT_CHAT_PATH : trimmed
}
