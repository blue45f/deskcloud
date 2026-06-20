/**
 * RealtimeClient — 브라우저용 클라이언트(publishable 키, pk_).
 *
 * socket.io-client 를 얇게 감싸 connect / subscribe / unsubscribe / presence / close 만
 * 노출한다. 핸드셰이크는 pk(`auth.key`) + Origin(브라우저가 자동 전송)으로 인증되며,
 * 서버 게이트웨이는 `REALTIME_PATH`(기본 /realtime)에 정확 매칭으로 마운트되어 있다.
 *
 * 의존성 — 런타임은 socket.io-client(peer) 하나, 타입은 @realtimedesk/shared 에서만 가져온다.
 * (shared 의 키/해시 헬퍼는 node:crypto 를 쓰므로 브라우저 번들에 절대 끌어오지 않는다 →
 *  여기서는 `import type` 으로 타입만, 이벤트 이름 상수는 이 파일에 인라인한다.)
 */
import { io, type Socket } from "socket.io-client";

import type {
  Ack,
  MessageDto,
  PresenceDto,
  ServerErrorEvent,
  ServerPresenceDeltaEvent,
} from "@realtimedesk/shared";

export type {
  Ack,
  MessageDto,
  PresenceDto,
  ServerErrorEvent,
  ServerPresenceDeltaEvent,
};

/**
 * 와이어 이벤트 이름 — @realtimedesk/shared 의 WS_CLIENT_EVENTS / WS_SERVER_EVENTS 와 동일.
 * shared 진입점이 node:crypto(keys.ts)를 함께 export 하므로, 브라우저 번들 오염을 피하려
 * 상수만 이 파일에 복제한다(계약은 shared 가 단일 출처, 변경 시 양쪽 동기화).
 */
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

/** 채널 메시지 핸들러. */
export type MessageHandler = (message: MessageDto) => void;
/** presence 변경(스냅샷·join·leave) 핸들러. */
export type PresenceHandler = (state: PresenceDto) => void;
/** 연결 상태 변화 핸들러. */
export type StatusHandler = (status: ConnectionStatus) => void;
/** 서버 오류(잘못된 키·Origin 등) 핸들러. */
export type ErrorHandler = (error: ServerErrorEvent) => void;

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface RealtimeClientOptions {
  /** publishable 키(pk_…). 브라우저 노출용. */
  publishableKey: string;
  /** API 베이스 URL. 예: 'https://realtime.example.com' (끝의 / 는 무시). */
  endpoint: string;
  /** socket.io 마운트 경로. 기본 '/realtime'(서버 REALTIME_PATH 와 일치해야 함). */
  path?: string;
  /** 자동 재연결 여부. 기본 true. */
  autoReconnect?: boolean;
  /** 전송 방식. 기본 ['websocket','polling'](게이트웨이 호환). */
  transports?: Array<"websocket" | "polling">;
}

/** subscribe 가 돌려주는 구독 핸들 — 콜백 해제 + 채널 떠나기. */
export interface Subscription {
  /** 채널 이름. */
  readonly channel: string;
  /** 이 구독의 메시지 콜백만 해제(채널은 유지). */
  off: () => void;
  /** 채널을 떠나고(unsubscribe) 콜백을 해제한다. */
  unsubscribe: () => Promise<void>;
}

/** presence 구독 핸들 — presence 변경 콜백 해제. */
export interface PresenceSubscription {
  readonly channel: string;
  off: () => void;
}

/** subscribe/unsubscribe 가 거부됐을 때 던지는 에러. */
export class RealtimeAckError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RealtimeAckError";
  }
}

interface ChannelState {
  messageHandlers: Set<MessageHandler>;
  presenceHandlers: Set<PresenceHandler>;
  /** 마지막으로 알려진 presence(스냅샷·delta 적용 결과). */
  lastPresence: PresenceDto;
}

const isBrowser = typeof window !== "undefined";

/**
 * RealtimeClient 를 생성한다(아직 연결하지 않음 — `connect()` 호출 필요).
 *
 *   const rt = createRealtimeClient({ publishableKey: 'pk_…', endpoint: 'https://…' })
 *   await rt.connect()
 *   const sub = rt.subscribe('room:42', (msg) => console.log(msg))
 *   rt.presence('room:42', (p) => console.log(p.count, p.members))
 *   // …
 *   rt.close()
 */
export function createRealtimeClient(
  options: RealtimeClientOptions,
): RealtimeClient {
  return new RealtimeClient(options);
}

export class RealtimeClient {
  private readonly endpoint: string;
  private readonly publishableKey: string;
  private readonly path: string;
  private readonly autoReconnect: boolean;
  private readonly transports: Array<"websocket" | "polling">;

  private socket: Socket | null = null;
  private status: ConnectionStatus = "idle";
  private readonly channels = new Map<string, ChannelState>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private readonly errorHandlers = new Set<ErrorHandler>();

