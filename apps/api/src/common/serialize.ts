import {
  buildCommentTree,
  markdownToPlainText,
  type AdminPostDto,
  type BoardDto,
  type CommentNodeDto,
  type PostDetailDto,
  type PostSummaryDto,
  type ReactionCounts,
  type TenantDto,
} from '@communitydesk/shared'

import type { boards, comments, posts, tenants } from '../db/schema'

type TenantRow = typeof tenants.$inferSelect
type BoardRow = typeof boards.$inferSelect
type PostRow = typeof posts.$inferSelect
type CommentRow = typeof comments.$inferSelect

const iso = (d: Date | string): string =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString()

const reactionsOf = (r: ReactionCounts | null | undefined): ReactionCounts => r ?? {}

/** 테넌트 공개 표현 — secretKeyHash 는 절대 포함하지 않는다. */
export function toTenantDto(row: TenantRow): TenantDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    publishableKey: row.publishableKey,
    corsOrigins: row.corsOrigins ?? [],
    plan: row.plan,
    postsCount: row.postsCount,
    readsCount: row.readsCount,
    createdAt: iso(row.createdAt),
  }
}

/** 게시판 공개 표현(+ 노출 글 수). */
export function toBoardDto(row: BoardRow, postCount: number): BoardDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    kind: row.kind,
    postCount,
    createdAt: iso(row.createdAt),
  }
}

/** 공개 글 목록 항목(요약 — 본문 HTML 대신 텍스트 미리보기). */
export function toPostSummaryDto(row: PostRow, boardSlug: string): PostSummaryDto {
  return {
    id: row.id,
    boardSlug,
    authorName: row.authorName,
    title: row.title ?? null,
    excerpt: markdownToPlainText(row.body, 180),
    tags: row.tags ?? [],
    pinned: row.pinned,
    locked: row.locked,
    reactions: reactionsOf(row.reactions),
    replyCount: row.replyCount,
    createdAt: iso(row.createdAt),
  }
}

/** 공개 댓글 → 트리 노드 DTO. 숨김/검수대기 댓글은 호출자가 미리 제외한다. */
export function toCommentTree(rows: CommentRow[]): CommentNodeDto[] {
  const tree = buildCommentTree(
    rows.map((r) => ({
      id: r.id,
      parentId: r.parentId ?? null,
      authorName: r.authorName,
      bodyHtml: r.bodyHtml,
      reactions: reactionsOf(r.reactions),
      createdAt: iso(r.createdAt),
    }))
  )
  // buildCommentTree 가 children/depth 를 추가한 노드를 DTO 형태로 매핑(재귀).
  const map = (node: (typeof tree)[number]): CommentNodeDto => ({
    id: node.id,
    parentId: node.parentId,
    authorName: node.authorName,
    bodyHtml: node.bodyHtml,
    reactions: node.reactions,
    depth: node.depth,
    createdAt: node.createdAt,
    children: node.children.map(map),
  })
  return tree.map(map)
}

/** 공개 글 상세(살균 HTML 본문 + 댓글 트리). */
export function toPostDetailDto(
  row: PostRow,
  boardSlug: string,
  comments: CommentRow[]
): PostDetailDto {
  return {
    id: row.id,
    boardSlug,
    authorMemberId: row.authorMemberId,
    authorName: row.authorName,
    title: row.title ?? null,
    bodyHtml: row.bodyHtml,
    body: row.body,
    tags: row.tags ?? [],
    pinned: row.pinned,
    locked: row.locked,
    reactions: reactionsOf(row.reactions),
    replyCount: row.replyCount,
    createdAt: iso(row.createdAt),
    comments: toCommentTree(comments),
  }
}

/** 어드민 글(전체 필드). */
export function toAdminPostDto(row: PostRow, boardSlug: string): AdminPostDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    boardId: row.boardId,
    boardSlug,
    authorMemberId: row.authorMemberId,
    authorName: row.authorName,
    title: row.title ?? null,
    body: row.body,
    bodyHtml: row.bodyHtml,
    tags: row.tags ?? [],
    pinned: row.pinned,
    locked: row.locked,
    status: row.status,
    reactions: reactionsOf(row.reactions),
    replyCount: row.replyCount,
    createdAt: iso(row.createdAt),
  }
}
