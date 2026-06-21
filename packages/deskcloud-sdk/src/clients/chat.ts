/**
 * @heejun/deskcloud — Chat Desk BROWSER client (publishable `pk_` surface).
 *
 * ChatDesk is a multi-tenant messaging service (1:1 DM + group/room chat). It is
 * socket.io-based: the browser connects over a WebSocket to receive live
 * messages / typing / read / presence events, and uses a small REST surface
 * (global prefix `/api`) for history, sending, read-receipts, and conversation
 * creation. This module mirrors ChatDesk's public, *KeyGuard-protected routes
 * plus a thin socket.io wrapper:
 *
 *   REST (pk):
 *   - POST /api/conversations              create DM/group (AnyKeyGuard: pk|sk) → ConversationDto
 *   - GET  /api/conversations?memberId=     my conversations + unread (pk)       → MyConversationsDto
 *   - GET  /api/conversations/:id/messages  history (pk, member-scoped)          → MessageHistoryDto
 *   - POST /api/conversations/:id/messages  send (pk, member-scoped)             → SendResultDto
 *   - POST /api/conversations/:id/read      read receipt (pk)                    → ReadResultDto
 *
 *   WS (pk handshake): connect({ memberId }) returns a live ChatSocket that can
 *   join/leave conversations, relay typing, mark read, and subscribe to
 *   message / message:deleted / typing / read / presence / error events.
 *
 * Auth is handled by the transport for REST (pk sent as `x-pk` header AND `?pk=`
 * query). For the socket handshake the pk is passed via socket.io `auth.key`
 * (the gateway also accepts `?key=`), alongside `memberId` and an optional
 * member `token`. NEVER reference a secret key in this module — admin/system/
 * moderation operations live in '@heejun/deskcloud/server' (createChatAdminClient).
 *
 * socket.io-client is an OPTIONAL peer dependency: it is imported LAZILY via a
 * dynamic `import('socket.io-client')` inside `connect()`, so it never enters
 * the static import graph of this entry. Apps that only use the REST surface do
 * not need it installed; apps that call `connect()` must add it.
 *
 * Domain types are duplicated here (derived from ChatDesk's packages/shared) so
 * the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain enums / primitives (mirrored from @chatdesk/shared)
// ---------------------------------------------------------------------------

/** Conversation kind — `dm` (1:1 direct message) | `group` (room/group chat). */
export type ConversationKind = "dm" | "group";

/** A message attachment — host-supplied file/link metadata (URL is referenced, not hosted). */
export interface Attachment {
  /** Display name. */
  name: string;
  /** Access URL (the host is responsible for it). */
  url: string;
  /** MIME type (optional). */
  contentType?: string;
  /** Byte size (optional). */
  size?: number;
}

// ---------------------------------------------------------------------------
// Domain types (public surface) — mirror @chatdesk/shared DTOs
// ---------------------------------------------------------------------------

/** A single message (history / send result / WS payload). System messages have `senderMemberId: null`. */
export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  /** The sending member. `null` for system messages. */
  senderMemberId: string | null;
  body: string;
  attachments: Attachment[];
  /** Whether this is a system message (notice / automation). */
  system: boolean;
  /** True if moderated/soft-deleted (body blanked, `deleted=true`). */
  deleted: boolean;
  createdAt: string;
}

/** A conversation. */
export interface Conversation {
  id: string;
  tenantId: string;
  kind: ConversationKind;
  title: string | null;
  memberIds: string[];
  createdAt: string;
}

/** A conversation list item — conversation + last-message preview + my unread count. */
export interface ConversationListItem extends Conversation {
  /** The last message (or `null` if none). */
  lastMessage: Message | null;
  /** Unread message count for the requesting member. */
  unreadCount: number;
}

/** "My conversations" response — the requesting member's conversations + unread totals. */
export interface MyConversations {
  memberId: string;
  items: ConversationListItem[];
  /** Sum of unread across all conversations. */
  totalUnread: number;
}

/** Message history response (oldest → newest). */
export interface MessageHistory {
  conversationId: string;
  items: Message[];
  /** Whether an older page exists (use `items[0].id` as the next `before` cursor). */
  hasMore: boolean;
}

/** Send result — the persisted message + number of (socket) subscribers it was delivered to. */
export interface SendResult {
  message: Message;
  /** Number of sockets in the conversation room that received the message. */
  delivered: number;
}

/** Read receipt result — updated state + my refreshed unread count. */
export interface ReadResult {
  conversationId: string;
  memberId: string;
  lastReadMessageId: string | null;
  readAt: string;
  unreadCount: number;
}

