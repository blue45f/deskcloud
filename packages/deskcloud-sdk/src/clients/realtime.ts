/**
 * @heejun/deskcloud — Realtime Desk BROWSER client (publishable `pk_` surface).
 *
 * RealtimeDesk is a multi-tenant realtime (WebSocket pub/sub + presence) service.
 * The browser uses its publishable key (`pk_…`) to:
 *   - open a socket.io connection (handshake auth = pk + Origin allowlist),
 *   - subscribe / unsubscribe to channels and receive `message` events,
 *   - read / track presence (count + members) per channel,
 *   - read recent channel history over REST (PublishableKeyGuard):
 *       GET  /api/channels/:channel/history  → HistoryDto
 *   - and (public, unguarded) self-signup for a tenant key pair:
 *       POST /api/tenants                    → TenantWithSecret
 *
 * The Desk's guards read the key from the `X-Realtime-Key` header. The shared
 * transport already sends the publishable key as `x-pk` + `?pk=`; we ALSO bridge
 * it to `X-Realtime-Key` via the transport's `defaultHeaders` so this Desk's
 * PublishableKeyGuard accepts it. Auth is otherwise handled by the transport —
 * NEVER reference a secret key here (admin lives in '@heejun/deskcloud/server').
 *
 * socket.io-client is an OPTIONAL peer dependency. It is imported LAZILY via a
 * dynamic `import('socket.io-client')` the first time `connect()` is called, so
 * it stays OUT of the static import graph of the main browser entry and the SDK
 * has no hard runtime dependency on it. If it is not installed, `connect()`
 * rejects with a clear DeskError-shaped message.
 *
 * Domain types are duplicated here (derived from RealtimeDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @realtimedesk/shared — public surface only)
// ---------------------------------------------------------------------------

/** Tenant billing plan. `free` is subject to a soft usage cap. */
export type RealtimePlan = "free" | "pro";

/** A single realtime message (history item / WS `message` payload). */
export interface RealtimeMessage {
  id: string;
  tenantId: string;
  channel: string;
  event: string;
  /** Arbitrary JSON payload published by the server. */
  data: unknown;
  /** ISO timestamp. */
  publishedAt: string;
}

/** Channel history response (oldest → newest). */
export interface ChannelHistory {
  channel: string;
  items: RealtimeMessage[];
}

/** Presence snapshot for a channel — participant count + member identifiers. */
export interface ChannelPresence {
  channel: string;
  count: number;
  /** Connected socket/member identifiers. */
  members: string[];
}

/** Presence delta (a member joined or left a channel). */
export interface PresenceDelta {
  channel: string;
  member: string;
  count: number;
}

/** Realtime usage counters for a tenant. */
export interface RealtimeUsage {
  messages: number;
  connections: number;
  cap: { messages: number; connections: number };
}

/** Public tenant representation (secret hash never exposed). */
export interface RealtimeTenant {
  id: string;
  name: string;
  publishableKey: string;
  corsOrigins: string[];
  plan: RealtimePlan;
  usage: RealtimeUsage;
  /** ISO timestamp. */
  createdAt: string;
}

/**
 * Signup / rotate response — a {@link RealtimeTenant} PLUS the plaintext secret
 * key, exposed exactly ONCE (the DB stores only its hash thereafter).
 */
export interface RealtimeTenantWithSecret extends RealtimeTenant {
  /** Plaintext secret key (`sk_…`). Store securely; not retrievable again. */
  secretKey: string;
}

// ---------------------------------------------------------------------------
// Input / param types
// ---------------------------------------------------------------------------

/** Public tenant signup payload (POST /api/tenants — unguarded). */
export interface SignupInput {
  name: string;
  /** WS-handshake / pk-route Origin allowlist. Omit ⇒ ['*'] (demo). */
  corsOrigins?: string[];
  /** Plan (defaults to 'free'). */
  plan?: RealtimePlan;
}

