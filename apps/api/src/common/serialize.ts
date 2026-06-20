import {
  isTransformableMime,
  publicAssetUrl,
  type AssetDto,
  type TenantDto,
  type UsageDto,
} from '@mediadesk/shared'

import { planCaps, type AppConfig } from '../config'

import type { assets, tenants } from '../db/schema'

type TenantRow = typeof tenants.$inferSelect
type AssetRow = typeof assets.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

/** 테넌트 사용량 DTO(플랜 캡 포함). */
export function toUsageDto(cfg: AppConfig, row: TenantRow): UsageDto {
  const caps = planCaps(cfg, row.plan)
  return {
    bytes: Number(row.usageBytes),
    count: row.usageCount,
    maxBytes: caps.maxBytes,
    maxCount: caps.maxCount,
  }
}

/** 어드민용 테넌트 DTO — secret 키는 절대 포함하지 않는다(해시만 DB 저장). */
export function toTenantDto(cfg: AppConfig, row: TenantRow): TenantDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    plan: row.plan,
    corsOrigins: row.corsOrigins ?? [],
    publishableKey: row.publishableKey,
    storageDriver: row.storageDriver,
    usage: toUsageDto(cfg, row),
    createdAt: iso(row.createdAt),
  }
}

/**
 * 자산 DTO — 공개 URL 을 조합한다(base/file/<tenantSlug>/<key>).
 * transformable 은 sharp 사용 가능 여부와 무관하게 "래스터 이미지인가"로 판정한다(서버가
 * 가능하면 변환, 아니면 원본 — 위젯은 이 플래그로 썸네일 포맷 결정).
 */
export function toAssetDto(base: string, tenantSlug: string, row: AssetRow): AssetDto {
  return {
    key: row.key,
    url: publicAssetUrl(base, tenantSlug, row.key),
    contentType: row.contentType,
    size: Number(row.size),
    folder: row.folder ?? null,
    transformable: isTransformableMime(row.contentType),
    width: row.width ?? null,
    height: row.height ?? null,
    createdAt: iso(row.createdAt),
  }
}
