import type { campaigns, creatives, slots, tenants } from '../db/schema'
import type {
  CampaignDto,
  CampaignStatus,
  CreativeDto,
  Plan,
  SlotDto,
  TenantDto,
} from '@addesk/shared'

type TenantRow = typeof tenants.$inferSelect
type CampaignRow = typeof campaigns.$inferSelect
type CreativeRow = typeof creatives.$inferSelect
type SlotRow = typeof slots.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

const isoOrNull = (d: Date | string | null): string | null => (d == null ? null : iso(d))

/** secret 평문/해시는 절대 노출하지 않는다(가입/rotate 응답만 예외, 그건 서비스가 직접 합성). */
export function toTenantDto(row: TenantRow): TenantDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins,
    plan: row.plan as Plan,
    usageCount: row.usageCount,
    createdAt: iso(row.createdAt),
  }
}

export function toCampaignDto(row: CampaignRow): CampaignDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    status: row.status as CampaignStatus,
    startsAt: isoOrNull(row.startsAt),
    endsAt: isoOrNull(row.endsAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export function toCreativeDto(row: CreativeRow): CreativeDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    campaignId: row.campaignId,
    slotKey: row.slotKey,
    imageUrl: row.imageUrl,
    linkUrl: row.linkUrl,
    alt: row.alt,
    weight: row.weight,
    impressions: row.impressions,
    clicks: row.clicks,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export function toSlotDto(row: SlotRow): SlotDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    key: row.key,
    label: row.label ?? null,
    sizes: row.sizes,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}
