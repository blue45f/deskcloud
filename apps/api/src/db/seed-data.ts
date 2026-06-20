import { renderMarkdown } from '@communitydesk/shared'
import { sql } from 'drizzle-orm'

import { hashSecretKey } from '../common/keys'

import { DatabaseService } from './database.service'
import { boards, comments, posts, reactions, tenants } from './schema'

import type { BoardKind, ContentStatus, ReactionKind } from '@communitydesk/shared'

const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000)
const hoursAgo = (n: number): Date => new Date(Date.now() - n * 60 * 60 * 1000)

/** 데모 테넌트 — 가입 없이 위젯·어드민을 바로 체험할 수 있게 고정 키를 사용한다. */
const DEMO_PUBLISHABLE_KEY = 'pk_demo'
const DEMO_SECRET_KEY = 'sk_demo'

interface SeedBoard {
  slug: string
  name: string
  description: string
  kind: BoardKind
}

const DEMO_BOARDS: SeedBoard[] = [
  { slug: 'notice', name: '공지사항', description: '운영팀 공지', kind: 'board' },
  { slug: 'free', name: '자유게시판', description: '무엇이든 이야기해요', kind: 'board' },
  { slug: 'dev-cafe', name: '개발자 카페', description: '개발 잡담·질문', kind: 'cafe' },
]

interface SeedComment {
  /** 같은 글 안에서의 임시 키 — parent 참조용. */
  key: string
  parent?: string
  authorMemberId: string
  authorName: string
  body: string
  status?: ContentStatus
  hoursAgo: number
  reactions?: Partial<Record<ReactionKind, string[]>>
}

interface SeedPost {
  boardSlug: string
  authorMemberId: string
  authorName: string
  title: string
  body: string
  tags?: string[]
  pinned?: boolean
  locked?: boolean
  status?: ContentStatus
  daysAgo: number
  /** 글에 대한 반응 — kind → memberId 목록. */
  reactions?: Partial<Record<ReactionKind, string[]>>
  comments?: SeedComment[]
}

