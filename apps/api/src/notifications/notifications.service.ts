import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import {
  type NotificationDto,
  type NotificationListDto,
  type NotificationType,
} from '@termsdesk/shared'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { notifications } from '../db/schema'
import { RealtimeGateway } from '../realtime/realtime.gateway'

import type { AuthUser } from '../common/request-context'

type NotificationRow = typeof notifications.$inferSelect

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface NotifyInput {
  /** 수신자 사용자 id. 없으면 통지하지 않음(스냅샷이 비어 있을 수 있음). */
  userId: string | null | undefined
  orgId: string
  type: NotificationType
  title: string
  body: string
  requestId?: string | null
  /** 행위자 — 수신자와 같으면 자기 자신에게는 통지하지 않음. */
  actorUserId?: string | null
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications')

  constructor(
    private readonly dbs: DatabaseService,
    @Optional() private readonly realtime?: RealtimeGateway
  ) {}

  /**
   * 알림 1건 생성(best-effort). 통지 실패가 본 트랜잭션(제안·수락 등)을 깨뜨리지 않도록
   * 예외를 삼키고 로그만 남긴다. 수신자가 없거나 자기 자신이면 조용히 건너뛴다.
   */
  async notify(input: NotifyInput): Promise<void> {
    if (!input.userId) return
    if (input.actorUserId && input.actorUserId === input.userId) return
    try {
      const [saved] = await this.dbs.db
        .insert(notifications)
        .values({
          userId: input.userId,
          orgId: input.orgId,
          type: input.type,
          title: input.title,
          body: input.body,
          requestId: input.requestId ?? null,
        })
        .returning()
      if (saved) {
        this.realtime?.emitNotification(
          input.userId,
          this.toDto(saved),
          await this.unreadCountForUser(input.userId)
        )
      }
    } catch (err) {
      this.logger.warn(`알림 생성 실패(무시): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async list(
    user: AuthUser,
    opts: { unread?: boolean; limit?: number } = {}
  ): Promise<NotificationListDto> {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100)
    const base = opts.unread
      ? and(eq(notifications.userId, user.userId), isNull(notifications.readAt))
      : eq(notifications.userId, user.userId)

    const [rows, unread] = await Promise.all([
      this.dbs.db
        .select()
        .from(notifications)
        .where(base)
        .orderBy(desc(notifications.createdAt))
        .limit(limit),
      this.unreadCount(user),
    ])

    return { items: rows.map((r) => this.toDto(r)), total: rows.length, unreadCount: unread }
  }

  async unreadCount(user: AuthUser): Promise<number> {
    return this.unreadCountForUser(user.userId)
  }

  private async unreadCountForUser(userId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    return Number(rows[0]?.c ?? 0)
  }

  async markRead(user: AuthUser, id: string): Promise<{ ok: true }> {
    if (!UUID_RE.test(id)) throw new NotFoundException('알림을 찾을 수 없습니다')
    const rows = await this.dbs.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, user.userId),
          isNull(notifications.readAt)
        )
      )
      .returning({ id: notifications.id })
    // 이미 읽음/내 것이 아니어도 멱등하게 ok. 존재 자체가 없으면 404.
    if (rows.length === 0) {
      const exists = await this.dbs.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, user.userId)))
        .limit(1)
      if (!exists[0]) throw new NotFoundException('알림을 찾을 수 없습니다')
    }
    if (rows.length > 0) {
      this.realtime?.emitUnreadCount(user.userId, await this.unreadCountForUser(user.userId))
    }
    return { ok: true }
  }

  async markAllRead(user: AuthUser): Promise<{ ok: true; updated: number }> {
    const rows = await this.dbs.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id })
    this.realtime?.emitUnreadCount(user.userId, await this.unreadCountForUser(user.userId))
    return { ok: true, updated: rows.length }
  }

  private toDto(row: NotificationRow): NotificationDto {
    return {
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      requestId: row.requestId,
      readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
    }
  }
}
