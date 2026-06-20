import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import {
  channelSubscriptionSchema,
  WS_CLIENT_EVENTS,
  WS_SERVER_EVENTS,
  WS_AUTH_KEY,
  type Ack,
  type MessageDto,
  type PresenceDto,
} from "@realtimedesk/shared";
import { type Server, type Socket } from "socket.io";

import { APP_CONFIG, type AppConfig } from "../config";
import { TenantsService } from "../tenants/tenants.service";

import { PresenceService } from "./presence.service";
import { RealtimeService } from "./realtime.service";

/** 소켓에 부착하는 인증 컨텍스트. */
interface SocketData {
  tenantId: string;
  publishableKey: string;
}

/**
 * socket.io 게이트웨이 — `REALTIME_PATH`(기본 /realtime)에 정확 매칭으로 마운트.
 * 핸드셰이크에서 pk(+Origin)로 인증하고, 테넌트·채널 범위 룸으로 격리한다.
 *
 * 룸 이름: `tenantId::channel`(socket.io 룸은 서버 전역이므로 테넌트로 네임스페이스).
 *
 * 주: @WebSocketGateway 의 path 는 데코레이터 평가 시점에 결정되므로 env 를 직접 읽는다.
 * config.normalizeRealtimePath 와 동일 규약(선행 슬래시·트레일링 제거).
 */
const REALTIME_PATH = (() => {
  const raw = (process.env.REALTIME_PATH ?? "/realtime").trim() || "/realtime";
  const lead = raw.startsWith("/") ? raw : `/${raw}`;
  const trimmed = lead.replace(/\/+$/, "");
  return trimmed === "" ? "/realtime" : trimmed;
})();

