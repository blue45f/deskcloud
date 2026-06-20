import {
  PLAN_CAPS,
  type MessageDto,
  type TenantDto,
} from "@realtimedesk/shared";

import type { messages, tenants } from "../db/schema";

type TenantRow = typeof tenants.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString();

/** 테넌트 행 → 공개 DTO. secret 키 해시는 절대 포함하지 않는다. */
export function toTenantDto(row: TenantRow): TenantDto {
  const caps = PLAN_CAPS[row.plan];
  return {
    id: row.id,
    name: row.name,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins,
    plan: row.plan,
    usage: {
      messages: row.usageMessages,
      connections: row.usageConnections,
      cap: { messages: caps.messages, connections: caps.connections },
    },
    createdAt: iso(row.createdAt),
  };
}

/** 메시지 행 → DTO(history·publish 결과·WS 페이로드). */
export function toMessageDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    channel: row.channel,
    event: row.event,
    data: row.data ?? null,
    publishedAt: iso(row.publishedAt),
  };
}
