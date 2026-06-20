/**
 * RealtimeDesk — 단일 파일 벤더링 컴포넌트 (의존성: react + socket.io-client).
 * ──────────────────────────────────────────────────────────────────────────
 * npm publish 가 막힌 동안 형제 앱에 그대로 복붙해서 쓰는 버전입니다.
 * 워크스페이스 의존(@realtimedesk/sdk·shared) 0 — 필요한 클라이언트·상수·스타일을 인라인했습니다.
 * 동작/디자인은 @realtimedesk/widget 의 <PresenceBar> 와 동일합니다.
 *
 * 설치(소비 앱):  pnpm add socket.io-client   # react 는 이미 있다고 가정
 *
 * 사용:
 *   import { PresenceBar, useRealtime } from './PresenceBar'
 *   <PresenceBar channel="room:42" publishableKey="pk_..." endpoint="https://realtime.example.com" />
 *
 * 백엔드 계약(공개 — publishable 키 + Origin):
 *   WS  {endpoint}{path=/realtime}   socket.io, handshake auth.key = pk_…
 *     → emit 'subscribe' {channel} (ack)
 *     → on  'presence:state' {channel,count,members}
 *     → on  'presence:join' / 'presence:leave' {channel,member,count}
 *     → on  'message' {id,tenantId,channel,event,data,publishedAt}
 *
 * 접근성/디자인: focus-visible · prefers-reduced-motion · 대비 ≥4.5:1 ·
 * 그라디언트 텍스트/글래스모피즘/사이드스트라이프 없음 · 외부 CSS 프레임워크 0.
 * ──────────────────────────────────────────────────────────────────────────
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

/* ============================ 와이어 계약(인라인) ============================ */

const CLIENT_EVENTS = {
  subscribe: "subscribe",
  unsubscribe: "unsubscribe",
  presence: "presence",
} as const;
const SERVER_EVENTS = {
  message: "message",
  presenceState: "presence:state",
  presenceJoin: "presence:join",
  presenceLeave: "presence:leave",
  error: "error",
} as const;
const AUTH_KEY = "key";
const DEFAULT_PATH = "/realtime";

export interface MessageDto {
  id: string;
  tenantId: string;
  channel: string;
  event: string;
  data: unknown;
  publishedAt: string;
}
export interface PresenceDto {
  channel: string;
  count: number;
  members: string[];
}
interface PresenceDelta {
  channel: string;
  member: string;
  count: number;
}
interface ServerError {
  code: string;
  message: string;
}
type Ack = { ok: true } | { ok: false; code: string; message: string };
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/* ============================ 인라인 RealtimeClient ============================ */

type MessageHandler = (m: MessageDto) => void;
type PresenceHandler = (p: PresenceDto) => void;

interface ChannelState {
  messageHandlers: Set<MessageHandler>;
  presenceHandlers: Set<PresenceHandler>;
  lastPresence: PresenceDto;
}

function normalizePath(raw: string): string {
  const trimmed = raw.trim() || DEFAULT_PATH;
  const lead = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const noTrail = lead.replace(/\/+$/, "");
  return noTrail === "" ? DEFAULT_PATH : noTrail;
}
function isAckErr(
  v: unknown,
): v is { ok: false; code: string; message: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "ok" in v &&
    (v as { ok: unknown }).ok === false
  );
}

class RealtimeClient {
  private readonly endpoint: string;
  private readonly publishableKey: string;
  private readonly path: string;
  private socket: Socket | null = null;
  private status: ConnectionStatus = "idle";
  private readonly channels = new Map<string, ChannelState>();
  private readonly statusHandlers = new Set<(s: ConnectionStatus) => void>();
  private readonly errorHandlers = new Set<(e: ServerError) => void>();

  constructor(opts: {
    publishableKey: string;
    endpoint: string;
    path?: string;
  }) {
    this.publishableKey = opts.publishableKey;
    this.endpoint = opts.endpoint.replace(/\/+$/, "");
    this.path = normalizePath(opts.path ?? DEFAULT_PATH);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }
  isConnected(): boolean {
    return this.status === "connected" && this.socket?.connected === true;
  }

