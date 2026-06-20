import type { notificationTemplates, notifications, preferences, tenants } from '../db/schema'
import type { NotificationDto, PreferenceDto, TemplateDto, TenantDto } from '@notifydesk/shared'

type TenantRow = typeof tenants.$inferSelect
type TemplateRow = typeof notificationTemplates.$inferSelect
type NotificationRow = typeof notifications.$inferSelect
type PreferenceRow = typeof preferences.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

/** secret 평문/해시는 절대 노출하지 않는다(가입/rotate 응답만 예외, 그건 서비스가 직접 합성). */
export function toTenantDto(row: TenantRow): TenantDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins,
    usageCount: row.usageCount,
    createdAt: iso(row.createdAt),
  }
}

export function toTemplateDto(row: TemplateRow): TemplateDto {
  return {
    tenantId: row.tenantId,
    key: row.key,
    channels: row.channels,
    subject: row.subject ?? null,
    bodyTemplate: row.bodyTemplate,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    recipientId: row.recipientId,
    type: row.type,
    channels: row.channels,
    title: row.title,
    body: row.body,
    data: row.data ?? null,
    status: row.status,
    readAt: row.readAt ? iso(row.readAt) : null,
    createdAt: iso(row.createdAt),
  }
}

export function toPreferenceDto(row: PreferenceRow): PreferenceDto {
  return {
    tenantId: row.tenantId,
    recipientId: row.recipientId,
    type: row.type,
    channel: row.channel,
    enabled: row.enabled,
  }
}
