import { BadRequestException, Injectable } from '@nestjs/common'
import {
  buildPrefMap,
  renderTemplate,
  resolveChannels,
  type Channel,
  type ChannelDeliveryDto,
  type NotifyInput,
  type NotifyResultDto,
} from '@notifydesk/shared'
import { and, eq } from 'drizzle-orm'

import { ChannelsService } from '../channels/channels.service'
import { DatabaseService } from '../db/database.service'
import { notificationTemplates, notifications, preferences } from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

import type { AppConfig } from '../config'
import type { TenantRow } from '../tenants/tenant-context'

@Injectable()
export class NotificationsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly channels: ChannelsService,
    private readonly tenants: TenantsService
  ) {}

  /**
   * 발송 파이프라인(secret 경로):
   * 1) 템플릿 해석(templateKey) → channels/subject/bodyTemplate.
   * 2) title/body 렌더(애드혹 입력이 템플릿보다 우선).
   * 3) 요청/템플릿 채널을 선호 설정으로 게이팅(in_app 은 항상 포함).
   * 4) free 플랜 소프트 캡 검사(초과면 발송 거부, 카운터 롤백).
   * 5) in_app 알림 저장 + 비-in_app 채널 어댑터 전달.
   */
  async notify(tenant: TenantRow, input: NotifyInput, cfg: AppConfig): Promise<NotifyResultDto> {
    const template = input.templateKey
      ? await this.findTemplate(tenant.id, input.templateKey)
      : null

    if (input.templateKey && !template) {
      throw new BadRequestException(`템플릿 '${input.templateKey}' 가 없습니다`)
    }

    const data = input.data ?? {}
    // title: 애드혹 > 템플릿 subject(렌더) > type
    const title = (
      input.title ??
      (template?.subject ? renderTemplate(template.subject, data) : undefined) ??
      input.type
    ).slice(0, 200)
    // body: 애드혹 > 템플릿 bodyTemplate(렌더)
    const bodySource = input.body ?? template?.bodyTemplate
    if (!bodySource) {
      throw new BadRequestException('body 또는 templateKey 가 필요합니다')
    }
    const body = renderTemplate(bodySource, data)

    // 채널 결정: 요청 > 템플릿 > ['in_app']
    const requested: Channel[] = input.channels ?? template?.channels ?? ['in_app']

    // 선호 게이팅
    const prefRows = await this.dbs.db
      .select()
      .from(preferences)
      .where(
        and(eq(preferences.tenantId, tenant.id), eq(preferences.recipientId, input.recipientId))
      )
    const prefMap = buildPrefMap(
      prefRows.map((p) => ({ type: p.type, channel: p.channel, enabled: p.enabled }))
    )
    const { allowed, suppressed } = resolveChannels(requested, prefMap, input.type)

    // 소프트 캡 — 사용량 +1 후 초과면 롤백·거부.
    const usage = await this.tenants.incrementUsage(tenant.id, tenant.plan, cfg.freePlanCap)
    if (usage.overCap) {
      await this.tenants.decrementUsage(tenant.id)
      return {
        notificationId: null,
        recipientId: input.recipientId,
        type: input.type,
        deliveries: [],
        suppressed,
        capExceeded: true,
      }
    }

    // in_app 저장(allowed 에 in_app 이 있을 때 — 항상 있음).
    let notificationId: string | null = null
    if (allowed.includes('in_app')) {
      const inserted = await this.dbs.db
        .insert(notifications)
        .values({
          tenantId: tenant.id,
          recipientId: input.recipientId,
          type: input.type,
          channels: allowed,
          title,
          body,
          data: input.data ?? null,
          status: 'sent',
        })
        .returning({ id: notifications.id })
      notificationId = inserted[0]!.id
    }

    // 비-in_app 채널 전달.
    const deliveries: ChannelDeliveryDto[] = []
    for (const ch of allowed) {
      if (ch === 'in_app') {
        deliveries.push({ channel: 'in_app', status: 'delivered', detail: 'stored' })
        continue
      }
      const outcome = await this.channels.deliver(ch, {
        recipientId: input.recipientId,
        email: input.email,
        title,
        body,
        data: input.data,
      })
      deliveries.push({ channel: ch, status: outcome.status, detail: outcome.detail })
    }

    return {
      notificationId,
      recipientId: input.recipientId,
      type: input.type,
      deliveries,
      suppressed,
      capExceeded: false,
    }
  }

  private async findTemplate(
    tenantId: string,
    key: string
  ): Promise<typeof notificationTemplates.$inferSelect | null> {
    const rows = await this.dbs.db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.tenantId, tenantId), eq(notificationTemplates.key, key)))
      .limit(1)
    return rows[0] ?? null
  }
}