@WebSocketGateway({
  path: REALTIME_PATH,
  // Origin 검사는 핸드셰이크에서 테넌트별 allowlist 로 직접 수행하므로 여기선 개방.
  cors: { origin: true, credentials: true },
  // 게이트웨이 뒤 정확 매칭을 위해 트레일링 슬래시 차이를 허용하지 않음(엄격 경로).
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger("Realtime");

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tenants: TenantsService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  onModuleInit(): void {
    // 서비스(REST publish 포함)가 채널 구독자에게 전달할 수 있도록 브로드캐스터 등록.
    this.realtime.setBroadcaster((tenantId, message) =>
      this.deliver(tenantId, message),
    );
    this.logger.log(`WS 게이트웨이 마운트: ${this.cfg.realtimePath}`);
  }

  // ── 연결 수명주기 ───────────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const key = this.extractKey(client);
    const origin = this.extractOrigin(client);

    const tenant = await this.tenants.findByPublishableKey(key);
    if (!tenant) {
      this.emitError(
        client,
        "invalid_key",
        "유효한 publishable 키가 필요합니다",
      );
      client.disconnect(true);
      return;
    }
    if (!this.tenants.isOriginAllowed(tenant, origin)) {
      this.emitError(
        client,
        "origin_not_allowed",
        `Origin 이 허용되지 않습니다: ${origin ?? "(none)"}`,
      );
      client.disconnect(true);
      return;
    }

    (client.data as SocketData) = {
      tenantId: tenant.id,
      publishableKey: tenant.publishableKey,
    };
    await this.tenants.incrementConnections(tenant.id);
    this.logger.log(`연결: tenant=${tenant.id} socket=${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as Partial<SocketData>;
    if (!data?.tenantId) return;
    const affected = this.presence.removeFromAll(data.tenantId, client.id);
    for (const channel of affected) {
      this.server
        .to(this.room(data.tenantId, channel))
        .emit(WS_SERVER_EVENTS.presenceLeave, {
          channel,
          member: client.id,
          count: this.presence.count(data.tenantId, channel),
        });
    }
  }

  // ── 클라이언트 메시지 ───────────────────────────────────────────────────────

  @SubscribeMessage(WS_CLIENT_EVENTS.subscribe)
  async onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack> {
    const data = client.data as Partial<SocketData>;
    if (!data?.tenantId)
      return this.ackErr("unauthorized", "인증되지 않은 소켓입니다");

    const parsed = channelSubscriptionSchema.safeParse(body);
    if (!parsed.success)
      return this.ackErr("bad_request", "유효한 channel 이 필요합니다");
    const { channel } = parsed.data;

    const room = this.room(data.tenantId, channel);
    await client.join(room);
    const isNew = this.presence.add(data.tenantId, channel, client.id);

    // 구독 직후 presence 스냅샷을 본인에게 전달.
    const snapshot: PresenceDto = {
      channel,
      count: this.presence.count(data.tenantId, channel),
      members: this.presence.members(data.tenantId, channel),
    };
    client.emit(WS_SERVER_EVENTS.presenceState, snapshot);

    // 새 멤버면 채널의 나머지에게 join 통지.
    if (isNew) {
      client.to(room).emit(WS_SERVER_EVENTS.presenceJoin, {
        channel,
        member: client.id,
        count: snapshot.count,
      });
    }
    return this.ackOk();
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.unsubscribe)
  async onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack> {
    const data = client.data as Partial<SocketData>;
    if (!data?.tenantId)
      return this.ackErr("unauthorized", "인증되지 않은 소켓입니다");

    const parsed = channelSubscriptionSchema.safeParse(body);
    if (!parsed.success)
      return this.ackErr("bad_request", "유효한 channel 이 필요합니다");
    const { channel } = parsed.data;

    const room = this.room(data.tenantId, channel);
    await client.leave(room);
    const removed = this.presence.remove(data.tenantId, channel, client.id);
    if (removed) {
      this.server.to(room).emit(WS_SERVER_EVENTS.presenceLeave, {
        channel,
        member: client.id,
        count: this.presence.count(data.tenantId, channel),
      });
    }
    return this.ackOk();
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.presence)
  onPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): PresenceDto | Ack {
    const data = client.data as Partial<SocketData>;
    if (!data?.tenantId)
      return this.ackErr("unauthorized", "인증되지 않은 소켓입니다");

    const parsed = channelSubscriptionSchema.safeParse(body);
    if (!parsed.success)
      return this.ackErr("bad_request", "유효한 channel 이 필요합니다");
    const { channel } = parsed.data;

    return {
      channel,
      count: this.presence.count(data.tenantId, channel),
      members: this.presence.members(data.tenantId, channel),
    };
  }

  // ── 브로드캐스트(서비스 → 구독자) ──────────────────────────────────────────

  /** 채널 구독자에게 메시지를 전달하고 전달 소켓 수를 돌려준다. */
  private deliver(tenantId: string, message: MessageDto): number {
    if (!this.server) return 0;
    const room = this.room(tenantId, message.channel);
    this.server.to(room).emit(WS_SERVER_EVENTS.message, message);
    const set = this.server.sockets.adapter.rooms.get(room);
    return set ? set.size : 0;
  }

  // ── 헬퍼 ────────────────────────────────────────────────────────────────────

  private room(tenantId: string, channel: string): string {
    return `${tenantId}::${channel}`;
  }

  private extractKey(client: Socket): string | undefined {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const fromAuth = auth?.[WS_AUTH_KEY];
    if (typeof fromAuth === "string") return fromAuth;
    const q = client.handshake.query?.[WS_AUTH_KEY];
    return Array.isArray(q) ? q[0] : (q as string | undefined);
  }

  private extractOrigin(client: Socket): string | undefined {
    const h = client.handshake.headers.origin;
    return Array.isArray(h) ? h[0] : h;
  }

  private emitError(client: Socket, code: string, message: string): void {
    client.emit(WS_SERVER_EVENTS.error, { code, message });
  }

  private ackOk(): Ack {
    return { ok: true };
  }

  private ackErr(code: string, message: string): Ack {
    return { ok: false, code, message };
  }
}