const DEMO_POSTS: SeedPost[] = [
  {
    boardSlug: 'notice',
    authorMemberId: 'admin',
    authorName: '운영팀',
    title: '커뮤니티 이용 규칙 안내',
    body: '# 환영합니다\n\n서로 **존중**하는 커뮤니티를 만들어요. 자세한 규칙은 [가이드](https://example.com/guide)를 참고하세요.\n\n- 광고/도배 금지\n- 비방/혐오 금지',
    tags: ['공지', 'rules'],
    pinned: true,
    locked: true,
    daysAgo: 30,
    reactions: { like: ['u1', 'u2', 'u3'], love: ['u4'] },
    comments: [
      {
        key: 'c1',
        authorMemberId: 'u1',
        authorName: '김서연',
        body: '잘 읽었습니다!',
        hoursAgo: 700,
        reactions: { like: ['u2'] },
      },
    ],
  },
  {
    boardSlug: 'notice',
    authorMemberId: 'admin',
    authorName: '운영팀',
    title: '6월 업데이트 노트',
    body: '이번 달 새 기능:\n\n1. 반응(이모지) 추가\n2. 중첩 댓글\n3. 태그 필터\n\n`피드백`은 자유게시판으로!',
    tags: ['업데이트'],
    daysAgo: 5,
    reactions: { wow: ['u3', 'u5'], like: ['u1'] },
  },
  {
    boardSlug: 'free',
    authorMemberId: 'u2',
    authorName: '이준호',
    title: '오늘 점심 뭐 드셨어요?',
    body: '저는 김치찌개 먹었습니다 🍲 다들 맛점하세요!',
    tags: ['잡담'],
    daysAgo: 1,
    reactions: { laugh: ['u1', 'u4'], like: ['u3'] },
    comments: [
      {
        key: 'a',
        authorMemberId: 'u3',
        authorName: '박민지',
        body: '저는 샐러드요 🥗',
        hoursAgo: 20,
        reactions: { like: ['u2'] },
      },
      {
        key: 'b',
        parent: 'a',
        authorMemberId: 'u2',
        authorName: '이준호',
        body: '건강하시네요!',
        hoursAgo: 19,
      },
      {
        key: 'c',
        parent: 'b',
        authorMemberId: 'u3',
        authorName: '박민지',
        body: '다이어트 중이라ㅎㅎ',
        hoursAgo: 18,
        reactions: { laugh: ['u2', 'u1'] },
      },
      {
        key: 'd',
        authorMemberId: 'u5',
        authorName: '최유진',
        body: '저는 굶었어요...',
        hoursAgo: 10,
      },
    ],
  },
  {
    boardSlug: 'free',
    authorMemberId: 'u4',
    authorName: '정우성',
    title: '주말에 갈만한 곳 추천받아요',
    body: '서울 근교로 당일치기 가려는데 추천 부탁드려요. 자연 좋은 곳이면 좋겠습니다.',
    tags: ['질문', '여행'],
    daysAgo: 2,
    reactions: { like: ['u1', 'u2', 'u3'] },
    comments: [
      {
        key: 'x',
        authorMemberId: 'u1',
        authorName: '김서연',
        body: '남한산성 좋아요!',
        hoursAgo: 40,
      },
      {
        key: 'y',
        authorMemberId: 'u6',
        authorName: '스팸봇',
        body: '대박 이벤트 example.spam 방문하세요',
        status: 'hidden',
        hoursAgo: 38,
      },
    ],
  },
  {
    boardSlug: 'free',
    authorMemberId: 'u5',
    authorName: '최유진',
    title: '새로 올린 글입니다(검수 대기 예시)',
    body: '검수 대기 상태로 두면 어드민에서만 보입니다.',
    tags: ['테스트'],
    status: 'pending',
    daysAgo: 0,
  },
  {
    boardSlug: 'dev-cafe',
    authorMemberId: 'u3',
    authorName: '박민지',
    title: 'TypeScript 6 써보신 분?',
    body: '## 후기 궁금\n\n`isolatedDeclarations` 같은 거 실무에서 쓰시나요? 빌드 속도 체감 되는지 궁금합니다.\n\n```ts\nexport const x: number = 1\n```',
    tags: ['typescript', '질문'],
    daysAgo: 3,
    reactions: { like: ['u1', 'u2'], love: ['u4'] },
    comments: [
      {
        key: 'p',
        authorMemberId: 'u1',
        authorName: '김서연',
        body: '저희 팀은 도입했어요. 타입 추론이 빨라진 느낌.',
        hoursAgo: 60,
        reactions: { like: ['u3', 'u2'] },
      },
      {
        key: 'q',
        parent: 'p',
        authorMemberId: 'u3',
        authorName: '박민지',
        body: '오 정보 감사합니다 🙏',
        hoursAgo: 58,
      },
    ],
  },
  {
    boardSlug: 'dev-cafe',
    authorMemberId: 'u1',
    authorName: '김서연',
    title: 'PGlite로 로컬 개발하니 편하네요',
    body: 'Postgres 안 띄우고도 **임베드 DB**로 바로 돌아갑니다. CI에서도 빨라요.',
    tags: ['postgres', 'devtools'],
    daysAgo: 4,
    reactions: { wow: ['u2', 'u3', 'u4'] },
  },
  {
    boardSlug: 'dev-cafe',
    authorMemberId: 'u4',
    authorName: '정우성',
    title: 'XSS 안전한 마크다운 렌더링 팁',
    body: '> 사용자 입력은 항상 의심하라\n\n서버에서 화이트리스트 방식으로 변환하면 `<script>` 같은 게 안 통합니다. 직접 구현해봤어요.',
    tags: ['security', 'markdown'],
    daysAgo: 6,
    reactions: { like: ['u1', 'u2', 'u3', 'u5'], love: ['u6'] },
    comments: [
      {
        key: 'm',
        authorMemberId: 'u2',
        authorName: '이준호',
        body: '이거 중요하죠. 라이브러리 안 쓰고 하셨다니 대단.',
        hoursAgo: 100,
      },
    ],
  },
  {
    boardSlug: 'free',
    authorMemberId: 'u6',
    authorName: '강다은',
    title: '익명으로도 글 쓸 수 있나요?',
    body: '호스트 앱에서 anon ID 넘겨주면 된다고 들었어요.',
    tags: ['질문'],
    daysAgo: 7,
    reactions: { like: ['u1'] },
  },
  {
    boardSlug: 'free',
    authorMemberId: 'u2',
    authorName: '이준호',
    title: '숨김 처리된 글 예시',
    body: '운영자가 숨기면 공개 목록에서 사라집니다.',
    tags: ['테스트'],
    status: 'hidden',
    daysAgo: 8,
  },
]

