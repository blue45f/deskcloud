/**
 * 어드민/공개 API 래퍼 — apps/web 대시보드가 호출하는 모든 엔드포인트를 한곳에.
 * 인증 헤더(x-sk / x-admin-token)는 services/api.ts 가 자동으로 싣는다.
 */
import { api } from './api'

import type {
  AdminPostDto,
  AdminPostListDto,
  AdminPostsQuery,
  AdminStatsDto,
  BoardDto,
  CommentModerationAction,
  CreateBoardInput,
  CreateTenantInput,
  PostDetailDto,
  PostModerationAction,
  TenantCreatedDto,
  TenantDto,
  UpdateBoardInput,
  UpdateTenantInput,
} from '@communitydesk/shared'

// ── 공개: 테넌트 셀프 가입 ──────────────────────────────────────────────────
export function registerTenant(input: CreateTenantInput): Promise<TenantCreatedDto> {
  return api.post<TenantCreatedDto>('tenants', input)
}

// ── 어드민: 테넌트 설정 ─────────────────────────────────────────────────────
export function getTenant(): Promise<TenantDto> {
  return api.get<TenantDto>('admin/tenant')
}
export function updateTenant(input: UpdateTenantInput): Promise<TenantDto> {
  return api.put<TenantDto>('admin/tenant', input)
}
export function rotateKeys(): Promise<TenantCreatedDto> {
  return api.post<TenantCreatedDto>('admin/tenant/rotate-keys')
}

// ── 어드민: 운영 대시보드 지표(트래픽/가입) ─────────────────────────────────
export function getStats(): Promise<AdminStatsDto> {
  return api.get<AdminStatsDto>('admin/stats')
}

// ── 어드민: 게시판/카페 ─────────────────────────────────────────────────────
export function listBoards(): Promise<BoardDto[]> {
  return api.get<BoardDto[]>('admin/boards')
}
export function createBoard(input: CreateBoardInput): Promise<BoardDto> {
  return api.post<BoardDto>('admin/boards', input)
}
export function updateBoard(boardId: string, input: UpdateBoardInput): Promise<BoardDto> {
  return api.put<BoardDto>(`admin/boards/${encodeURIComponent(boardId)}`, input)
}
export function deleteBoard(boardId: string): Promise<void> {
  return api.delete<void>(`admin/boards/${encodeURIComponent(boardId)}`)
}

// ── 어드민: 글/댓글 검수·운영 ───────────────────────────────────────────────
export interface AdminPostsResult {
  items: AdminPostDto[]
  total: number
  offset: number
  limit: number
}

export async function listPosts(query?: AdminPostsQuery): Promise<AdminPostsResult> {
  const res = await api.getWithHeaders<AdminPostListDto>(
    'admin/posts',
    query as Record<string, string | number | undefined>
  )
  return {
    items: res.data.items,
    total: res.totalCount ?? res.data.total,
    offset: res.data.offset,
    limit: res.data.limit,
  }
}

export function moderatePost(postId: string, action: PostModerationAction): Promise<{ ok: true }> {
  return api.patch<{ ok: true }>(`admin/posts/${encodeURIComponent(postId)}`, { action })
}
export function deletePost(postId: string): Promise<void> {
  return api.delete<void>(`admin/posts/${encodeURIComponent(postId)}`)
}
export function moderateComment(
  commentId: string,
  action: CommentModerationAction
): Promise<{ ok: true }> {
  return api.patch<{ ok: true }>(`admin/comments/${encodeURIComponent(commentId)}`, { action })
}
export function deleteComment(commentId: string): Promise<void> {
  return api.delete<void>(`admin/comments/${encodeURIComponent(commentId)}`)
}

// ── 공개: 글 상세(댓글 트리) — 검수 큐에서 한 글의 댓글을 펼쳐 볼 때 ──────────
// 공개 경로는 pk + Origin 검사를 거치므로, 어드민 화면에선 pk 가 있어야 호출된다.
// (테넌트 본인 sk 로그인 시 pk 를 함께 알 수 있어, 호출부에서 endpoint/pk 를 직접 넘긴다.)
export function getPublicPost(
  postId: string,
  publishableKey: string,
  endpoint: string
): Promise<PostDetailDto> {
  const base = endpoint.replace(/\/+$/, '')
  return fetch(`${base}/api/posts/${encodeURIComponent(postId)}`, {
    headers: { 'x-pk': publishableKey, accept: 'application/json' },
  }).then(async (res) => {
    const text = await res.text()
    const json: unknown = text ? JSON.parse(text) : null
    if (!res.ok) {
      const m = (json as { message?: unknown })?.message
      throw new Error(Array.isArray(m) ? m.join(', ') : String(m ?? `요청 실패 (${res.status})`))
    }
    return json as PostDetailDto
  })
}
