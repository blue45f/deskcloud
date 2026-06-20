import { Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { auditEvents } from '../db/schema'

import { randomUUID } from './crypto'
import { toAuditDto } from './serialize'

import type { AuditEventDto } from '@termsdesk/shared'

export interface AuditInput {
  orgId: string
  action: string
  targetType: string
  targetId?: string | null
  actorUserId?: string | null
  actorName?: string | null
  metadata?: Record<string, unknown> | null
  ip?: string | null
}

@Injectable()
export class AuditService {
  constructor(private readonly dbs: DatabaseService) {}

  async record(input: AuditInput): Promise<void> {
    await this.dbs.db.insert(auditEvents).values({
      id: randomUUID(),
      orgId: input.orgId,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
    })
  }

  async list(orgId: string, limit = 100): Promise<AuditEventDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.orgId, orgId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(Math.min(limit, 500))
    return rows.map(toAuditDto)
  }
}
