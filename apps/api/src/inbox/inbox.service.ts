import { Injectable } from '@nestjs/common'
import {
  type InboxDto,
  type MarkReadInput,
  type MarkReadResultDto,
  type NotificationDto,
  type SentLogDto,
  type UnreadCountDto,
} from '@notifydesk/shared'
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'

import { toNotificationDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { notifications } from '../db/schema'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 25

function clampLimit(limit?: string, fallback = DEFAULT_LIMIT): number {
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(Number(limit)) || fallback))
}

@Injectable()
export class InboxService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 인박스 목록(최신순) + 미읽음 카운트. in-app 알림만(저장된 알림 = 인박스). */
  async list(tenantId: string, recipientId: string, limit?: string): Promise<InboxDto> {
    const l = clampLimit(limit)
    const rows = await this.dbs.db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.tenantId, tenantId), eq(notifications.recipientId, recipientId))
      )
      .orderBy(desc(notifications.createdAt))
      .limit(l)

    const unreadCount = await this.countUnread(tenantId, recipientId)
    return { items: rows.map(toNotificationDto), unreadCount, limit: l }
  }

  /** 미읽음 카운트(read 가 아닌 알림 수). */
  async unreadCount(tenantId: string, recipientId: string): Promise<UnreadCountDto> {
    return { recipientId, unreadCount: await this.countUnread(tenantId, recipientId) }
  }

  /** 읽음 처리 — ids 지정 또는 all. 본인(테넌트·recipient) 알림만 대상. */
  async markRead(tenantId: string, input: MarkReadInput): Promise<MarkReadResultDto> {
    const base = and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.recipientId, input.recipientId),
      ne(notifications.status, 'read')
    )
    const where =
      input.all === true ? base : and(base, inArray(notifications.id, input.ids ?? []))

    const updated = await this.dbs.db
      .update(notifications)
      .set({ status: 'read', readAt: new Date() })
      .where(where)
      .returning({ id: notifications.id })

    const unreadCount = await this.countUnread(tenantId, input.recipientId)
    return { updated: updated.length, unreadCount }
  }

  /** 어드민 발송 로그(테넌트 전체, 최신순, 페이지네이션). */
  async sentLog(
    tenantId: string,
    paging: { offset?: string; limit?: string }
  ): Promise<SentLogDto> {
    const offset = Math.max(0, Math.trunc(Number(paging.offset)) || 0)
    const limit = clampLimit(paging.limit)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.tenantId, tenantId))
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(notifications)
      .where(eq(notifications.tenantId, tenantId))
      .orderBy(desc(notifications.createdAt))
      .offset(offset)
      .limit(limit)

    const items: NotificationDto[] = rows.map(toNotificationDto)
    return { items, total, offset, limit }
  }

  private async countUnread(tenantId: string, recipientId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.recipientId, recipientId),
          ne(notifications.status, 'read')
        )
      )
    return Number(rows[0]?.c ?? 0)
  }
}
