import { FREE_PLAN_LIMIT } from '@communitydesk/shared'
import { PGlite } from '@electric-sql/pglite'
import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { BoardsService } from '../boards/boards.service'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { ReactionsService } from '../reactions/reactions.service'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

import { PostsService } from './posts.service'

import type { AppConfig } from '../config'
import type { Database, DatabaseService } from '../db/database.service'

const cfg: AppConfig = {
  mode: 'self-hosted',
  port: 0,
  webOrigin: 'http://localhost',
  databaseUrl: null,
  pgliteDir: '.data/test',
  adminToken: 'test-admin',
  freePlanLimit: FREE_PLAN_LIMIT,
}

interface Ctx {
  dbs: DatabaseService
  tenants: TenantsService
  boards: BoardsService
  posts: PostsService
  reactions: ReactionsService
}

async function setup(): Promise<Ctx> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) await client.exec(m.sql)
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const tenants = new TenantsService(dbs)
  const boards = new BoardsService(dbs)
  const posts = new PostsService(dbs, boards, tenants, cfg)
  const reactions = new ReactionsService(dbs)
  return { dbs, tenants, boards, posts, reactions }
}

async function makeTenant(
  tenants: TenantsService,
  over: { plan?: 'free' | 'pro' } = {}
): Promise<TenantRow> {
  const res = await tenants.createTenant({ name: 'T', corsOrigins: ['*'] })
  const row = (await tenants.findById(res.tenant.id))!
  if (over.plan) {
    await tenants.updateTenant(row.id, { plan: over.plan })
    return (await tenants.findById(row.id))!
  }
  return row
}

const basePost = {
  boardSlug: 'free',
  authorMemberId: 'u1',
  authorName: '홍길동',
  title: '제목',
  body: '본문 내용',
  tags: [] as string[],
} as const