  constructor(options: RealtimeClientOptions) {
    if (!options.publishableKey?.startsWith("pk_")) {
      throw new Error("publishableKey 는 'pk_' 로 시작해야 합니다");
    }
    this.publishableKey = options.publishableKey;
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.path = normalizePath(options.path ?? DEFAULT_PATH);
    this.autoReconnect = options.autoReconnect ?? true;
    this.transports = options.transports ?? ["websocket", "polling"];
  }

  /** 현재 연결 상태. */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** 연결되어 있는지(소켓이 살아 있고 핸드셰이크 통과). */
  isConnected(): boolean {
    return this.status === "connected" && this.socket?.connected === true;
  }

  /**
   * 서버에 연결한다(핸드셰이크 = pk + Origin). 연결이 확립되면 resolve.
   * 이미 연결돼 있으면 즉시 resolve. 핸드셰이크 거부 시 reject.
   */
  connect(): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    if (this.socket) {
      // 이전 소켓 정리 후 새로 연결.
      this.teardownSocket();
    }

    this.setStatus("connecting");
    const socket = io(this.endpoint, {
      path: this.path,
      transports: this.transports,
      reconnection: this.autoReconnect,
      auth: { [AUTH_KEY]: this.publishableKey },
      withCredentials: true,
      autoConnect: true,
    });
    this.socket = socket;
    this.wireSocket(socket);

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let graceTimer: ReturnType<typeof setTimeout> | undefined;