/** Params for {@link RealtimeClient.getHistory}. */
export interface GetHistoryParams {
  /** Channel name (e.g. 'room:42'). */
  channel: string;
  /** Max items to return (1..200). */
  limit?: number;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Realtime (WebSocket) wire types & connection surface
// ---------------------------------------------------------------------------

/** WS server → client event names (mirrors @realtimedesk/shared). */
export const REALTIME_SERVER_EVENTS = {
  message: "message",
  presenceState: "presence:state",
  presenceJoin: "presence:join",
  presenceLeave: "presence:leave",
  error: "error",
} as const;

/** WS client → server event names. */
export const REALTIME_CLIENT_EVENTS = {
  subscribe: "subscribe",
  unsubscribe: "unsubscribe",
  presence: "presence",
} as const;

/** Default socket.io mount path on the Desk (trailing slash intentionally absent). */
export const REALTIME_DEFAULT_PATH = "/realtime";

/** Server → client error notification. */
export interface RealtimeServerError {
  code: string;
  message: string;
}

/** subscribe / unsubscribe / presence ack returned by the server. */
export type RealtimeAck =
  | { ok: true }
  | { ok: false; code: string; message: string };

/** Options for {@link RealtimeClient.connect}. */
export interface ConnectOptions {
  /**
   * socket.io mount path on the Desk. Defaults to {@link REALTIME_DEFAULT_PATH}
   * ('/realtime'). Must match the Desk's `REALTIME_PATH` (no trailing slash).
   */
  path?: string;
  /**
   * Extra options forwarded verbatim to socket.io-client's `io(url, opts)`
   * (e.g. `transports`, `reconnection`, `withCredentials`). The publishable
   * key is always injected as `auth.key`; do not override it.
   */
  socketOptions?: Record<string, unknown>;
}

/**
 * A live realtime connection. Thin, typed wrapper over a socket.io-client
 * `Socket` (kept as `unknown` internally so socket.io-client stays out of the
 * static type graph too — the methods below are the supported surface).
 */
export interface RealtimeConnection {
  /** Underlying socket.io-client socket id once connected (else undefined). */
  readonly id: string | undefined;
  /** True once the underlying socket reports `connected`. */
  readonly connected: boolean;
  /** Subscribe to a channel; resolves with the server ack. */
  subscribe(channel: string): Promise<RealtimeAck>;
  /** Unsubscribe from a channel; resolves with the server ack. */
  unsubscribe(channel: string): Promise<RealtimeAck>;
  /** Fetch a fresh presence snapshot for a channel over the socket. */
  presence(channel: string): Promise<ChannelPresence>;
  /** Listen for published messages (server `message` event). Returns an unsubscribe fn. */
  onMessage(handler: (msg: RealtimeMessage) => void): () => void;
  /** Listen for the presence snapshot sent right after subscribe. Returns an unsubscribe fn. */
  onPresenceState(handler: (snapshot: ChannelPresence) => void): () => void;
  /** Listen for a member joining a channel. Returns an unsubscribe fn. */
  onPresenceJoin(handler: (delta: PresenceDelta) => void): () => void;
  /** Listen for a member leaving a channel. Returns an unsubscribe fn. */
  onPresenceLeave(handler: (delta: PresenceDelta) => void): () => void;
  /** Listen for server-side error notifications. Returns an unsubscribe fn. */
  onError(handler: (err: RealtimeServerError) => void): () => void;
  /** Listen for the low-level socket `connect` event. Returns an unsubscribe fn. */
  onConnect(handler: () => void): () => void;
  /** Listen for the low-level socket `disconnect` event. Returns an unsubscribe fn. */
  onDisconnect(handler: (reason: string) => void): () => void;
  /** Close the connection and release the socket. */
  close(): void;
}

/** Minimal structural shape of a socket.io-client `Socket` we rely on. */
interface SocketLike {
  id?: string;
  connected?: boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener: (...args: unknown[]) => void): unknown;
  emit(event: string, ...args: unknown[]): unknown;
  disconnect(): unknown;
}

/** Minimal structural shape of the socket.io-client module's `io` factory. */
interface SocketIoModule {
  io: (url: string, opts?: Record<string, unknown>) => SocketLike;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createRealtimeClient}. Browser-safe (publishable key only). */
export interface RealtimeClientOptions {
  /** Base URL of the Realtime Desk (e.g. 'https://realtimedesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Realtime Desk client surface. */
export interface RealtimeClient {
  /**
   * Open a live socket.io connection authenticated with the publishable key.
   * Lazily (dynamically) imports the optional `socket.io-client` peer dep — if
   * it is not installed, this rejects with a clear error. Resolves once the
   * socket emits `connect`.
   */
  connect(opts?: ConnectOptions): Promise<RealtimeConnection>;
  /** Recent messages for a channel, oldest → newest (GET /api/channels/:channel/history). */
  getHistory(params: GetHistoryParams): Promise<ChannelHistory>;
  /**
   * Public tenant self-signup — issues a new pk/sk key pair (POST /api/tenants).
   * The secret key is returned in plaintext exactly once; store it server-side.
   */
  signup(
    input: SignupInput,
    opts?: { signal?: AbortSignal },
  ): Promise<RealtimeTenantWithSecret>;
}

/**
 * Create a browser-safe Realtime Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const rt = createRealtimeClient({ endpoint, publishableKey })
 *   const conn = await rt.connect()
 *   conn.onMessage((m) => console.log(m.event, m.data))
 *   await conn.subscribe('room:42')
 *   const past = await rt.getHistory({ channel: 'room:42', limit: 50 })
 */
export function createRealtimeClient(
  opts: RealtimeClientOptions,
): RealtimeClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
    // This Desk's PublishableKeyGuard reads the key from `X-Realtime-Key`.
    ...(opts.publishableKey
      ? { defaultHeaders: { "x-realtime-key": opts.publishableKey } }
      : {}),
  });

  return {
    connect: (connOpts) =>
      openConnection(t.endpoint, opts.publishableKey, connOpts),
    getHistory: (params) =>
      t.get<ChannelHistory>(
        `/api/channels/${encodeURIComponent(params.channel)}/history`,
        { query: { limit: params.limit }, signal: params.signal },
      ),
    signup: (input, reqOpts) =>
      t.post<RealtimeTenantWithSecret>("/api/tenants", {
        body: input,
        signal: reqOpts?.signal,
      }),
  };
}

