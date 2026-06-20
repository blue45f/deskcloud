import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  type CreateTemplateInput,
  type TemplateDto,
  type UpdateTemplateInput,
} from '@notifydesk/shared'
import { and, desc, eq } from 'drizzle-orm'

import { toTemplateDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { notificationTemplates } from '../db/schema'

@Injectable()
export class TemplatesService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 테넌트의 템플릿 목록(최신순). */
  async list(tenantId: string): Promise<TemplateDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.tenantId, tenantId))
      .orderBy(desc(notificationTemplates.createdAt))
    return rows.map(toTemplateDto)
  }

  /** 템플릿 단건(key). 없으면 404. */
  async get(tenantId: string, key: string): Promise<TemplateDto> {
    return toTemplateDto(await this.find(tenantId, key))
  }

  /** 템플릿 생성 — (tenantId, key) 중복이면 409. */
  async create(tenantId: string, input: CreateTemplateInput): Promise<TemplateDto> {
    const existing = await this.dbs.db
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(
        and(eq(notificationTemplates.tenantId, tenantId), eq(notificationTemplates.key, input.key))
      )
      .limit(1)
    if (existing[0]) throw new ConflictException(`템플릿 '${input.key}' 가 이미 있습니다`)

    const inserted = await this.dbs.db
      .insert(notificationTemplates)
      .values({
        tenantId,
        key: input.key,
        channels: input.channels,
        subject: input.subject ?? null,
        bodyTemplate: input.bodyTemplate,
      })
      .returning()
    return toTemplateDto(inserted[0]!)
  }

  /** 템플릿 갱신(전체 교체). 없으면 404. */
  async update(tenantId: string, key: string, input: UpdateTemplateInput): Promise<TemplateDto> {
    await this.find(tenantId, key)
    const updated = await this.dbs.db
      .update(notificationTemplates)
      .set({
        channels: input.channels,
        subject: input.subject ?? null,
        bodyTemplate: input.bodyTemplate,
        updatedAt: new Date(),
      })
      .where(
        and(eq(notificationTemplates.tenantId, tenantId), eq(notificationTemplates.key, key))
      )
      .returning()
    return toTemplateDto(updated[0]!)
  }

  /** 템플릿 삭제. 없으면 404. */
  async remove(tenantId: string, key: string): Promise<{ deleted: boolean }> {
    await this.find(tenantId, key)
    await this.dbs.db
      .delete(notificationTemplates)
      .where(
        and(eq(notificationTemplates.tenantId, tenantId), eq(notificationTemplates.key, key))
      )
    return { deleted: true }
  }

  private async find(
    tenantId: string,
    key: string
  ): Promise<typeof notificationTemplates.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(notificationTemplates)
      .where(
        and(eq(notificationTemplates.tenantId, tenantId), eq(notificationTemplates.key, key))
      )
      .limit(1)
    if (!rows[0]) throw new NotFoundException(`템플릿 '${key}' 가 없습니다`)
    return rows[0]
  }
}
