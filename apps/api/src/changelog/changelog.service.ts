import {
  computeUnread,
  DEFAULT_ENTRY_LIMIT,
  MAX_ENTRY_LIMIT,
  type AdminEntryListDto,
  type ChangelogEntryDto,
  type CreateEntryInput,
  type ListEntriesQuery,
  type PublicChangelogDto,
  type SeenInput,
  type UnreadCountDto,
  type UpdateEntryInput,
} from '@changelogdesk/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, gt, sql } from 'drizzle-orm'

import { toEntryDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { changelogEntries, readReceipts } from '../db/schema'

import type { TenantRow } from '../tenants/tenant-context.service'

@Injectable()
export class ChangelogService {
  constructor(private readonly dbs: DatabaseService) {}

  // ── 공개(위젯) ────────────────────────────────────────────────────────────

  /** 위젯용 게시 항목 목록(최신순). since(ISO) 가 있으면 그 이후 게시분만. */
  async listPublic(tenant: TenantRow, query: ListEntriesQuery): Promise<PublicChangelogDto> {
    const limit = Math.min(MAX_ENTRY_LIMIT, Math.max(1, query.limit ?? DEFAULT_ENTRY_LIMIT))

    const conds = [eq(changelogEntries.tenantId, tenant.id), eq(changelogEntries.isPublished, true)]
    if (query.since) conds.push(gt(changelogEntries.publishedAt, new Date(query.since)))
    const where = and(...conds)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(changelogEntries)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(changelogEntries)
      .where(where)
      .orderBy(desc(changelogEntries.publishedAt))
      .limit(limit)

    return {
      tenant: { name: tenant.name, slug: tenant.slug },
      items: rows.map(toEntryDto),
      total,
    }
  }

  /** 마지막 본 항목 기록(upsert) — 미읽음 배지용. */
  async recordSeen(tenant: TenantRow, input: SeenInput): Promise<void> {
    await this.dbs.db
      .insert(readReceipts)
      .values({
        tenantId: tenant.id,
        anonId: input.anonId,
        lastSeenEntryId: input.lastSeenEntryId ?? null,
        seenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [readReceipts.tenantId, readReceipts.anonId],
        set: { lastSeenEntryId: input.lastSeenEntryId ?? null, seenAt: new Date() },
      })
  }

  /** anonId 의 미읽음 개수(마지막 본 이후 게시된 항목 수). */
  async unreadCount(tenant: TenantRow, anonId: string): Promise<UnreadCountDto> {
    const published = await this.dbs.db
      .select({ id: changelogEntries.id })
      .from(changelogEntries)
      .where(and(eq(changelogEntries.tenantId, tenant.id), eq(changelogEntries.isPublished, true)))
      .orderBy(desc(changelogEntries.publishedAt))
    const ids = published.map((r) => r.id)

    const receipt = await this.dbs.db
      .select({ lastSeen: readReceipts.lastSeenEntryId })
      .from(readReceipts)
      .where(and(eq(readReceipts.tenantId, tenant.id), eq(readReceipts.anonId, anonId)))
      .limit(1)

    const result = computeUnread(ids, receipt[0]?.lastSeen ?? null)
    return { unreadCount: result.unreadCount, latestEntryId: result.latestEntryId }
  }

  // ── 어드민(CRUD) ──────────────────────────────────────────────────────────

  /** 어드민 항목 목록(게시·미게시 모두, 최신 생성순). */
  async listAdmin(tenant: TenantRow): Promise<AdminEntryListDto> {
    const rows = await this.dbs.db
      .select()
      .from(changelogEntries)
      .where(eq(changelogEntries.tenantId, tenant.id))
      .orderBy(desc(changelogEntries.createdAt))
    return { items: rows.map(toEntryDto), total: rows.length }
  }

  /** 항목 단건. */
  async getOne(tenant: TenantRow, id: string): Promise<ChangelogEntryDto> {
    return toEntryDto(await this.require(tenant.id, id))
  }

  /** 항목 생성. isPublished=true 인데 publishedAt 미지정이면 now() 로 채운다. */
  async create(tenant: TenantRow, input: CreateEntryInput): Promise<ChangelogEntryDto> {
    const publishedAt = input.isPublished
      ? input.publishedAt
        ? new Date(input.publishedAt)
        : new Date()
      : input.publishedAt
        ? new Date(input.publishedAt)
        : null

    const inserted = await this.dbs.db
      .insert(changelogEntries)
      .values({
        tenantId: tenant.id,
        title: input.title,
        bodyMarkdown: input.bodyMarkdown,
        tag: input.tag,
        version: input.version ?? null,
        category: input.category ?? null,
        isPublished: input.isPublished,
        publishedAt,
      })
      .returning()
    return toEntryDto(inserted[0]!)
  }

  /** 항목 수정(부분 갱신 + 게시 토글). */
  async update(tenant: TenantRow, id: string, input: UpdateEntryInput): Promise<ChangelogEntryDto> {
    const existing = await this.require(tenant.id, id)

    const patch: Partial<typeof changelogEntries.$inferInsert> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.bodyMarkdown !== undefined) patch.bodyMarkdown = input.bodyMarkdown
    if (input.tag !== undefined) patch.tag = input.tag
    if (input.version !== undefined) patch.version = input.version
    if (input.category !== undefined) patch.category = input.category

    // 게시 상태 전이 — 미게시→게시면서 publishedAt 이 없으면 now() 로 채운다.
    if (input.isPublished !== undefined) {
      patch.isPublished = input.isPublished
      if (input.isPublished && !existing.publishedAt && input.publishedAt === undefined) {
        patch.publishedAt = new Date()
      }
    }
    if (input.publishedAt !== undefined) {
      patch.publishedAt = input.publishedAt ? new Date(input.publishedAt) : null
    }

    const updated = await this.dbs.db
      .update(changelogEntries)
      .set(patch)
      .where(and(eq(changelogEntries.tenantId, tenant.id), eq(changelogEntries.id, id)))
      .returning()
    return toEntryDto(updated[0]!)
  }

  /** 항목 삭제. */
  async remove(tenant: TenantRow, id: string): Promise<void> {
    await this.require(tenant.id, id)
    await this.dbs.db
      .delete(changelogEntries)
      .where(and(eq(changelogEntries.tenantId, tenant.id), eq(changelogEntries.id, id)))
  }

  private async require(
    tenantId: string,
    id: string
  ): Promise<typeof changelogEntries.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(changelogEntries)
      .where(and(eq(changelogEntries.tenantId, tenantId), eq(changelogEntries.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('체인지로그 항목을 찾을 수 없습니다')
    return rows[0]
  }
}
