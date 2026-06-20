import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { generateApiKey, randomUUID } from '../common/crypto'
import { PlanService } from '../common/plan.service'
import { toApiKeyDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { apiKeys } from '../db/schema'

import type { AuthUser } from '../common/request-context'
import type { ApiKeyCreatedDto, ApiKeyDto, CreateApiKeyInput } from '@termsdesk/shared'

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly audit: AuditService,
    private readonly plans: PlanService
  ) {}

  async list(orgId: string): Promise<ApiKeyDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.orgId, orgId))
      .orderBy(desc(apiKeys.createdAt))
    return rows.map(toApiKeyDto)
  }

  async create(orgId: string, user: AuthUser, input: CreateApiKeyInput): Promise<ApiKeyCreatedDto> {
    // 플랜 API 키 한도(활성 기준, 폐기 제외) — 초과 시 402 + 업그레이드 안내.
    await this.plans.assertCanAddApiKey(orgId)
    const { full, prefix, hash } = generateApiKey()
    const id = randomUUID()
    await this.dbs.db.insert(apiKeys).values({
      id,
      orgId,
      name: input.name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: input.scopes.join(','),
    })
    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'apikey.created',
      targetType: 'api_key',
      targetId: id,
      metadata: { summary: `API 키 발급: ${input.name} (${prefix}…)` },
    })
    return {
      id,
      name: input.name,
      keyPrefix: prefix,
      scopes: input.scopes,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      revokedAt: null,
      plaintextKey: full,
    }
  }

  async revoke(orgId: string, user: AuthUser, id: string): Promise<{ ok: true }> {
    const rows = await this.dbs.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('API 키를 찾을 수 없습니다')
    await this.dbs.db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id))
    await this.audit.record({
      orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'apikey.revoked',
      targetType: 'api_key',
      targetId: id,
      metadata: { summary: `API 키 폐기: ${rows[0].name}` },
    })
    return { ok: true }
  }
}