/** Presence snapshot — online members in a conversation. */
export interface Presence {
  conversationId: string;
  count: number;
  members: string[];
}

// ---------------------------------------------------------------------------
// Input / param types (public submit surface — server-controlled fields omitted)
// ---------------------------------------------------------------------------

/**
 * Conversation creation payload.
 * - DM: `kind:'dm'` + 1–2 distinct `memberIds`. The same pair is deduped to the existing conversation.
 * - group: `kind:'group'` + 1+ members, optional `title`.
 */
export interface CreateConversationInput {
  kind: ConversationKind;
  /** Group title (optional; ignored for DMs). */
  title?: string;
  /** Member ids participating (host-app user ids). */
  memberIds: string[];
}

/** Message send payload — sender + body (+ optional attachments). Body or attachments required. */
export interface SendMessageInput {
  /** The member sending the message (must be a member of the conversation). */
  senderMemberId: string;
  body: string;
  attachments?: Attachment[];
}

/** Read-receipt payload — which member read up to where. */
export interface ReadReceiptInput {
  memberId: string;
  /** Last read message id. Omit to mark the conversation's latest message as read. */
  lastReadMessageId?: string;
}

/** Params for {@link ChatClient.listConversations}. */
export interface ListConversationsParams {
  /** The member whose conversations + unread to list. */
  memberId: string;
  signal?: AbortSignal;
}

