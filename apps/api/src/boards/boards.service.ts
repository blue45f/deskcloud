import { type BoardDto, type CreateBoardInput, type UpdateBoardInput } from '@communitydesk/shared'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'

import { toBoardDto } from '../common/serialize'
import { DatabaseService } from '../db/database.service'
import { boards, posts } from '../db/schema'

import type { TenantRow } from '../tenants/tenants.service'

export type BoardRow = typeof boards.$inferSelect

@Injectable()
export class BoardsService {
  constructor(private readonly dbs: DatabaseService) {}

  /** 테넌트의 게시판·카페 목록(+ 각 보드의 노출 글 수). slug 오름차순. */
  async listBoards(tenant: TenantRow): Promise<BoardDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(boards)
      .where(eq(boards.tenantId, tenant.id))
      .orderBy(boards.slug)

    // 보드별 노출 글 수를 한 번에 집계.
    const counts = await this.dbs.db
      .select({ boardId: posts.boardId, c: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.tenantId, tenant.id), eq(posts.status, 'visible')))
      .groupBy(posts.boardId)
    const countMap = new Map(counts.map((r) => [r.boardId, Number(r.c)]))

    return rows.map((b) => toBoardDto(b, countMap.get(b.id) ?? 0))
  }

  /** slug 로 보드 조회(테넌트 스코프). 없으면 null. */
  async findBySlug(tenantId: string, slug: string): Promise<BoardRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(boards)
      .where(and(eq(boards.tenantId, tenantId), eq(boards.slug, slug)))
      .limit(1)
    return rows[0] ?? null
  }

  /** id 로 보드 조회(테넌트 스코프). 없으면 null. */
  async findById(tenantId: string, id: string): Promise<BoardRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(boards)
      .where(and(eq(boards.tenantId, tenantId), eq(boards.id, id)))
      .limit(1)
    return rows[0] ?? null
  }

  /** slug 로 보드를 가져오되 없으면 404. (공개 글 목록 등에서 사용) */
  async getBySlugOrThrow(tenantId: string, slug: string): Promise<BoardRow> {
    const board = await this.findBySlug(tenantId, slug)
    if (!board) throw new NotFoundException('게시판을 찾을 수 없습니다')
    return board
  }

  // ── 어드민 ────────────────────────────────────────────────────────────────

  /** 게시판 생성(어드민). slug 충돌 시 409. */
  async createBoard(tenant: TenantRow, input: CreateBoardInput): Promise<BoardDto> {
    const existing = await this.findBySlug(tenant.id, input.slug)
    if (existing) throw new ConflictException('이미 사용 중인 slug 입니다')

    const inserted = await this.dbs.db
      .insert(boards)
      .values({
        tenantId: tenant.id,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        kind: input.kind,
      })
      .returning()
    return toBoardDto(inserted[0]!, 0)
  }

  /** 게시판 수정(어드민, 부분 갱신). */
  async updateBoard(tenant: TenantRow, id: string, input: UpdateBoardInput): Promise<BoardDto> {
    const board = await this.findById(tenant.id, id)
    if (!board) throw new NotFoundException('게시판을 찾을 수 없습니다')

    const patch: Partial<typeof boards.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.description !== undefined) patch.description = input.description ?? null
    if (input.kind !== undefined) patch.kind = input.kind

    const updated = await this.dbs.db
      .update(boards)
      .set(patch)
      .where(and(eq(boards.tenantId, tenant.id), eq(boards.id, id)))
      .returning()
    const count = await this.visiblePostCount(tenant.id, id)
    return toBoardDto(updated[0]!, count)
  }

  /** 게시판 삭제(어드민) — 글/댓글/반응도 함께 정리. */
  async deleteBoard(tenant: TenantRow, id: string): Promise<void> {
    const board = await this.findById(tenant.id, id)
    if (!board) throw new NotFoundException('게시판을 찾을 수 없습니다')
    await this.dbs.db.delete(posts).where(and(eq(posts.tenantId, tenant.id), eq(posts.boardId, id)))
    await this.dbs.db.delete(boards).where(and(eq(boards.tenantId, tenant.id), eq(boards.id, id)))
  }

  private async visiblePostCount(tenantId: string, boardId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(posts)
      .where(
        and(eq(posts.tenantId, tenantId), eq(posts.boardId, boardId), eq(posts.status, 'visible'))
      )
    return Number(rows[0]?.c ?? 0)
  }
}