  connect(): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    if (this.socket) this.teardown();
    this.setStatus("connecting");
    const socket = io(this.endpoint, {
      path: this.path,
      transports: ["websocket", "polling"],
      auth: { [AUTH_KEY]: this.publishableKey },
      withCredentials: true,
    });
    this.socket = socket;
    this.wire(socket);
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let graceTimer: ReturnType<typeof setTimeout> | undefined;
      const done = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        if (graceTimer) clearTimeout(graceTimer);
        socket.off("connect", onConnect);
        socket.off(SERVER_EVENTS.error, onError);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnErr);
        fn();
      };
      // 전송 'connect' 는 서버 인증보다 먼저 올 수 있어, 짧은 유예창 동안 거부(error·
      // disconnect)를 기다린 뒤 resolve 한다.
      const onConnect = (): void => {
        if (settled) return;
        graceTimer = setTimeout(() => done(resolve), 250);
      };
      const onError = (e: ServerError): void =>
        done(() => reject(new Error(`${e.code}: ${e.message}`)));
      const onDisconnect = (reason: string): void =>
        done(() => reject(new Error(`handshake_rejected: ${reason}`)));
      const onConnErr = (e: Error): void => done(() => reject(e));
      socket.on("connect", onConnect);
      socket.on(SERVER_EVENTS.error, onError);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnErr);
    });
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    const st = this.ensure(channel);
    st.messageHandlers.add(handler);
    void this.joinIfConnected(channel);
    return () => st.messageHandlers.delete(handler);
  }

  onPresence(channel: string, handler: PresenceHandler): () => void {
    const st = this.ensure(channel);
    st.presenceHandlers.add(handler);
    void this.joinIfConnected(channel);
    if (st.lastPresence.count > 0) handler(st.lastPresence);
    return () => st.presenceHandlers.delete(handler);
  }

  onStatus(handler: (s: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }
  onError(handler: (e: ServerError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  async unsubscribeChannel(channel: string): Promise<void> {
    const st = this.channels.get(channel);
    if (!st) return;
    if (st.messageHandlers.size === 0 && st.presenceHandlers.size === 0) {
      this.channels.delete(channel);
      const socket = this.socket;
      if (socket && this.isConnected()) {
        await new Promise<void>((resolve) =>
          socket
            .timeout(8000)
            .emit(CLIENT_EVENTS.unsubscribe, { channel }, () => resolve()),
        );
      }
    }
  }

  close(): void {
    this.teardown();
    this.channels.clear();
    this.setStatus("idle");
  }

  private ensure(channel: string): ChannelState {
    let st = this.channels.get(channel);
    if (!st) {
      st = {
        messageHandlers: new Set(),
        presenceHandlers: new Set(),
        lastPresence: { channel, count: 0, members: [] },
      };
      this.channels.set(channel, st);
    }
    return st;
  }

  private async joinIfConnected(channel: string): Promise<void> {
    if (!this.socket) {
      try {
        await this.connect();
      } catch {
        return;
      }
    }
    if (!this.isConnected()) return;
    await this.emitSubscribe(channel);
  }

  private emitSubscribe(channel: string): Promise<void> {
    const socket = this.socket;
    if (!socket) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      socket
        .timeout(8000)
        .emit(
          CLIENT_EVENTS.subscribe,
          { channel },
          (timeoutErr: Error | null, ack: Ack) => {
            if (timeoutErr) return reject(timeoutErr);
            if (isAckErr(ack)) return reject(new Error(ack.message));
            resolve();
          },
        );
    });
  }

  private wire(socket: Socket): void {
    socket.on("connect", () => {
      this.setStatus("connected");
      for (const ch of this.channels.keys())
        void this.emitSubscribe(ch).catch(() => undefined);
    });
    socket.on("disconnect", () => {
      if (this.status !== "idle") this.setStatus("disconnected");
    });
    socket.on(SERVER_EVENTS.message, (m: MessageDto) => {
      const st = this.channels.get(m.channel);
      if (st) for (const h of st.messageHandlers) h(m);
    });
    socket.on(SERVER_EVENTS.presenceState, (snap: PresenceDto) => {
      const st = this.ensure(snap.channel);
      st.lastPresence = snap;
      for (const h of st.presenceHandlers) h(snap);
    });
    socket.on(SERVER_EVENTS.presenceJoin, (d: PresenceDelta) =>
      this.applyDelta(d, "join"),
    );
    socket.on(SERVER_EVENTS.presenceLeave, (d: PresenceDelta) =>
      this.applyDelta(d, "leave"),
    );
    socket.on(SERVER_EVENTS.error, (e: ServerError) => {
      this.setStatus("error");
      for (const h of this.errorHandlers) h(e);
    });
  }

  private applyDelta(d: PresenceDelta, kind: "join" | "leave"): void {
    const st = this.channels.get(d.channel);
    if (!st) return;
    const members = new Set(st.lastPresence.members);
    if (kind === "join") members.add(d.member);
    else members.delete(d.member);
    const next: PresenceDto = {
      channel: d.channel,
      count: d.count,
      members: [...members],
    };
    st.lastPresence = next;
    for (const h of st.presenceHandlers) h(next);
  }

  private setStatus(s: ConnectionStatus): void {
    if (this.status === s) return;
    this.status = s;
    for (const h of this.statusHandlers) h(s);
  }

  private teardown(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

/* ============================ useRealtime 훅 ============================ */

export interface UseRealtimeOptions {
  publishableKey: string;
  endpoint: string;
  path?: string;
  maxMessages?: number;
}

export interface UseRealtimeResult {
  status: ConnectionStatus;
  presence: PresenceDto;
  messages: MessageDto[];
  connected: boolean;
}

const EMPTY: MessageDto[] = [];

export function useRealtime(
  channel: string,
  options: UseRealtimeOptions,
): UseRealtimeResult {
  const { publishableKey, endpoint, path, maxMessages = 50 } = options;

  const client = useMemo(
    () => new RealtimeClient({ publishableKey, endpoint, path }),
    [publishableKey, endpoint, path],
  );

  const [status, setStatus] = useState<ConnectionStatus>(() =>
    client.getStatus(),
  );
  const [presence, setPresence] = useState<PresenceDto>({
    channel,
    count: 0,
    members: [],
  });
  const [messages, setMessages] = useState<MessageDto[]>(EMPTY);
  const maxRef = useRef(maxMessages);
  maxRef.current = maxMessages;

  useEffect(() => {
    const off = client.onStatus(setStatus);
    return () => {
      off();
      client.close();
    };
  }, [client]);

  useEffect(() => {
    let active = true;
    setPresence({ channel, count: 0, members: [] });
    setMessages(EMPTY);
    const offP = client.onPresence(channel, (p) => {
      if (active) setPresence(p);
    });
    const offM = client.subscribe(channel, (m) => {
      if (!active) return;
      const limit = maxRef.current;
      if (limit <= 0) return;
      setMessages((prev) => {
        const next =
          prev.length >= limit
            ? prev.slice(prev.length - limit + 1)
            : prev.slice();
        next.push(m);
        return next;
      });
    });
    void client.connect().catch(() => undefined);
    return () => {
      active = false;
      offP();
      offM();
      void client.unsubscribeChannel(channel);
    };
  }, [client, channel]);

  return { status, presence, messages, connected: status === "connected" };
}

/* ============================ 스타일(스코프 CSS) ============================ */

const DEFAULT_ACCENT = "#2f5fe0";
const DEFAULT_ACCENT_INK = "#ffffff";
const STYLE_ID = "realtimedesk-widget-styles";

function ensureStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID))
    return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = WIDGET_CSS;
  document.head.appendChild(el);
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 52% 38%)`;
}
function avatarInitial(seed: string): string {
  const t = seed.replace(/[^A-Za-z0-9]/g, "");
  return (t[0] ?? "?").toUpperCase();
}

const WIDGET_CSS = `
.rt-root, .rt-root * { box-sizing: border-box; }
.rt-root {
  --rt-accent: ${DEFAULT_ACCENT};
  --rt-accent-ink: ${DEFAULT_ACCENT_INK};
  --rt-ink: #1a1d23; --rt-ink-soft: #4a4f57; --rt-muted: #6b7280;
  --rt-surface: #ffffff; --rt-surface-2: #f4f5f7; --rt-border: #d7dae0;
  --rt-online: #16a34a; --rt-offline: #9ca3af;
  --rt-shadow: 0 1px 2px rgba(16,24,40,.06), 0 8px 24px -10px rgba(16,24,40,.18);
  --rt-ease: cubic-bezier(.22,1,.36,1);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--rt-ink); line-height: 1.5; display: inline-flex;
}
.rt-bar {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 6px 14px 6px 8px; background: var(--rt-surface);
  border: 1px solid var(--rt-border); border-radius: 999px;
  box-shadow: var(--rt-shadow); font-size: 13px; max-width: 100%;
}
.rt-status { display: inline-flex; align-items: center; gap: 6px; padding-left: 4px; flex: none; }
.rt-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--rt-offline); flex: none; position: relative; }
.rt-dot.rt-live { background: var(--rt-online); }
.rt-dot.rt-live::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid var(--rt-online); opacity: .55; animation: rt-ping 1.8s var(--rt-ease) infinite; }
.rt-status-label { font-size: 11px; font-weight: 600; color: var(--rt-muted); letter-spacing: .01em; }
.rt-avatars { display: inline-flex; align-items: center; padding-left: 2px; }
.rt-avatar { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--rt-surface); margin-left: -8px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex: none; user-select: none; animation: rt-pop .22s var(--rt-ease); }
.rt-avatar:first-child { margin-left: 0; }
.rt-avatar-more { background: var(--rt-surface-2); color: var(--rt-ink-soft); border-color: var(--rt-surface); }
.rt-count { font-size: 13px; font-weight: 600; color: var(--rt-ink); white-space: nowrap; }
.rt-count-num { color: var(--rt-accent); }
.rt-empty { color: var(--rt-muted); font-weight: 500; }
.rt-root :focus { outline: none; }
.rt-root :focus-visible { outline: 2px solid var(--rt-accent); outline-offset: 2px; border-radius: 8px; }
@keyframes rt-ping { 0% { transform: scale(.8); opacity: .55; } 80%,100% { transform: scale(1.9); opacity: 0; } }
@keyframes rt-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .rt-root *, .rt-avatar, .rt-dot.rt-live::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
`;

/* ============================ <PresenceBar> ============================ */

export interface PresenceBarProps {
  channel: string;
  publishableKey: string;
  endpoint: string;
  path?: string;
  maxAvatars?: number;
  accent?: string;
  accentInk?: string;
  showStatus?: boolean;
  formatCount?: (count: number) => string;
  labelFor?: (member: string) => string;
}

const DEFAULT_FORMAT = (count: number): string =>
  count === 0 ? "아무도 없음" : `${count}명 접속 중`;

export function PresenceBar(props: PresenceBarProps): ReactElement {
  const {
    channel,
    publishableKey,
    endpoint,
    path,
    maxAvatars = 5,
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    showStatus = true,
    formatCount = DEFAULT_FORMAT,
    labelFor,
  } = props;

  const { status, presence, connected } = useRealtime(channel, {
    publishableKey,
    endpoint,
    path,
    maxMessages: 0,
  });

  useEffect(() => {
    ensureStyles();
  }, []);

  const rootStyle = {
    "--rt-accent": accent,
    "--rt-accent-ink": accentInk,
  } as CSSProperties;

  const visible = presence.members.slice(0, Math.max(0, maxAvatars));
  const overflow = Math.max(0, presence.count - visible.length);
  const label = (m: string): string => (labelFor ? labelFor(m) : m);

  return (
    <div className="rt-root" style={rootStyle}>
      <div className="rt-bar">
        {showStatus ? (
          <span className="rt-status">
            <span
              className={`rt-dot${connected ? " rt-live" : ""}`}
              aria-hidden="true"
            />
            <span className="rt-status-label">
              {status === "connected"
                ? "LIVE"
                : status === "connecting"
                  ? "연결 중"
                  : "오프라인"}
            </span>
          </span>
        ) : null}

        {presence.count > 0 ? (
          <span className="rt-avatars" aria-hidden="true">
            {visible.map((member) => (
              <span
                key={member}
                className="rt-avatar"
                style={{ background: avatarColor(member) }}
                title={label(member)}
              >
                {avatarInitial(label(member))}
              </span>
            ))}
            {overflow > 0 ? (
              <span
                className="rt-avatar rt-avatar-more"
                title={`외 ${overflow}명`}
              >
                +{overflow}
              </span>
            ) : null}
          </span>
        ) : null}

        <span
          className={`rt-count${presence.count === 0 ? " rt-empty" : ""}`}
          role="status"
          aria-live="polite"
        >
          {presence.count > 0 ? (
            <>
              <span className="rt-count-num">{presence.count}</span>
              {formatCount(presence.count).replace(String(presence.count), "")}
            </>
          ) : (
            formatCount(0)
          )}
        </span>
      </div>
    </div>
  );
}

export default PresenceBar;

// (참고) ReactNode 는 일부 빌드 설정에서 미사용 import 경고를 피하기 위한 재노출입니다.
export type VendorReactNode = ReactNode;