      // 전송(transport) 'connect' 는 서버의 애플리케이션 레벨 인증(pk/Origin)보다 먼저
      // 올 수 있다. 서버는 잘못된 키/Origin 이면 'error' 이벤트 후 즉시 disconnect 하므로,
      // connect 직후 짧은 유예창 동안 거부 신호(error·disconnect)를 기다린 뒤 resolve 한다.
      const onConnect = (): void => {
        if (settled) return;
        graceTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        }, 250);
      };
      const onError = (err: ServerErrorEvent): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new RealtimeAckError(err.code, err.message));
      };
      // connect 직후 서버가 disconnect 하면(인증 거부) 거부로 처리한다.
      const onDisconnect = (reason: string): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new RealtimeAckError(
            "handshake_rejected",
            `핸드셰이크가 거부되었습니다 (${reason})`,
          ),
        );
      };
      const onConnectError = (err: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };
      const cleanup = (): void => {
        if (graceTimer) clearTimeout(graceTimer);
        socket.off("connect", onConnect);
        socket.off(SERVER_EVENTS.error, onError);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnectError);
      };
      socket.on("connect", onConnect);
      socket.on(SERVER_EVENTS.error, onError);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnectError);
    });
  }

  /**
   * 채널을 구독한다. 콜백은 이 채널로 publish 된 모든 메시지를 받는다.
   * 연결 전이면 자동으로 connect 를 보장한다(연결 후 join). 반환된 핸들로 해제.
   */
  subscribe(channel: string, handler: MessageHandler): Subscription {
    const state = this.ensureChannel(channel);
    state.messageHandlers.add(handler);

    // 소켓이 연결돼 있으면 즉시 join, 아니면 connect 후 join(재연결 시에도 재join).
    void this.joinIfConnected(channel);

    return {
      channel,
      off: () => {
        state.messageHandlers.delete(handler);
      },
      unsubscribe: async () => {
        state.messageHandlers.delete(handler);
        await this.leaveChannel(channel);
      },
    };
  }

  /**
   * 채널 presence 변경을 구독한다 — 스냅샷·join·leave 마다 콜백이 최신 PresenceDto 를 받는다.
   * (구독 직후 서버가 보내는 스냅샷, 이후 누군가 들어오거나 나갈 때마다 호출)
   */
  onPresence(channel: string, handler: PresenceHandler): PresenceSubscription {
    const state = this.ensureChannel(channel);
    state.presenceHandlers.add(handler);
    void this.joinIfConnected(channel);
    // 이미 스냅샷을 받아둔 상태면 즉시 한 번 통지.
    if (state.lastPresence.count > 0 || state.lastPresence.members.length > 0) {
      handler(state.lastPresence);
    }
    return {
      channel,
      off: () => {
        state.presenceHandlers.delete(handler);
      },
    };
  }

  /**
   * 채널의 현재 presence 스냅샷을 1회 요청한다(요청-응답). 구독 없이도 호출 가능.
   * 연결이 없으면 connect 를 먼저 보장한다.
   */
  async presence(channel: string): Promise<PresenceDto> {
    await this.connect();
    const socket = this.socket;
    if (!socket) throw new Error("소켓이 없습니다");
    return new Promise<PresenceDto>((resolve, reject) => {
      socket
        .timeout(8000)
        .emit(
          CLIENT_EVENTS.presence,
          { channel },
          (timeoutErr: Error | null, res: PresenceDto | Ack) => {
            if (timeoutErr) return reject(timeoutErr);
            if (isAckErr(res)) {
              return reject(new RealtimeAckError(res.code, res.message));
            }
            resolve(res as PresenceDto);
          },
        );
    });
  }

  /** 연결 상태 변화 구독. 해제 함수 반환. */
  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  /** 서버 오류(잘못된 키/Origin·내부 오류) 구독. 해제 함수 반환. */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /** 연결을 닫고 모든 구독·콜백을 정리한다. */
  close(): void {
    this.teardownSocket();
    this.channels.clear();
    this.setStatus("idle");
  }

  // ── 내부 ────────────────────────────────────────────────────────────────────

  private ensureChannel(channel: string): ChannelState {
    let state = this.channels.get(channel);
    if (!state) {
      state = {
        messageHandlers: new Set(),
        presenceHandlers: new Set(),
        lastPresence: { channel, count: 0, members: [] },
      };
      this.channels.set(channel, state);
    }
    return state;
  }

  private async joinIfConnected(channel: string): Promise<void> {
    if (!this.socket) {
      // 아직 연결 안 됨 — 호출자가 connect 를 부르지 않았다면 자동 연결.
      try {
        await this.connect();
      } catch {
        return; // 연결 실패 시 error 핸들러로 이미 통지됨.
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
            if (isAckErr(ack)) {
              return reject(new RealtimeAckError(ack.code, ack.message));
            }
            resolve();
          },
        );
    });
  }

  private async leaveChannel(channel: string): Promise<void> {
    const state = this.channels.get(channel);
    if (!state) return;
    // 더 이상 메시지·presence 구독이 없으면 서버에서도 떠난다.
    if (state.messageHandlers.size === 0 && state.presenceHandlers.size === 0) {
      this.channels.delete(channel);
      const socket = this.socket;
      if (socket && this.isConnected()) {
        await new Promise<void>((resolve) => {
          socket
            .timeout(8000)
            .emit(CLIENT_EVENTS.unsubscribe, { channel }, () => resolve());
        });
      }
    }
  }

  private wireSocket(socket: Socket): void {
    socket.on("connect", () => {
      this.setStatus("connected");
      // (재)연결 시 모든 채널을 다시 join — 재연결 후 구독 복원.
      for (const channel of this.channels.keys()) {
        void this.emitSubscribe(channel).catch(() => undefined);
      }
    });

    socket.on("disconnect", () => {
      if (this.status !== "idle") this.setStatus("disconnected");
    });

    socket.on(SERVER_EVENTS.message, (message: MessageDto) => {
      const state = this.channels.get(message.channel);
      if (!state) return;
      for (const handler of state.messageHandlers) handler(message);
    });

    socket.on(SERVER_EVENTS.presenceState, (snapshot: PresenceDto) => {
      this.applyPresence(snapshot);
    });

    socket.on(SERVER_EVENTS.presenceJoin, (delta: ServerPresenceDeltaEvent) => {
      this.applyPresenceDelta(delta, "join");
    });
    socket.on(
      SERVER_EVENTS.presenceLeave,
      (delta: ServerPresenceDeltaEvent) => {
        this.applyPresenceDelta(delta, "leave");
      },
    );

    socket.on(SERVER_EVENTS.error, (err: ServerErrorEvent) => {
      this.setStatus("error");
      for (const handler of this.errorHandlers) handler(err);
    });
  }

  private applyPresence(snapshot: PresenceDto): void {
    const state = this.ensureChannel(snapshot.channel);
    state.lastPresence = snapshot;
    for (const handler of state.presenceHandlers) handler(snapshot);
  }

  private applyPresenceDelta(
    delta: ServerPresenceDeltaEvent,
    kind: "join" | "leave",
  ): void {
    const state = this.channels.get(delta.channel);
    if (!state) return;
    const members = new Set(state.lastPresence.members);
    if (kind === "join") members.add(delta.member);
    else members.delete(delta.member);
    const next: PresenceDto = {
      channel: delta.channel,
      count: delta.count,
      members: [...members],
    };
    state.lastPresence = next;
    for (const handler of state.presenceHandlers) handler(next);
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const handler of this.statusHandlers) handler(status);
  }

  private teardownSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

function normalizePath(raw: string): string {
  const trimmed = raw.trim() || DEFAULT_PATH;
  const lead = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const noTrail = lead.replace(/\/+$/, "");
  return noTrail === "" ? DEFAULT_PATH : noTrail;
}

function isAckErr(
  value: Ack | PresenceDto,
): value is { ok: false; code: string; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok: unknown }).ok === false
  );
}

/** SSR 환경에서 안전하게 no-op 인지 판별하고 싶을 때 참고용 플래그(연결 전 가드). */
export const IS_BROWSER = isBrowser;
