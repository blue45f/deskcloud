import { z } from 'zod'

/**
 * 커뮤니티(community) — 형제 앱의 채팅·게시판·댓글을 공개 REST 로 보관·조회.
 * kind: chat=채팅 메시지, board=게시판 글, comment=게시판 댓글.
 * channel = 채팅 채널 id 또는 게시판 카테고리. parentId = 댓글의 부모 글 id.
 * authorKey = 익명 멤버키(작성자 본인 삭제 판정용, 응답엔 authorId 로 노출).
 */
export const communityKinds = ['chat', 'board', 'comment'] as const
export type CommunityKind = (typeof communityKinds)[number]

export const createPostSchema = z.object({
  kind: z.enum(communityKinds),
  channel: z.string().max(80).optional(),
  parentId: z.string().max(80).optional(),
  title: z.string().max(200).optional(),
  author: z.string().min(1).max(80),
  authorKey: z.string().min(1).max(128),
  body: z.string().min(1).max(4000),
})
export type CreatePostInput = z.infer<typeof createPostSchema>

export interface CommunityPostDto {
  id: string
  kind: CommunityKind
  channel: string | null
  parentId: string | null
  title: string | null
  author: string
  /** 작성자 익명 키(클라이언트가 본인 글 판정 — 수정/삭제 노출). */
  authorId: string
  body: string
  createdAt: string
}

export interface CommunityListDto {
  appId: string
  posts: CommunityPostDto[]
}

export const COMMUNITY_STORE = Symbol('COMMUNITY_STORE')

/** 영속화 포트 — apps/api 가 Drizzle 로 구현해 주입(테스트는 PGlite). */
export interface CommunityStorePort {
  list(appId: string, kind?: CommunityKind, limit?: number): Promise<CommunityPostDto[]>
  create(appId: string, input: CreatePostInput): Promise<CommunityPostDto>
  remove(appId: string, id: string, authorKey: string): Promise<boolean>
}
