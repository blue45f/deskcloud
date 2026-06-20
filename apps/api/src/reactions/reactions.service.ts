import {
  type ReactionCounts,
  type ReactionKind,
  type ReactionTarget,
  type ReactionToggleDto,
  type ToggleReactionInput,
} from '@communitydesk/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { comments, posts, reactions } from '../db/schema'

import type { TenantRow } from '../tenants/tenants.service'

@Injectable()
export class ReactionsService {
  constructor(private readonly dbs: DatabaseService) {}

  /**
   * 반응 토글 — 같은 (테넌트,타깃,멤버,kind) 가 있으면 해제, 없으면 추가.
   * 토글 후 타깃(post|comment)의 reactions 카운트 캐시를 재계산해 반환.
   */
  async toggle(tenant: TenantRow, input: ToggleReactionInput): Promise<ReactionToggleDto> {
    await this.assertTargetExists(tenant.id, input.targetType, input.targetId)

    const existing = await this.dbs.db
      .select({ id: reactions.id })
      .from(reactions)
      .where(
        and(
          eq(reactions.tenantId, tenant.id),
          eq(reactions.targetType, input.targetType),
          eq(reactions.targetId, input.targetId),
          eq(reactions.memberId, input.memberId),
          eq(reactions.kind, input.kind)
        )
      )
      .limit(1)

    let active: boolean
    if (existing[0]) {
      await this.dbs.db.delete(reactions).where(eq(reactions.id, existing[0].id))
      active = false
    } else {
      await this.dbs.db.insert(reactions).values({
        tenantId: tenant.id,
        targetType: input.targetType,
        targetId: input.targetId,
        memberId: input.memberId,
        kind: input.kind,
      })
      active = true
    }

    const counts = await this.recomputeCounts(tenant.id, input.targetType, input.targetId)
    return { active, reactions: counts }
  }

  /** 타깃의 반응을 kind 별로 집계해 캐시 컬럼에 반영하고 반환. */
  private async recomputeCounts(
    tenantId: string,
    targetType: ReactionTarget,
    targetId: string
  ): Promise<ReactionCounts> {
    const rows = await this.dbs.db
      .select({ kind: reactions.kind, c: sql<number>`count(*)::int` })
      .from(reactions)
      .where(
        and(
          eq(reactions.tenantId, tenantId),
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId)
        )
      )
      .groupBy(reactions.kind)

    const counts: ReactionCounts = {}
    for (const r of rows) counts[r.kind as ReactionKind] = Number(r.c)

    if (targetType === 'post') {
      await this.dbs.db
        .update(posts)
        .set({ reactions: counts })
        .where(and(eq(posts.tenantId, tenantId), eq(posts.id, targetId)))
    } else {
      await this.dbs.db
        .update(comments)
        .set({ reactions: counts })
        .where(and(eq(comments.tenantId, tenantId), eq(comments.id, targetId)))
    }
    return counts
  }

  /** 반응 대상이 존재하는지(테넌트 스코프). 없으면 404. */
  private async assertTargetExists(
    tenantId: string,
    targetType: ReactionTarget,
    targetId: string
  ): Promise<void> {
    if (targetType === 'post') {
      const rows = await this.dbs.db
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.tenantId, tenantId), eq(posts.id, targetId)))
        .limit(1)
      if (!rows[0]) throw new NotFoundException('반응 대상 글을 찾을 수 없습니다')
    } else {
      const rows = await this.dbs.db
        .select({ id: comments.id })
        .from(comments)
        .where(and(eq(comments.tenantId, tenantId), eq(comments.id, targetId)))
        .limit(1)
      if (!rows[0]) throw new NotFoundException('반응 대상 댓글을 찾을 수 없습니다')
    }
  }
}
