import {
  renderMarkdown,
  type AdminPostListDto,
  type AdminPostsQuery,
  type AdminStatsDto,
  type CommentNodeDto,
  type ContentStatus,
  type CreateCommentInput,
  type CreatePostInput,
  type ModerateCommentInput,
  type ModeratePostInput,
  type PostDetailDto,
  type PostListDto,
  type PostReceiptDto,
  type PostSort,
  type PublicPostsQuery,
} from '@communitydesk/shared'
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'

import { BoardsService } from '../boards/boards.service'
import {
  toAdminPostDto,
  toCommentTree,
  toPostDetailDto,
  toPostSummaryDto,
} from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { comments, posts, tenants } from '../db/schema'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

const MAX_LIMIT = 100
const DEFAULT_PUBLIC_LIMIT = 20
const DEFAULT_ADMIN_LIMIT = 25

function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined) return fallback
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)))
}

type PostRow = typeof posts.$inferSelect

@Injectable()
export class PostsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly boards: BoardsService,
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 공개(publishable) ───────────────────────────────────────────────────────

  /**
   * 글 작성 — 무료 플랜 소프트 한도 검사 → 마크다운 살균 → 저장(visible) → postsCount 증가.
   * 영수증(id·status)만 반환.
   */
  async createPost(tenant: TenantRow, input: CreatePostInput): Promise<PostReceiptDto> {
    if (tenant.plan === 'free' && tenant.postsCount >= this.cfg.freePlanLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `무료 플랜 글 작성 한도(${this.cfg.freePlanLimit})를 초과했습니다. 플랜을 업그레이드하세요.`,
        },
        HttpStatus.PAYMENT_REQUIRED
      )
    }

    const board = await this.boards.getBySlugOrThrow(tenant.id, input.boardSlug)

    const bodyHtml = renderMarkdown(input.body)
    const status: ContentStatus = 'visible'

    const inserted = await this.dbs.db
      .insert(posts)
      .values({
        tenantId: tenant.id,
        boardId: board.id,
        authorMemberId: input.authorMemberId,
        authorName: input.authorName,
        title: input.title ?? null,
        body: input.body,
        bodyHtml,
        tags: input.tags,
        status,
        reactions: {},
        replyCount: 0,
      })
      .returning()
    const row = inserted[0]!

    await this.tenants.incrementPosts(tenant.id)

    return { id: row.id, status: row.status, createdAt: row.createdAt.toISOString() }
  }

  /** 보드의 공개 글 목록(visible 만, 페이지네이션). 고정글은 항상 먼저. */
  async listPublicPosts(
    tenant: TenantRow,
    boardSlug: string,
    query: PublicPostsQuery
  ): Promise<PostListDto> {
    const board = await this.boards.getBySlugOrThrow(tenant.id, boardSlug)
    const offset = Math.max(0, Math.trunc(query.offset ?? 0))
    const limit = clampLimit(query.limit, DEFAULT_PUBLIC_LIMIT)

    const conditions: SQL[] = [
      eq(posts.tenantId, tenant.id),
      eq(posts.boardId, board.id),
      eq(posts.status, 'visible'),
    ]
    if (query.tag) conditions.push(sql`${posts.tags} @> ${JSON.stringify([query.tag])}::jsonb`)
    const where = and(...conditions)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(posts)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.pinned), ...this.sortOrder(query.sort))
      .offset(offset)
      .limit(limit)

    return {
      boardSlug,
      items: rows.map((r) => toPostSummaryDto(r, boardSlug)),
      total,
      offset,
      limit,
    }
  }

  /** 정렬 표현(고정글 우선은 호출부에서 desc(pinned) 로 선행). */
  private sortOrder(sort: PostSort | undefined): SQL[] {
    switch (sort) {
      case 'replies':
        return [desc(posts.replyCount), desc(posts.createdAt)]
      case 'popular':
        // 반응 총합을 jsonb 에서 뽑아 정렬(없으면 0). 동률은 최신순.
        return [
          desc(sql`coalesce((SELECT sum(value::int) FROM jsonb_each_text(${posts.reactions})), 0)`),
          desc(posts.createdAt),
        ]
      case 'recent':
      default:
        return [desc(posts.createdAt)]
    }
  }

  /**
   * 글 상세 + 노출 댓글 트리. 읽기 카운트 증가 + 일별 방문 집계(베스트 에포트).
   * visitorId 가 있으면(호스트 앱이 x-member-id 로 전달) 그날 고유 방문자 중복 제거에 쓰인다.
   */
  async getPostDetail(
    tenant: TenantRow,
    postId: string,
    visitorId?: string
  ): Promise<PostDetailDto> {
    const row = await this.findVisiblePost(tenant.id, postId)
    const board = await this.boards.findById(tenant.id, row.boardId)
    const boardSlug = board?.slug ?? ''

    const commentRows = await this.dbs.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.tenantId, tenant.id),
          eq(comments.postId, postId),
          eq(comments.status, 'visible')
        )
      )
      .orderBy(asc(comments.createdAt))

    await this.tenants.incrementReads(tenant.id)
    await this.recordVisit(tenant.id, visitorId)

    return toPostDetailDto(row, boardSlug, commentRows)
  }

  /**
   * 일별 방문 집계 — (tenantId, 오늘) 버킷에 visits +1. visitorId 가 있고 그날 처음이면
   * uniqueVisitors +1. 둘 다 멱등(ON CONFLICT)이며 베스트 에포트(실패해도 읽기는 막지 않음).
   */
  async recordVisit(tenantId: string, visitorId?: string): Promise<void> {
    try {
      let countsUnique = false
      if (visitorId) {
        // 그날 이 멤버가 처음이면 1행 삽입 → uniqueVisitors 증가 대상.
        const seen = await this.dbs.db.execute(sql`
          INSERT INTO daily_visitor_seen (tenant_id, day, member_id)
          VALUES (${tenantId}, current_date, ${visitorId})
          ON CONFLICT (tenant_id, day, member_id) DO NOTHING
          RETURNING member_id
        `)
        countsUnique = this.rowsOf(seen).length > 0
      }

      const uniqInc = countsUnique ? 1 : 0
      await this.dbs.db.execute(sql`
        INSERT INTO daily_visits (tenant_id, day, visits, unique_visitors)
        VALUES (${tenantId}, current_date, 1, ${uniqInc})
        ON CONFLICT (tenant_id, day) DO UPDATE
          SET visits = daily_visits.visits + 1,
              unique_visitors = daily_visits.unique_visitors + ${uniqInc}
      `)
    } catch {
      // 베스트 에포트 — 집계 실패가 사용자 응답을 막지 않는다.
    }
  }

  /** 댓글 작성(중첩). 잠긴 글에는 작성 불가. parentId 는 같은 글의 댓글이어야 함. */
  async createComment(
    tenant: TenantRow,
    postId: string,
    input: CreateCommentInput
  ): Promise<PostReceiptDto> {
    const post = await this.findVisiblePost(tenant.id, postId)
    if (post.locked) throw new ForbiddenException('잠긴 글에는 댓글을 달 수 없습니다')

    if (input.parentId) {
      const parent = await this.dbs.db
        .select({ id: comments.id })
        .from(comments)
        .where(
          and(
            eq(comments.tenantId, tenant.id),
            eq(comments.postId, postId),
            eq(comments.id, input.parentId)
          )
        )
        .limit(1)
      if (!parent[0]) throw new NotFoundException('상위 댓글을 찾을 수 없습니다')
    }

    const bodyHtml = renderMarkdown(input.body)
    const inserted = await this.dbs.db
      .insert(comments)
      .values({
        tenantId: tenant.id,
        postId,
        parentId: input.parentId ?? null,
        authorMemberId: input.authorMemberId,
        authorName: input.authorName,
        body: input.body,
        bodyHtml,
        status: 'visible',
        reactions: {},
      })
      .returning()
    const row = inserted[0]!

    await this.recountReplies(tenant.id, postId)

    return { id: row.id, status: row.status, createdAt: row.createdAt.toISOString() }
  }

  // ── 어드민(secret/글로벌 토큰) ───────────────────────────────────────────────

  /** 글 목록(필터 + 페이지네이션, 최신순). 전체 필드. */
  async listAdminPosts(tenant: TenantRow, query: AdminPostsQuery): Promise<AdminPostListDto> {
    const offset = Math.max(0, Math.trunc(query.offset ?? 0))
    const limit = clampLimit(query.limit, DEFAULT_ADMIN_LIMIT)

    const conditions: SQL[] = [eq(posts.tenantId, tenant.id)]
    if (query.status) conditions.push(eq(posts.status, query.status))
    if (query.tag) conditions.push(sql`${posts.tags} @> ${JSON.stringify([query.tag])}::jsonb`)
    if (query.boardSlug) {
      const board = await this.boards.findBySlug(tenant.id, query.boardSlug)
      // 없는 보드 필터면 빈 결과.
      if (!board) return { items: [], total: 0, offset, limit }
      conditions.push(eq(posts.boardId, board.id))
    }
    const where = and(...conditions)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(posts)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .offset(offset)
      .limit(limit)

    // 보드 slug 매핑(한 번에).
    const boardList = await this.boards.listBoards(tenant)
    const idToSlug = new Map(boardList.map((b) => [b.id, b.slug]))

    return {
      items: rows.map((r) => toAdminPostDto(r, idToSlug.get(r.boardId) ?? '')),
      total,
      offset,
      limit,
    }
  }

  /**
   * 운영 대시보드 지표(테넌트 스코프). 정직성:
   * - 멤버 = 글/댓글을 쓴 고유 author_member_id (별도 회원 테이블 없음). total·todayNew 모두 real.
   * - totalTraffic·totalPosts 는 기존 누적 컬럼(real). today 트래픽/방문자는 일별 버킷(tracked-new,
   *   배포 이전 0). includePlatform 이면 플랫폼 전역(테넌트 수) 지표를 함께 반환.
   */
  async getStats(tenant: TenantRow, includePlatform = false): Promise<AdminStatsDto> {
    const tid = tenant.id

    // 고유 멤버: 글·댓글 작성자 합집합. total = 전체, todayNew = 첫 작성이 오늘인 멤버.
    const memberRows = this.rowsOf(
      await this.dbs.db.execute(sql`
        WITH authored AS (
          SELECT author_member_id AS member_id, created_at FROM posts WHERE tenant_id = ${tid}
          UNION ALL
          SELECT author_member_id AS member_id, created_at FROM comments WHERE tenant_id = ${tid}
        ),
        firsts AS (
          SELECT member_id, min(created_at) AS first_at FROM authored GROUP BY member_id
        )
        SELECT
          count(*)::int AS total_members,
          count(*) FILTER (WHERE first_at >= date_trunc('day', now()))::int AS today_new_members
        FROM firsts
      `)
    )
    const member = memberRows[0] ?? {}
    const totalMembers = this.numOf(member.total_members)
    const todayNewMembers = this.numOf(member.today_new_members)

    // 오늘 작성된 글 수.
    const todayPostRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.tenantId, tid), sql`${posts.createdAt} >= date_trunc('day', now())`))
    const todayPosts = Number(todayPostRows[0]?.c ?? 0)

    // 오늘 일별 방문 버킷 + 추적 시작일.
    const visitRows = this.rowsOf(
      await this.dbs.db.execute(sql`
        SELECT
          coalesce((
            SELECT visits FROM daily_visits WHERE tenant_id = ${tid} AND day = current_date
          ), 0)::int AS today_traffic,
          coalesce((
            SELECT unique_visitors FROM daily_visits WHERE tenant_id = ${tid} AND day = current_date
          ), 0)::int AS today_visitors,
          (SELECT min(day)::text FROM daily_visits WHERE tenant_id = ${tid}) AS tracked_since
      `)
    )
    const visit = visitRows[0] ?? {}

    const stats: AdminStatsDto = {
      todayVisitors: this.numOf(visit.today_visitors),
      todayTraffic: this.numOf(visit.today_traffic),
      totalTraffic: tenant.readsCount,
      todayNewMembers,
      totalMembers,
      todayPosts,
      totalPosts: tenant.postsCount,
      trackedSince: typeof visit.tracked_since === 'string' ? visit.tracked_since : null,
    }

    if (includePlatform) {
      const tenantRows = await this.dbs.db
        .select({
          total: sql<number>`count(*)::int`,
          today: sql<number>`count(*) FILTER (WHERE ${tenants.createdAt} >= date_trunc('day', now()))::int`,
        })
        .from(tenants)
      stats.platform = {
        totalTenants: Number(tenantRows[0]?.total ?? 0),
        todayNewTenants: Number(tenantRows[0]?.today ?? 0),
      }
    }

    return stats
  }

  /** db.execute 결과에서 행 배열을 드라이버 차이 없이 꺼낸다. */
  private rowsOf(res: unknown): Record<string, unknown>[] {
    const r = res as { rows?: unknown[] } | unknown[]
    const rows = Array.isArray(r) ? r : (r.rows ?? [])
    return rows as Record<string, unknown>[]
  }

  /** unknown 집계 값을 안전하게 number 로. */
  private numOf(v: unknown): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  /** 글 운영 — show|hide|pin|unpin|lock|unlock|approve. 멱등. */
  async moderatePost(tenant: TenantRow, id: string, input: ModeratePostInput): Promise<void> {
    await this.findOwnedPost(tenant.id, id)
    const patch: Partial<typeof posts.$inferInsert> = {}
    switch (input.action) {
      case 'show':
      case 'approve':
        patch.status = 'visible'
        break
      case 'hide':
        patch.status = 'hidden'
        break
      case 'pin':
        patch.pinned = true
        break
      case 'unpin':
        patch.pinned = false
        break
      case 'lock':
        patch.locked = true
        break
      case 'unlock':
        patch.locked = false
        break
      default:
        break
    }
    await this.dbs.db
      .update(posts)
      .set(patch)
      .where(and(eq(posts.tenantId, tenant.id), eq(posts.id, id)))
  }

  /** 글 삭제(+ 댓글 정리). */
  async deletePost(tenant: TenantRow, id: string): Promise<void> {
    await this.findOwnedPost(tenant.id, id)
    await this.dbs.db
      .delete(comments)
      .where(and(eq(comments.tenantId, tenant.id), eq(comments.postId, id)))
    await this.dbs.db.delete(posts).where(and(eq(posts.tenantId, tenant.id), eq(posts.id, id)))
  }

  /** 댓글 운영 — show|hide|approve. 노출 변화 시 replyCount 재계산. */
  async moderateComment(tenant: TenantRow, id: string, input: ModerateCommentInput): Promise<void> {
    const rows = await this.dbs.db
      .select()
      .from(comments)
      .where(and(eq(comments.tenantId, tenant.id), eq(comments.id, id)))
      .limit(1)
    const comment = rows[0]
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다')

    const status: ContentStatus = input.action === 'hide' ? 'hidden' : 'visible'
    await this.dbs.db
      .update(comments)
      .set({ status })
      .where(and(eq(comments.tenantId, tenant.id), eq(comments.id, id)))
    await this.recountReplies(tenant.id, comment.postId)
  }

  /** 댓글 삭제(+ replyCount 재계산). */
  async deleteComment(tenant: TenantRow, id: string): Promise<void> {
    const rows = await this.dbs.db
      .select()
      .from(comments)
      .where(and(eq(comments.tenantId, tenant.id), eq(comments.id, id)))
      .limit(1)
    const comment = rows[0]
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다')
    await this.dbs.db
      .delete(comments)
      .where(and(eq(comments.tenantId, tenant.id), eq(comments.id, id)))
    await this.recountReplies(tenant.id, comment.postId)
  }

  // ── 내부 헬퍼 ───────────────────────────────────────────────────────────────

  /** 노출(visible) 글 조회 — 없거나 숨김/검수대기면 404. */
  private async findVisiblePost(tenantId: string, id: string): Promise<PostRow> {
    const rows = await this.dbs.db
      .select()
      .from(posts)
      .where(and(eq(posts.tenantId, tenantId), eq(posts.id, id), eq(posts.status, 'visible')))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('글을 찾을 수 없습니다')
    return rows[0]
  }

  /** 테넌트 소유 글 조회(상태 무관) — 어드민 운영용. */
  private async findOwnedPost(tenantId: string, id: string): Promise<PostRow> {
    const rows = await this.dbs.db
      .select()
      .from(posts)
      .where(and(eq(posts.tenantId, tenantId), eq(posts.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('글을 찾을 수 없습니다')
    return rows[0]
  }

  /** 글의 노출 댓글 수를 세어 replyCount 캐시를 갱신. */
  private async recountReplies(tenantId: string, postId: string): Promise<void> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(comments)
      .where(
        and(
          eq(comments.tenantId, tenantId),
          eq(comments.postId, postId),
          eq(comments.status, 'visible')
        )
      )
    const count = Number(rows[0]?.c ?? 0)
    await this.dbs.db
      .update(posts)
      .set({ replyCount: count })
      .where(and(eq(posts.tenantId, tenantId), eq(posts.id, postId)))
  }

  /** 글/댓글 상세를 외부에서 댓글 트리만 필요할 때(테스트용 노출). */
  async commentTreeOf(tenantId: string, postId: string): Promise<CommentNodeDto[]> {
    const commentRows = await this.dbs.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.tenantId, tenantId),
          eq(comments.postId, postId),
          eq(comments.status, 'visible')
        )
      )
      .orderBy(asc(comments.createdAt))
    return toCommentTree(commentRows)
  }
}
