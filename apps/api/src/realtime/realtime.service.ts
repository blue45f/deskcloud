import { Inject, Injectable } from '@nestjs/common'
import { type MessageDto, type PublishInput } from '@realtimedesk/shared'
import { and, desc, eq, sql } from 'drizzle-orm'

import { toMessageDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { messages } from '../db/schema'

/**
 * 브로드캐스터 — 게이트웨이가 등록하는 전달 콜백. 채널 구독자에게 메시지를 push 하고
 * 전달된 소켓 수를 돌려준다. 게이트웨이가 없으면(REST-only 테스트) 0.
 */
export type Broadcaster = (tenantId: string, message: MessageDto) => number

/**
 * 실시간 핵심 — publish(영속화 + 브로드캐스트)와 채널 history.
 * 게이트웨이와의 순환 의존을 피하려고 broadcaster 를 런타임에 등록(setBroadcaster)한다.
 */
@Injectable()
export class RealtimeService {
  private broadcaster: Broadcaster | null = null

  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /** 게이트웨이가 부팅 시 전달 콜백을 등록한다. */
  setBroadcaster(fn: Broadcaster): void {
    this.broadcaster = fn
  }

  /** history 영속화 활성 여부(REALTIME_HISTORY_LIMIT > 0). */
  get persistenceEnabled(): boolean {
    return this.cfg.historyLimit > 0
  }

  /**
   * publish — 채널로 브로드캐스트하고(전달 수 반환) history 가 활성이면 영속화한다.
   * 반환: { delivered, message }. message 는 영속화 비활성 시 null.
   */
  async publish(
    tenantId: string,
    input: PublishInput
  ): Promise<{ delivered: number; message: MessageDto | null }> {
    // 양 분기에서 항상 할당되므로 초기값 없이 선언(no-useless-assignment).
    let message: MessageDto

    if (this.persistenceEnabled) {
      const inserted = await this.dbs.db
        .insert(messages)
        .values({
          tenantId,
          channel: input.channel,
          event: input.event,
          data: (input.data ?? null) as MessageDto['data'],
        })
        .returning()
      message = toMessageDto(inserted[0]!)
      await this.pruneChannel(tenantId, input.channel)
    } else {
      // 영속화 없이도 브로드캐스트 페이로드는 필요 — 휘발성 메시지 구성.
      message = {
        id: `vol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        channel: input.channel,
        event: input.event,
        data: input.data ?? null,
        publishedAt: new Date().toISOString(),
      }
    }

    const delivered = this.broadcaster ? this.broadcaster(tenantId, message) : 0
    return { delivered, message: this.persistenceEnabled ? message : null }
  }

  /** 채널 최근 N개 메시지(오래된→최신 순). history 비활성이면 빈 배열. */
  async history(tenantId: string, channel: string, limit?: number): Promise<MessageDto[]> {
    if (!this.persistenceEnabled) return []
    const n = Math.min(Math.max(1, limit ?? this.cfg.historyLimit), this.cfg.historyLimit)
    const rows = await this.dbs.db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), eq(messages.channel, channel)))
      .orderBy(desc(messages.seq))
      .limit(n)
    // 최신순(seq DESC)으로 가져온 뒤 삽입 오름차순으로 뒤집어 돌려준다(소비 편의).
    return rows.map(toMessageDto).reverse()
  }

  /**
   * 채널당 보관 메시지를 historyLimit 으로 자른다(가장 오래된 것부터 삭제).
   * 영속화가 켜진 경우에만 호출된다.
   */
  private async pruneChannel(tenantId: string, channel: string): Promise<void> {
    const limit = this.cfg.historyLimit
    // 보관 한도를 넘은 행만 삭제: published_at 기준 상위 limit 개를 제외한 나머지.
    await this.dbs.db.execute(sql`
      DELETE FROM ${messages}
      WHERE ${messages.tenantId} = ${tenantId}
        AND ${messages.channel} = ${channel}
        AND ${messages.seq} NOT IN (
          SELECT ${messages.seq} FROM ${messages}
          WHERE ${messages.tenantId} = ${tenantId} AND ${messages.channel} = ${channel}
          ORDER BY ${messages.seq} DESC
          LIMIT ${limit}
        )
    `)
  }
}