// ---------------------------------------------------------------------------
// Connection (lazy socket.io-client)
// ---------------------------------------------------------------------------

const PEER_DEP_HINT =
  "Realtime connect() requires the optional peer dependency 'socket.io-client'. " +
  "Install it: npm i socket.io-client";

/** Dynamically load the optional socket.io-client peer dep (kept out of the static graph). */
async function loadSocketIo(): Promise<SocketIoModule> {
  let mod: unknown;
  try {
    // Dynamic import so bundlers don't pull socket.io-client into the main entry.
    mod = await import(
      /* @vite-ignore */ /* webpackIgnore: true */ "socket.io-client"
    );
  } catch (err) {
    throw new Error(
      `${PEER_DEP_HINT} (import failed: ${err instanceof Error ? err.message : String(err)})`,
      { cause: err },
    );
  }
  const candidate = mod as Partial<SocketIoModule> & {
    default?: Partial<SocketIoModule>;
  };
  const io = candidate.io ?? candidate.default?.io;
  if (typeof io !== "function") {
    throw new Error(`${PEER_DEP_HINT} (loaded module has no 'io' export)`);
  }
  return { io };
}

async function openConnection(
  endpoint: string,
  publishableKey: string | undefined,
  connOpts: ConnectOptions | undefined,
): Promise<RealtimeConnection> {
  const { io } = await loadSocketIo();
  const path = connOpts?.path ?? REALTIME_DEFAULT_PATH;

  const socket = io(endpoint, {
    path,
    autoConnect: true,
    transports: ["websocket"],
    ...connOpts?.socketOptions,
    // pk is injected as the handshake auth key — never overridable.
    auth: { key: publishableKey },
  });

  await new Promise<void>((resolve, reject) => {
    const onConnect = (): void => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      resolve();
    };
    const onConnectError = (...args: unknown[]): void => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      const first = args[0];
      reject(
        first instanceof Error
          ? first
          : new Error(
              typeof first === "string" ? first : "socket connect_error",
            ),
      );
    };
    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
  });

  return wrapSocket(socket);
}

/** Emit an event and resolve with the server's ack (callback-style). */
function emitWithAck<T>(
  socket: SocketLike,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise<T>((resolve) => {
    socket.emit(event, payload, (ack: unknown) => resolve(ack as T));
  });
}

/** Register a typed listener and return an unsubscribe fn. */
function listen<T>(
  socket: SocketLike,
  event: string,
  handler: (payload: T) => void,
): () => void {
  const wrapped = (...args: unknown[]): void => handler(args[0] as T);
  socket.on(event, wrapped);
  return () => {
    socket.off(event, wrapped);
  };
}

function wrapSocket(socket: SocketLike): RealtimeConnection {
  return {
    get id() {
      return socket.id;
    },
    get connected() {
      return socket.connected === true;
    },
    subscribe: (channel) =>
      emitWithAck<RealtimeAck>(socket, REALTIME_CLIENT_EVENTS.subscribe, {
        channel,
      }),
    unsubscribe: (channel) =>
      emitWithAck<RealtimeAck>(socket, REALTIME_CLIENT_EVENTS.unsubscribe, {
        channel,
      }),
    presence: (channel) =>
      emitWithAck<ChannelPresence>(socket, REALTIME_CLIENT_EVENTS.presence, {
        channel,
      }),
    onMessage: (handler) =>
      listen<RealtimeMessage>(socket, REALTIME_SERVER_EVENTS.message, handler),
    onPresenceState: (handler) =>
      listen<ChannelPresence>(
        socket,
        REALTIME_SERVER_EVENTS.presenceState,
        handler,
      ),
    onPresenceJoin: (handler) =>
      listen<PresenceDelta>(
        socket,
        REALTIME_SERVER_EVENTS.presenceJoin,
        handler,
      ),
    onPresenceLeave: (handler) =>
      listen<PresenceDelta>(
        socket,
        REALTIME_SERVER_EVENTS.presenceLeave,
        handler,
      ),
    onError: (handler) =>
      listen<RealtimeServerError>(
        socket,
        REALTIME_SERVER_EVENTS.error,
        handler,
      ),
    onConnect: (handler) => listen<void>(socket, "connect", () => handler()),
    onDisconnect: (handler) =>
      listen<string>(socket, "disconnect", (reason) => handler(reason)),
    close: () => {
      socket.disconnect();
    },
  };
}
