import { and, desc, eq } from 'drizzle-orm'

import {
  type CommunityKind,
  type CommunityPostDto,
  type CommunityStorePort,
  type CreatePostInput,
} from '../community/tokens'
import { DatabaseService } from '../db/database.service'
import { communityPosts } from '../db/schema'

type Row = typeof communityPosts.$inferSelect

function toDto(row: Row): CommunityPostDto {
  const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)
  return {
    id: row.id,
    kind: row.kind as CommunityKind,
    channel: row.channel ?? null,
    parentId: row.parentId ?? null,
    title: row.title ?? null,
    author: row.author,
    authorId: row.authorKey,
    body: row.body,
    createdAt: created.toISOString(),
  }
}

/** 커뮤니티 영속화(Drizzle) — 채팅·게시판·댓글 단일 테이블(community_posts). */
export class DrizzleCommunityStore implements CommunityStorePort {
  constructor(private readonly dbs: DatabaseService) {}

  async list(appId: string, kind?: CommunityKind, limit = 500): Promise<CommunityPostDto[]> {
    const where = kind
      ? and(eq(communityPosts.appId, appId), eq(communityPosts.kind, kind))
      : eq(communityPosts.appId, appId)
    const rows = await this.dbs.db
      .select()
      .from(communityPosts)
      .where(where)
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit)
    return rows.map(toDto)
  }

  async create(appId: string, input: CreatePostInput): Promise<CommunityPostDto> {
    const [row] = await this.dbs.db
      .insert(communityPosts)
      .values({
        appId,
        kind: input.kind,
        channel: input.channel ?? null,
        parentId: input.parentId ?? null,
        title: input.title ?? null,
        author: input.author,
        authorKey: input.authorKey,
        body: input.body,
      })
      .returning()
    return toDto(row)
  }

  async remove(appId: string, id: string, authorKey: string): Promise<boolean> {
    const res = await this.dbs.db
      .delete(communityPosts)
      .where(
        and(
          eq(communityPosts.appId, appId),
          eq(communityPosts.id, id),
          eq(communityPosts.authorKey, authorKey)
        )
      )
      .returning({ id: communityPosts.id })
    return res.length > 0
  }
}