export interface SeedResult {
  seeded: boolean
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 게시판/카페 + 글 + 중첩 댓글 + 반응을 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false }

  // 1) 데모 테넌트.
  const visiblePostCount = DEMO_POSTS.filter((p) => (p.status ?? 'visible') !== 'hidden').length
  const insertedTenant = await dbs.db
    .insert(tenants)
    .values({
      name: 'Demo Community',
      slug: 'demo',
      publishableKey: DEMO_PUBLISHABLE_KEY,
      secretKeyHash: hashSecretKey(DEMO_SECRET_KEY),
      corsOrigins: ['*'],
      plan: 'pro',
      postsCount: visiblePostCount,
      readsCount: 0,
    })
    .returning()
  const tenant = insertedTenant[0]!

  // 2) 게시판/카페.
  const boardRows = await dbs.db
    .insert(boards)
    .values(
      DEMO_BOARDS.map((b) => ({
        tenantId: tenant.id,
        slug: b.slug,
        name: b.name,
        description: b.description,
        kind: b.kind,
      }))
    )
    .returning()
  const boardBySlug = new Map(boardRows.map((b) => [b.slug, b]))

  // 3) 글 + 댓글 + 반응.
  for (const p of DEMO_POSTS) {
    const board = boardBySlug.get(p.boardSlug)
    if (!board) continue
    const status: ContentStatus = p.status ?? 'visible'

    const insertedPost = await dbs.db
      .insert(posts)
      .values({
        tenantId: tenant.id,
        boardId: board.id,
        authorMemberId: p.authorMemberId,
        authorName: p.authorName,
        title: p.title,
        body: p.body,
        bodyHtml: renderMarkdown(p.body),
        tags: p.tags ?? [],
        pinned: p.pinned ?? false,
        locked: p.locked ?? false,
        status,
        reactions: countsFrom(p.reactions),
        replyCount: 0,
        createdAt: daysAgo(p.daysAgo),
      })
      .returning()
    const post = insertedPost[0]!

    // 글 반응 행.
    await insertReactionRows(dbs, tenant.id, 'post', post.id, p.reactions)

    // 댓글(키→실제 id 매핑으로 parent 연결).
    const keyToId = new Map<string, string>()
    let visibleReplies = 0
    for (const c of p.comments ?? []) {
      const cStatus: ContentStatus = c.status ?? 'visible'
      const parentId = c.parent ? keyToId.get(c.parent) ?? null : null
      const insertedComment = await dbs.db
        .insert(comments)
        .values({
          tenantId: tenant.id,
          postId: post.id,
          parentId,
          authorMemberId: c.authorMemberId,
          authorName: c.authorName,
          body: c.body,
          bodyHtml: renderMarkdown(c.body),
          status: cStatus,
          reactions: countsFrom(c.reactions),
          createdAt: hoursAgo(c.hoursAgo),
        })
        .returning()
      const comment = insertedComment[0]!
      keyToId.set(c.key, comment.id)
      if (cStatus === 'visible') visibleReplies += 1
      await insertReactionRows(dbs, tenant.id, 'comment', comment.id, c.reactions)
    }

    if (visibleReplies > 0) {
      await dbs.db
        .update(posts)
        .set({ replyCount: visibleReplies })
        .where(sql`${posts.id} = ${post.id}`)
    }
  }

  return { seeded: true }
}

/** kind→memberId[] 를 kind→count 캐시로. */
function countsFrom(
  r: Partial<Record<ReactionKind, string[]>> | undefined
): Partial<Record<ReactionKind, number>> {
  const out: Partial<Record<ReactionKind, number>> = {}
  if (!r) return out
  for (const [kind, members] of Object.entries(r)) {
    if (members && members.length > 0) out[kind as ReactionKind] = members.length
  }
  return out
}

/** 반응 상세 행 삽입(멤버별). */
async function insertReactionRows(
  dbs: DatabaseService,
  tenantId: string,
  targetType: 'post' | 'comment',
  targetId: string,
  r: Partial<Record<ReactionKind, string[]>> | undefined
): Promise<void> {
  if (!r) return
  const rows: (typeof reactions.$inferInsert)[] = []
  for (const [kind, members] of Object.entries(r)) {
    for (const memberId of members ?? []) {
      rows.push({ tenantId, targetType, targetId, memberId, kind: kind as ReactionKind })
    }
  }
  if (rows.length > 0) await dbs.db.insert(reactions).values(rows)
}