/** Params for {@link ChatClient.getHistory}. */
export interface HistoryParams {
  /** The requesting member (membership is enforced server-side). */
  memberId: string;
  /** Cursor — return messages older than this message id. */
  before?: string;
  /** Page size (1–100). */
  limit?: number;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// WS wire types (mirror @chatdesk/shared wire.ts) + live socket surface
// ---------------------------------------------------------------------------

/** Server → client: typing indicator relay. */
export interface TypingEvent {
  conversationId: string;
  memberId: string;
  typing: boolean;
}

/** Server → client: read-receipt update. */
export interface ReadEvent {
  conversationId: string;
  memberId: string;
  lastReadMessageId: string | null;
  readAt: string;
}

/** Server → client: message deletion (moderation) notice. */
export interface MessageDeletedEvent {
  conversationId: string;
  messageId: string;
}

/** Server → client: presence change (join/leave). */
export interface PresenceDeltaEvent {
  conversationId: string;
  member: string;
  count: number;
}

/** Server → client: error notice (also used on rejected handshake before disconnect). */
export interface ChatErrorEvent {
  code: string;
  message: string;
}

/** Ack returned by the server for join/leave/typing/read actions. */
export type Ack = { ok: true } | { ok: false; code: string; message: string };

/** The set of server→client events a {@link ChatSocket} can subscribe to (typed payload per event). */
export interface ChatServerEvents {
  /** New message (sent or system). */
  message: Message;
  /** Message moderated/deleted. */
  "message:deleted": MessageDeletedEvent;
  /** Typing indicator relay. */
  typing: TypingEvent;
  /** Read-receipt update. */
  read: ReadEvent;
  /** Presence snapshot (emitted to the joining socket right after `join`). */
  "presence:state": Presence;
  /** A member joined the conversation. */
  "presence:join": PresenceDeltaEvent;
  /** A member left the conversation. */
  "presence:leave": PresenceDeltaEvent;
  /** Error notice. */
  error: ChatErrorEvent;
}

/** Options for {@link ChatClient.connect} — the WS handshake. */
export interface ConnectOptions {
  /** The member connecting (sent as the socket.io handshake `memberId`). Required. */
  memberId: string;
  /** Optional hardened-auth member token (`mt_…`) issued by the host server (sk). */
  token?: string;
  /** socket.io mount path on the Desk. Defaults to `/chat` (the gateway default). */
  path?: string;
  /**
   * Extra options forwarded to socket.io-client's `io(url, opts)` (e.g.
   * `transports`, `reconnection`, `withCredentials`). `path`, `auth`, and the
   * pk are managed by the SDK and merged in; conflicting keys are overridden.
   */
  io?: Record<string, unknown>;
}

/**
 * Minimal structural view of a socket.io-client `Socket`, declared locally so
 * this module has NO compile-time dependency on the optional `socket.io-client`
 * peer. Only the members the SDK uses are typed.
 */
interface IoSocketLike {
  readonly id?: string;
  readonly connected: boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener?: (...args: unknown[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

/** Minimal structural view of the `io` factory exported by `socket.io-client`. */
type IoFactory = (uri: string, opts?: Record<string, unknown>) => IoSocketLike;

/** Unsubscribe handle returned by {@link ChatSocket.on}. Call it to remove the listener. */
export type Unsubscribe = () => void;

/**
 * A live chat socket — the realtime half of the Chat client. Wraps a
 * socket.io-client `Socket` connected to the Desk's `/chat` gateway with the
 * member's identity. Use {@link ChatSocket.join} after connecting to receive
 * events for a conversation.
 */
export interface ChatSocket {
  /** The underlying socket id once connected (undefined before connect). */
  readonly id: string | undefined;
  /** Whether the socket is currently connected. */
  readonly connected: boolean;
  /** Join a conversation room to receive its events (membership enforced server-side). */
  join(conversationId: string): Promise<Ack>;
  /** Leave a conversation room. */
  leave(conversationId: string): Promise<Ack>;
  /** Relay a typing start/stop indicator to other members of a conversation. */
  setTyping(conversationId: string, typing: boolean): Promise<Ack>;
  /** Mark read up to a message over the socket (persists + broadcasts a `read` event). */
  markRead(conversationId: string, lastReadMessageId?: string): Promise<Ack>;
  /** Subscribe to a typed server event. Returns an unsubscribe handle. */
  on<E extends keyof ChatServerEvents>(
    event: E,
    listener: (payload: ChatServerEvents[E]) => void,
  ): Unsubscribe;
  /** Fired once the socket (re)connects. */
  onConnect(listener: () => void): Unsubscribe;
  /** Fired when the socket disconnects (with the socket.io reason). */
  onDisconnect(listener: (reason: string) => void): Unsubscribe;
  /** Close the socket and remove all listeners. */
  disconnect(): void;
  /** Escape hatch: the raw socket.io-client `Socket` (typed as `unknown`). */
  readonly raw: unknown;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createChatClient}. Browser-safe (publishable key only). */
export interface ChatClientOptions {
  /** Base URL of the Chat Desk (e.g. 'https://chatdesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Chat Desk client surface (REST + realtime). */
export interface ChatClient {
  // ── REST (pk) ──────────────────────────────────────────────────────────────
  /** Create a DM or group conversation (POST /api/conversations). DMs dedupe on member pair. */
  createConversation(
    input: CreateConversationInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Conversation>;
  /** List the member's conversations with previews + unread (GET /api/conversations?memberId=). */
  listConversations(params: ListConversationsParams): Promise<MyConversations>;
  /** Page through a conversation's message history (GET /api/conversations/:id/messages). */
  getHistory(
    conversationId: string,
    params: HistoryParams,
  ): Promise<MessageHistory>;
  /** Send a message (POST /api/conversations/:id/messages). Broadcasts over WS + persists. */
  sendMessage(
    conversationId: string,
    input: SendMessageInput,
    opts?: { signal?: AbortSignal },
  ): Promise<SendResult>;
  /** Mark read up to a message (POST /api/conversations/:id/read). Refreshes unread. */
  markRead(
    conversationId: string,
    input: ReadReceiptInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ReadResult>;

  // ── Realtime (WS) ────────────────────────────────────────────────────────────
  /**
   * Open a live socket.io connection to the Desk's chat gateway as `memberId`.
   * Lazily imports the optional `socket.io-client` peer (dynamic import), so it
   * stays out of the static bundle. Throws a {@link DeskError}-shaped error if
   * the peer is not installed. Resolves once the socket has connected.
   */
  connect(options: ConnectOptions): Promise<ChatSocket>;
}

// ── WS event-name constants (mirror @chatdesk/shared constants.ts) ──────────────

const WS_CLIENT_EVENTS = {
  join: "join",
  leave: "leave",
  typing: "typing",
  read: "read",
} as const;

const DEFAULT_CHAT_PATH = "/chat";

/** Build the socket.io connection URL by stripping any trailing slashes off the endpoint. */
function wsBase(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

/** Promisified socket.io emit-with-ack for the client→server action events. */
function emitAck(
  socket: IoSocketLike,
  event: string,
  payload: unknown,
): Promise<Ack> {
  return new Promise<Ack>((resolve) => {
    socket.emit(event, payload, (ack: unknown) => {
      if (
        ack &&
        typeof ack === "object" &&
        "ok" in (ack as Record<string, unknown>)
      ) {
        resolve(ack as Ack);
      } else {
        resolve({
          ok: false,
          code: "bad_ack",
          message: "malformed ack from server",
        });
      }
    });
  });
}

/**
 * Create a browser-safe Chat Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const chat = createChatClient({ endpoint, publishableKey })
 *   const convo = await chat.createConversation({ kind: 'dm', memberIds: ['u1', 'u2'] })
 *   const { items } = await chat.getHistory(convo.id, { memberId: 'u1', limit: 30 })
 *   await chat.sendMessage(convo.id, { senderMemberId: 'u1', body: 'hi' })
 *
 *   // realtime (requires the optional `socket.io-client` peer):
 *   const sock = await chat.connect({ memberId: 'u1' })
 *   await sock.join(convo.id)
 *   const off = sock.on('message', (m) => console.log(m.body))
 */
export function createChatClient(opts: ChatClientOptions): ChatClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    // ── REST ──
    createConversation: (input, reqOpts) =>
      t.post<Conversation>("/api/conversations", {
        body: input,
        signal: reqOpts?.signal,
      }),
    listConversations: (params) =>
      t.get<MyConversations>("/api/conversations", {
        query: { memberId: params.memberId },
        signal: params.signal,
      }),
    getHistory: (conversationId, params) =>
      t.get<MessageHistory>(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          query: {
            memberId: params.memberId,
            before: params.before,
            limit: params.limit,
          },
          signal: params.signal,
        },
      ),
    sendMessage: (conversationId, input, reqOpts) =>
      t.post<SendResult>(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        { body: input, signal: reqOpts?.signal },
      ),
    markRead: (conversationId, input, reqOpts) =>
      t.post<ReadResult>(
        `/api/conversations/${encodeURIComponent(conversationId)}/read`,
        {
          body: input,
          signal: reqOpts?.signal,
        },
      ),

    // ── Realtime ──
    connect: async (options): Promise<ChatSocket> => {
      // Lazy, dynamic import keeps socket.io-client out of the static graph and
      // lets REST-only consumers skip installing the optional peer.
      let io: IoFactory;
      try {
        const mod = (await import("socket.io-client")) as {
          io?: IoFactory;
          default?: IoFactory;
        };
        const factory = mod.io ?? mod.default;
        if (typeof factory !== "function") throw new Error("no io export");
        io = factory;
      } catch (err) {
        throw new Error(
          "[@heejun/deskcloud] chat.connect() requires the optional peer dependency 'socket.io-client'. " +
            "Install it (e.g. `npm i socket.io-client`) to use realtime chat. " +
            (err instanceof Error ? `(${err.message})` : ""),
          { cause: err },
        );
      }

      const auth: Record<string, string> = { memberId: options.memberId };
      if (opts.publishableKey) auth.key = opts.publishableKey;
      if (options.token) auth.token = options.token;

      const socket = io(wsBase(opts.endpoint), {
        ...options.io,
        path: options.path ?? DEFAULT_CHAT_PATH,
        auth,
      });

      await new Promise<void>((resolve, reject) => {
        const onConnect = (): void => {
          socket.off("connect", onConnect);
          socket.off("connect_error", onError);
          resolve();
        };
        const onError = (...args: unknown[]): void => {
          socket.off("connect", onConnect);
          socket.off("connect_error", onError);
          const first = args[0];
          const message =
            first instanceof Error
              ? first.message
              : typeof first === "string"
                ? first
                : "socket connection failed";
          reject(
            new Error(
              `[@heejun/deskcloud] chat socket connect failed: ${message}`,
            ),
          );
        };
        socket.on("connect", onConnect);
        socket.on("connect_error", onError);
      });

      const chatSocket: ChatSocket = {
        get id() {
          return socket.id;
        },
        get connected() {
          return socket.connected;
        },
        join: (conversationId) =>
          emitAck(socket, WS_CLIENT_EVENTS.join, { conversationId }),
        leave: (conversationId) =>
          emitAck(socket, WS_CLIENT_EVENTS.leave, { conversationId }),
        setTyping: (conversationId, typing) =>
          emitAck(socket, WS_CLIENT_EVENTS.typing, { conversationId, typing }),
        markRead: (conversationId, lastReadMessageId) =>
          emitAck(socket, WS_CLIENT_EVENTS.read, {
            conversationId,
            lastReadMessageId,
          }),
        on: (event, listener) => {
          const wrapped = (...args: unknown[]): void =>
            listener(args[0] as ChatServerEvents[typeof event]);
          socket.on(event, wrapped);
          return () => {
            socket.off(event, wrapped);
          };
        },
        onConnect: (listener) => {
          const wrapped = (): void => listener();
          socket.on("connect", wrapped);
          return () => {
            socket.off("connect", wrapped);
          };
        },
        onDisconnect: (listener) => {
          const wrapped = (...args: unknown[]): void =>
            listener(String(args[0] ?? "unknown"));
          socket.on("disconnect", wrapped);
          return () => {
            socket.off("disconnect", wrapped);
          };
        },
        disconnect: () => {
          socket.disconnect();
        },
        get raw() {
          return socket;
        },
      };

      return chatSocket;
    },
  };
}
