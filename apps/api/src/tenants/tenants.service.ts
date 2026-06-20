import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  generateKeyPair,
  hashSecret,
  isPublishableKey,
  isSecretKey,
  PLAN_CAPS,
  type CreateTenantInput,
  type TenantDto,
  type TenantUsage,
  type TenantWithSecretDto,
  type UpdateTenantSettingsInput,
} from "@realtimedesk/shared";
import { eq, sql } from "drizzle-orm";

import { toTenantDto } from "../common/serialize";
import { DatabaseService } from "../db/database.service";
import { tenants } from "../db/schema";

export type TenantRow = typeof tenants.$inferSelect;

/**
 * 테넌트 도메인 — 가입(키 발급)·키 회전·사용량, 그리고 pk/sk 로 테넌트를 해석하는
 * 인증 헬퍼를 제공한다. pk 는 평문, sk 는 해시로만 저장(분실 시 회전).
 */
@Injectable()
export class TenantsService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 가입 — pk·sk 발급. corsOrigins 미지정 시 ['*'](데모). sk 평문은 응답 1회만 노출. */
  async create(input: CreateTenantInput): Promise<TenantWithSecretDto> {
    const pair = generateKeyPair();
    const corsOrigins =
      input.corsOrigins && input.corsOrigins.length > 0
        ? input.corsOrigins
        : ["*"];
    const plan = input.plan ?? "free";

    const inserted = await this.dbs.db
      .insert(tenants)
      .values({
        name: input.name,
        publishableKey: pair.publishableKey,
        secretKeyHash: pair.secretKeyHash,
        corsOrigins,
        plan,
      })
      .returning();
    const row = inserted[0]!;
    return { ...toTenantDto(row), secretKey: pair.secretKey };
  }

  /** publishable 키(pk_)로 테넌트 해석. 없거나 형태가 틀리면 null. */
  async findByPublishableKey(
    key: string | undefined | null,
  ): Promise<TenantRow | null> {
    if (!isPublishableKey(key)) return null;
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, key))
      .limit(1);
    return rows[0] ?? null;
  }

  /** secret 키(sk_)로 테넌트 해석(해시 비교). 없거나 형태가 틀리면 null. */
  async findBySecretKey(
    key: string | undefined | null,
  ): Promise<TenantRow | null> {
    if (!isSecretKey(key)) return null;
    const hash = hashSecret(key);
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.secretKeyHash, hash))
      .limit(1);
    return rows[0] ?? null;
  }

  /** id 로 테넌트 해석. */
  async findById(id: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Origin 이 테넌트 allowlist 를 통과하는지. `*` 가 있으면 모두 허용.
   * Origin 헤더가 없을 때(server-to-server·동일 출처)는 통과시킨다(브라우저만 Origin 을 보냄).
   */
  isOriginAllowed(
    tenant: Pick<TenantRow, "corsOrigins">,
    origin: string | undefined,
  ): boolean {
    const list = tenant.corsOrigins;
    if (list.includes("*")) return true;
    if (!origin) return true;
    return list.includes(origin);
  }

  /** 키 회전 — 새 pk·sk 발급(이전 키 무효화). sk 평문은 응답 1회만 노출. */
  async rotateKeys(tenantId: string): Promise<TenantWithSecretDto> {
    const existing = await this.findById(tenantId);
    if (!existing) throw new NotFoundException("테넌트를 찾을 수 없습니다");

    const pair = generateKeyPair();
    const updated = await this.dbs.db
      .update(tenants)
      .set({
        publishableKey: pair.publishableKey,
        secretKeyHash: pair.secretKeyHash,
      })
      .where(eq(tenants.id, tenantId))
      .returning();
    if (!updated[0]) throw new ConflictException("키 회전에 실패했습니다");
    return { ...toTenantDto(updated[0]), secretKey: pair.secretKey };
  }

  /**
   * 테넌트 설정 수정(이름·허용 Origin·요금제). 보낸 필드만 갱신한다.
   * corsOrigins 를 빈 배열로 보내면 모든 Origin 이 막히므로 ['*'] 로 정규화한다(데모 보호).
   */
  async updateSettings(
    tenantId: string,
    input: UpdateTenantSettingsInput,
  ): Promise<TenantDto> {
    const existing = await this.findById(tenantId);
    if (!existing) throw new NotFoundException("테넌트를 찾을 수 없습니다");

    const patch: Partial<typeof tenants.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.plan !== undefined) patch.plan = input.plan;
    if (input.corsOrigins !== undefined) {
      patch.corsOrigins =
        input.corsOrigins.length > 0 ? input.corsOrigins : ["*"];
    }

    const updated = await this.dbs.db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, tenantId))
      .returning();
    if (!updated[0]) throw new ConflictException("설정 수정에 실패했습니다");
    return toTenantDto(updated[0]);
  }

  /** 단건 조회(DTO). */
  async getDto(tenantId: string): Promise<TenantDto> {
    const row = await this.findById(tenantId);
    if (!row) throw new NotFoundException("테넌트를 찾을 수 없습니다");
    return toTenantDto(row);
  }

  /** 사용량(messages·connections·cap). */
  async getUsage(tenantId: string): Promise<TenantUsage> {
    const row = await this.findById(tenantId);
    if (!row) throw new NotFoundException("테넌트를 찾을 수 없습니다");
    const caps = PLAN_CAPS[row.plan];
    return {
      messages: row.usageMessages,
      connections: row.usageConnections,
      cap: { messages: caps.messages, connections: caps.connections },
    };
  }

  /** 메시지 사용량 +n. free cap 초과 시 false(거부) — 호출자가 publish 를 막는다. */
  async tryConsumeMessage(tenantId: string, n = 1): Promise<boolean> {
    const row = await this.findById(tenantId);
    if (!row) throw new UnauthorizedException("테넌트를 찾을 수 없습니다");
    const cap = PLAN_CAPS[row.plan].messages;
    if (row.usageMessages + n > cap) return false;
    await this.dbs.db
      .update(tenants)
      .set({ usageMessages: sql`${tenants.usageMessages} + ${n}` })
      .where(eq(tenants.id, tenantId));
    return true;
  }

  /** 연결 사용량 +1(핸드셰이크 성공 시). 카운터일 뿐 cap 강제는 게이트웨이가 별도 판단. */
  async incrementConnections(tenantId: string): Promise<void> {
    await this.dbs.db
      .update(tenants)
      .set({ usageConnections: sql`${tenants.usageConnections} + 1` })
      .where(eq(tenants.id, tenantId));
  }
}
