import { type CreateRuleInput, type RuleDto, type UpdateRuleInput } from '@moderationdesk/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'

import { toRuleDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { forbiddenRules } from '../db/schema'
import { type TenantRow } from '../tenants/tenants.service'

@Injectable()
export class RulesService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 테넌트의 금칙 규칙 목록(최신순). */
  async listRules(tenant: TenantRow): Promise<RuleDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(forbiddenRules)
      .where(eq(forbiddenRules.tenantId, tenant.id))
      .orderBy(desc(forbiddenRules.createdAt))
    return rows.map(toRuleDto)
  }

  /** 규칙 생성. */
  async createRule(tenant: TenantRow, input: CreateRuleInput): Promise<RuleDto> {
    const inserted = await this.dbs.db
      .insert(forbiddenRules)
      .values({
        tenantId: tenant.id,
        pattern: input.pattern,
        kind: input.kind,
        action: input.action,
        label: input.label ?? null,
        enabled: input.enabled,
      })
      .returning()
    return toRuleDto(inserted[0]!)
  }

  /** 규칙 수정(부분 갱신). 타 테넌트/없음이면 404. */
  async updateRule(tenant: TenantRow, id: string, input: UpdateRuleInput): Promise<RuleDto> {
    await this.findOwned(tenant.id, id)
    const patch: Partial<typeof forbiddenRules.$inferInsert> = {}
    if (input.pattern !== undefined) patch.pattern = input.pattern
    if (input.kind !== undefined) patch.kind = input.kind
    if (input.action !== undefined) patch.action = input.action
    if (input.label !== undefined) patch.label = input.label ?? null
    if (input.enabled !== undefined) patch.enabled = input.enabled

    const updated = await this.dbs.db
      .update(forbiddenRules)
      .set(patch)
      .where(and(eq(forbiddenRules.tenantId, tenant.id), eq(forbiddenRules.id, id)))
      .returning()
    return toRuleDto(updated[0]!)
  }

  /** 규칙 삭제. 타 테넌트/없음이면 404. */
  async deleteRule(tenant: TenantRow, id: string): Promise<void> {
    await this.findOwned(tenant.id, id)
    await this.dbs.db
      .delete(forbiddenRules)
      .where(and(eq(forbiddenRules.tenantId, tenant.id), eq(forbiddenRules.id, id)))
  }

  /** 테넌트 소유 규칙 조회(없거나 타 테넌트면 404). */
  private async findOwned(
    tenantId: string,
    id: string
  ): Promise<typeof forbiddenRules.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(forbiddenRules)
      .where(and(eq(forbiddenRules.tenantId, tenantId), eq(forbiddenRules.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('규칙을 찾을 수 없습니다')
    return rows[0]
  }
}