describe('Community (PGlite)', () => {
  let ctx: Ctx
  let tenant: TenantRow

  beforeEach(async () => {
    ctx = await setup()
    tenant = await makeTenant(ctx.tenants)
    await ctx.boards.createBoard(tenant, { slug: 'free', name: '자유', kind: 'board' })
    await ctx.boards.createBoard(tenant, { slug: 'notice', name: '공지', kind: 'board' })
  })

  // ── 게시판 ──────────────────────────────────────────────────────────────────

  it('게시판 목록은 노출 글 수를 포함', async () => {
    await ctx.posts.createPost(tenant, { ...basePost })
    const list = await ctx.boards.listBoards(tenant)
    const free = list.find((b) => b.slug === 'free')!
    expect(free.postCount).toBe(1)
    expect(list.find((b) => b.slug === 'notice')!.postCount).toBe(0)
  })

  it('없는 보드에 글 작성 시 404', async () => {
    await expect(
      ctx.posts.createPost(tenant, { ...basePost, boardSlug: 'ghost' })
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  // ── 글 작성 + 살균 ──────────────────────────────────────────────────────────

  it('글 작성 시 마크다운을 안전 HTML 로 변환해 저장(XSS 차단)', async () => {
    const receipt = await ctx.posts.createPost(tenant, {
      ...basePost,
      body: '**굵게** <script>alert(1)</script> [링크](https://x.com)',
    })
    const detail = await ctx.posts.getPostDetail(tenant, receipt.id)
    expect(detail.bodyHtml).toContain('<strong>굵게</strong>')
    expect(detail.bodyHtml).not.toContain('<script>')
    expect(detail.bodyHtml).toContain('&lt;script&gt;')
    expect(detail.bodyHtml).toContain('href="https://x.com"')
    // 원문도 보존(편집용)
    expect(detail.body).toContain('<script>')
  })

  it('글 작성 시 postsCount 증가', async () => {
    await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.createPost(tenant, { ...basePost })
    expect((await ctx.tenants.findById(tenant.id))!.postsCount).toBe(2)
  })

  it('무료 플랜 글 작성 소프트 한도 초과 시 402', async () => {
    const free = await makeTenant(ctx.tenants, { plan: 'free' })
    await ctx.boards.createBoard(free, { slug: 'free', name: '자유', kind: 'board' })
    await ctx.dbs.db
      .update(schema.tenants)
      .set({ postsCount: cfg.freePlanLimit })
      .where(eq(schema.tenants.id, free.id))
    const atLimit = (await ctx.tenants.findById(free.id))!
    await expect(ctx.posts.createPost(atLimit, { ...basePost })).rejects.toBeInstanceOf(
      HttpException
    )
  })

  it('pro 플랜은 한도 무관하게 작성 가능', async () => {
    const pro = await makeTenant(ctx.tenants, { plan: 'pro' })
    await ctx.boards.createBoard(pro, { slug: 'free', name: '자유', kind: 'board' })
    await ctx.dbs.db
      .update(schema.tenants)
      .set({ postsCount: cfg.freePlanLimit + 50 })
      .where(eq(schema.tenants.id, pro.id))
    const over = (await ctx.tenants.findById(pro.id))!
    const r = await ctx.posts.createPost(over, { ...basePost })
    expect(r.id).toBeTruthy()
  })

  // ── 중첩 댓글 트리 ──────────────────────────────────────────────────────────

  it('중첩 댓글이 트리로 조립되고 depth 가 부여됨', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    const c1 = await ctx.posts.createComment(tenant, post.id, {
      authorMemberId: 'u2',
      authorName: 'A',
      body: '최상위',
    })
    const c2 = await ctx.posts.createComment(tenant, post.id, {
      authorMemberId: 'u3',
      authorName: 'B',
      body: '답글',
      parentId: c1.id,
    })
    await ctx.posts.createComment(tenant, post.id, {
      authorMemberId: 'u4',
      authorName: 'C',
      body: '답답글',
      parentId: c2.id,
    })

    const detail = await ctx.posts.getPostDetail(tenant, post.id)
    expect(detail.comments).toHaveLength(1)
    expect(detail.comments[0]!.depth).toBe(0)
    expect(detail.comments[0]!.children[0]!.depth).toBe(1)
    expect(detail.comments[0]!.children[0]!.children[0]!.depth).toBe(2)
    expect(detail.replyCount).toBe(3)
  })

  it('댓글 본문도 살균됨', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.createComment(tenant, post.id, {
      authorMemberId: 'u2',
      authorName: 'A',
      body: '<img src=x onerror=alert(1)> *기울임*',
    })
    const detail = await ctx.posts.getPostDetail(tenant, post.id)
    expect(detail.comments[0]!.bodyHtml).not.toContain('<img')
    expect(detail.comments[0]!.bodyHtml).toContain('<em>기울임</em>')
  })

  it('없는 parentId 댓글은 404, 잠긴 글엔 댓글 불가', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    await expect(
      ctx.posts.createComment(tenant, post.id, {
        authorMemberId: 'u2',
        authorName: 'A',
        body: 'x',
        parentId: '00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toBeInstanceOf(NotFoundException)

    await ctx.posts.moderatePost(tenant, post.id, { action: 'lock' })
    await expect(
      ctx.posts.createComment(tenant, post.id, { authorMemberId: 'u2', authorName: 'A', body: 'x' })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  // ── 반응 토글 ────────────────────────────────────────────────────────────────

  it('반응은 토글 — 같은 멤버가 같은 kind 재요청 시 해제', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    const r1 = await ctx.reactions.toggle(tenant, {
      targetType: 'post',
      targetId: post.id,
      memberId: 'm1',
      kind: 'like',
    })
    expect(r1.active).toBe(true)
    expect(r1.reactions.like).toBe(1)

    const r2 = await ctx.reactions.toggle(tenant, {
      targetType: 'post',
      targetId: post.id,
      memberId: 'm1',
      kind: 'like',
    })
    expect(r2.active).toBe(false)
    expect(r2.reactions.like ?? 0).toBe(0)
  })

  it('서로 다른 멤버·kind 의 반응은 누적', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.reactions.toggle(tenant, {
      targetType: 'post',
      targetId: post.id,
      memberId: 'm1',
      kind: 'like',
    })
    await ctx.reactions.toggle(tenant, {
      targetType: 'post',
      targetId: post.id,
      memberId: 'm2',
      kind: 'like',
    })
    const r = await ctx.reactions.toggle(tenant, {
      targetType: 'post',
      targetId: post.id,
      memberId: 'm1',
      kind: 'love',
    })
    expect(r.reactions.like).toBe(2)
    expect(r.reactions.love).toBe(1)

    // 캐시가 글 상세에도 반영됨
    const detail = await ctx.posts.getPostDetail(tenant, post.id)
    expect(detail.reactions.like).toBe(2)
  })

  it('댓글에도 반응 가능', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    const c = await ctx.posts.createComment(tenant, post.id, {
      authorMemberId: 'u2',
      authorName: 'A',
      body: 'hi',
    })
    const r = await ctx.reactions.toggle(tenant, {
      targetType: 'comment',
      targetId: c.id,
      memberId: 'm1',
      kind: 'laugh',
    })
    expect(r.reactions.laugh).toBe(1)
  })

  it('없는 반응 대상이면 404', async () => {
    await expect(
      ctx.reactions.toggle(tenant, {
        targetType: 'post',
        targetId: '00000000-0000-0000-0000-000000000000',
        memberId: 'm1',
        kind: 'like',
      })
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  // ── 운영(moderation) 상태 ────────────────────────────────────────────────────

  it('hide 하면 공개 목록·상세에서 사라지고, show 하면 복귀', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.moderatePost(tenant, post.id, { action: 'hide' })

    const list = await ctx.posts.listPublicPosts(tenant, 'free', {})
    expect(list.items).toHaveLength(0)
    await expect(ctx.posts.getPostDetail(tenant, post.id)).rejects.toBeInstanceOf(NotFoundException)

    await ctx.posts.moderatePost(tenant, post.id, { action: 'show' })
    const list2 = await ctx.posts.listPublicPosts(tenant, 'free', {})
    expect(list2.items).toHaveLength(1)
  })

  it('pin 한 글은 목록 최상단(고정 우선)', async () => {
    const old = await ctx.posts.createPost(tenant, { ...basePost, title: '먼저' })
    await ctx.posts.createPost(tenant, { ...basePost, title: '나중' })
    await ctx.posts.moderatePost(tenant, old.id, { action: 'pin' })

    const list = await ctx.posts.listPublicPosts(tenant, 'free', { sort: 'recent' })
    expect(list.items[0]!.title).toBe('먼저')
    expect(list.items[0]!.pinned).toBe(true)
  })

  it('lock/unlock 운영이 잠금 상태를 토글', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.moderatePost(tenant, post.id, { action: 'lock' })
    expect((await ctx.posts.getPostDetail(tenant, post.id)).locked).toBe(true)
    await ctx.posts.moderatePost(tenant, post.id, { action: 'unlock' })
    expect((await ctx.posts.getPostDetail(tenant, post.id)).locked).toBe(false)
  })

  it('댓글 hide 시 트리에서 빠지고 replyCount 감소', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    const c = await ctx.posts.createComment(tenant, post.id, {
      authorMemberId: 'u2',
      authorName: 'A',
      body: 'spam',
    })
    expect((await ctx.posts.getPostDetail(tenant, post.id)).replyCount).toBe(1)
    await ctx.posts.moderateComment(tenant, c.id, { action: 'hide' })
    const detail = await ctx.posts.getPostDetail(tenant, post.id)
    expect(detail.comments).toHaveLength(0)
    expect(detail.replyCount).toBe(0)
  })

  it('글 삭제 시 댓글도 정리', async () => {
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.createComment(tenant, post.id, {
      authorMemberId: 'u2',
      authorName: 'A',
      body: 'x',
    })
    await ctx.posts.deletePost(tenant, post.id)
    const admin = await ctx.posts.listAdminPosts(tenant, {})
    expect(admin.total).toBe(0)
  })

  it('타 테넌트의 글은 운영/삭제 불가(404)', async () => {
    const other = await makeTenant(ctx.tenants)
    const post = await ctx.posts.createPost(tenant, { ...basePost })
    await expect(ctx.posts.moderatePost(other, post.id, { action: 'hide' })).rejects.toBeInstanceOf(
      NotFoundException
    )
    await expect(ctx.posts.deletePost(other, post.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  // ── 페이지네이션 / 필터 ───────────────────────────────────────────────────────

  it('공개 목록 페이지네이션(offset/limit)', async () => {
    for (let i = 0; i < 5; i += 1) {
      await ctx.posts.createPost(tenant, { ...basePost, title: `p${i}` })
    }
    const page = await ctx.posts.listPublicPosts(tenant, 'free', { offset: 2, limit: 2 })
    expect(page.total).toBe(5)
    expect(page.items).toHaveLength(2)
    expect(page.offset).toBe(2)
  })

  it('태그 필터가 동작', async () => {
    await ctx.posts.createPost(tenant, { ...basePost, title: 'q', tags: ['질문'] })
    await ctx.posts.createPost(tenant, { ...basePost, title: 'c', tags: ['잡담'] })
    const filtered = await ctx.posts.listPublicPosts(tenant, 'free', { tag: '질문' })
    expect(filtered.items).toHaveLength(1)
    expect(filtered.items[0]!.title).toBe('q')
  })

  it('어드민 목록은 status 필터 + pending 도 노출', async () => {
    const visible = await ctx.posts.createPost(tenant, { ...basePost, title: 'v' })
    const hidden = await ctx.posts.createPost(tenant, { ...basePost, title: 'h' })
    await ctx.posts.moderatePost(tenant, hidden.id, { action: 'hide' })

    const all = await ctx.posts.listAdminPosts(tenant, {})
    expect(all.total).toBe(2)
    const hiddenOnly = await ctx.posts.listAdminPosts(tenant, { status: 'hidden' })
    expect(hiddenOnly.total).toBe(1)
    expect(hiddenOnly.items[0]!.id).toBe(hidden.id)

    const visibleOnly = await ctx.posts.listAdminPosts(tenant, { status: 'visible' })
    expect(visibleOnly.items.some((p) => p.id === visible.id)).toBe(true)
  })

  it('어드민 목록 boardSlug 필터', async () => {
    await ctx.posts.createPost(tenant, { ...basePost, boardSlug: 'free', title: 'f' })
    await ctx.posts.createPost(tenant, { ...basePost, boardSlug: 'notice', title: 'n' })
    const noticeOnly = await ctx.posts.listAdminPosts(tenant, { boardSlug: 'notice' })
    expect(noticeOnly.total).toBe(1)
    expect(noticeOnly.items[0]!.title).toBe('n')
    expect(noticeOnly.items[0]!.boardSlug).toBe('notice')
  })

  it('공개 목록은 테넌트 격리(다른 테넌트 글 섞이지 않음)', async () => {
    const other = await makeTenant(ctx.tenants)
    await ctx.boards.createBoard(other, { slug: 'free', name: '자유', kind: 'board' })
    await ctx.posts.createPost(tenant, { ...basePost, title: 'mine' })
    await ctx.posts.createPost(other, { ...basePost, title: 'theirs' })

    const mine = await ctx.posts.listPublicPosts(tenant, 'free', {})
    expect(mine.items).toHaveLength(1)
    expect(mine.items[0]!.title).toBe('mine')
  })

  // ── 트래픽/분석 지표 ──────────────────────────────────────────────────────────

  it('getStats 가 고유 멤버(글+댓글 작성자)를 정확히 집계', async () => {
    // u1 이 글 작성(basePost.authorMemberId='u1'), u2/u3 가 댓글 작성.
    const p = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.createComment(tenant, p.id, {
      authorMemberId: 'u2',
      authorName: 'B',
      body: 'x',
    })
    await ctx.posts.createComment(tenant, p.id, {
      authorMemberId: 'u3',
      authorName: 'C',
      body: 'y',
    })
    // u1 이 한 번 더 글 → 멤버 수는 그대로 3(중복 제거).
    await ctx.posts.createPost(tenant, { ...basePost, title: 'again' })

    // totalPosts 는 전달된 테넌트 행의 postsCount 라 최신 행을 다시 읽는다.
    const fresh = (await ctx.tenants.findById(tenant.id))!
    const stats = await ctx.posts.getStats(fresh)
    expect(stats.totalMembers).toBe(3)
    // 시드 시간이 모두 오늘이므로 오늘 신규 멤버도 3.
    expect(stats.todayNewMembers).toBe(3)
    expect(stats.totalPosts).toBe(2)
    expect(stats.todayPosts).toBe(2)
  })

  it('getStats 의 totalTraffic 는 readsCount, 멤버는 테넌트 격리', async () => {
    const other = await makeTenant(ctx.tenants)
    await ctx.boards.createBoard(other, { slug: 'free', name: '자유', kind: 'board' })
    await ctx.posts.createPost(other, { ...basePost, authorMemberId: 'zzz', title: 't' })

    const p = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.getPostDetail(tenant, p.id) // readsCount +1
    await ctx.posts.getPostDetail(tenant, p.id) // readsCount +1

    const fresh = (await ctx.tenants.findById(tenant.id))!
    const stats = await ctx.posts.getStats(fresh)
    expect(stats.totalTraffic).toBe(2)
    expect(stats.totalMembers).toBe(1) // 'u1' 만 — 다른 테넌트의 'zzz' 는 안 섞임
  })

  it('recordVisit 가 오늘 트래픽을 누적하고 고유 방문자를 멤버별로 1회만 집계', async () => {
    await ctx.posts.recordVisit(tenant.id, 'm1')
    await ctx.posts.recordVisit(tenant.id, 'm1') // 같은 멤버 재방문 — 고유엔 미반영
    await ctx.posts.recordVisit(tenant.id, 'm2')
    await ctx.posts.recordVisit(tenant.id) // 익명 — 트래픽만 +1

    const stats = await ctx.posts.getStats(tenant)
    expect(stats.todayTraffic).toBe(4)
    expect(stats.todayVisitors).toBe(2) // m1, m2
    expect(stats.trackedSince).toBeTruthy()
  })

  it('getPostDetail 이 x-member-id(visitorId)로 오늘 방문자를 집계', async () => {
    const p = await ctx.posts.createPost(tenant, { ...basePost })
    await ctx.posts.getPostDetail(tenant, p.id, 'reader-1')
    await ctx.posts.getPostDetail(tenant, p.id, 'reader-1') // 같은 독자 — 고유 1
    await ctx.posts.getPostDetail(tenant, p.id, 'reader-2')

    const stats = await ctx.posts.getStats(tenant)
    expect(stats.todayVisitors).toBe(2)
    expect(stats.todayTraffic).toBe(3)
  })

  it('getStats(includePlatform) 가 플랫폼 전역 테넌트 수를 노출', async () => {
    await makeTenant(ctx.tenants) // 테넌트 2개째

    const tenantOnly = await ctx.posts.getStats(tenant)
    expect(tenantOnly.platform).toBeUndefined()

    const withPlatform = await ctx.posts.getStats(tenant, true)
    expect(withPlatform.platform?.totalTenants).toBe(2)
    expect(withPlatform.platform?.todayNewTenants).toBe(2)
  })
})
