import { Injectable } from '@nestjs/common'
import { type PreferencesDto, type UpdatePreferencesInput } from '@notifydesk/shared'
import { and, eq } from 'drizzle-orm'

import { toPreferenceDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { preferences } from '../db/schema'

@Injectable()
export class PreferencesService {
  constructor(private readonly dbs: DatabaseService) {}

  /** recipient 의 선호 설정 목록. 없으면 빈 배열(opt-out 기본 — 미설정은 허용 의미). */
  async get(tenantId: string, recipientId: string): Promise<PreferencesDto> {
    const rows = await this.dbs.db
      .select()
      .from(preferences)
      .where(and(eq(preferences.tenantId, tenantId), eq(preferences.recipientId, recipientId)))
    return { recipientId, preferences: rows.map(toPreferenceDto) }
  }

  /**
   * 선호 설정 일괄 upsert — (type, channel) 별 enabled 갱신.
   * 유니크 제약 충돌 시 갱신(수동 upsert: 존재하면 update, 없으면 insert).
   */
  async update(tenantId: string, input: UpdatePreferencesInput): Promise<PreferencesDto> {
    for (const p of input.preferences) {
      const existing = await this.dbs.db
        .select({ id: preferences.id })
        .from(preferences)
        .where(
          and(
            eq(preferences.tenantId, tenantId),
            eq(preferences.recipientId, input.recipientId),
            eq(preferences.type, p.type),
            eq(preferences.channel, p.channel)
          )
        )
        .limit(1)

      if (existing[0]) {
        await this.dbs.db
          .update(preferences)
          .set({ enabled: p.enabled, updatedAt: new Date() })
          .where(eq(preferences.id, existing[0].id))
      } else {
        await this.dbs.db.insert(preferences).values({
          tenantId,
          recipientId: input.recipientId,
          type: p.type,
          channel: p.channel,
          enabled: p.enabled,
        })
      }
    }
    return this.get(tenantId, input.recipientId)
  }
}
