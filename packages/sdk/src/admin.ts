/**
 * @communitydesk/sdk/admin — secret(sk) 서버 어드민 헬퍼.
 *
 * secret 키는 **서버 전용**이다(브라우저 노출 금지). 게시판 CRUD·글/댓글 검수·운영
 * (숨김·고정·잠금·승인·삭제)·테넌트 설정·키 회전 같은 전체 권한을 가진다.
 *
 * 두 가지 인증 모드:
 *   1) 테넌트 secret 키(sk_...) → `x-sk` 헤더 → 그 테넌트로 스코프.
 *   2) 글로벌 ADMIN_TOKEN(셀프호스트 운영자) → `x-admin-token` 헤더 → 모든 테넌트.
 *      이 모드에선 대상 테넌트를 tenantId(또는 publishableKey)로 지정해야 한다.
 *
 * 의존성 0(타입만 @communitydesk/shared 에서).
 */
import { createHttpClient, type HttpClient } from './http'

import type {
  AdminPostListDto,
  AdminPostsQuery,
  BoardDto,
  CreateBoardInput,
  ModerateCommentInput,
  ModeratePostInput,
  TenantCreatedDto,
  TenantDto,
  UpdateBoardInput,
  UpdateTenantInput,
} from '@communitydesk/shared'

export type CommunityAdminClientOptions =
  | {
      /** 테넌트 secret 키(sk_...). 그 테넌트로 스코프. */
      secretKey: string
      endpoint: string
      fetch?: typeof fetch
    }
  | {
      /** 글로벌 ADMIN_TOKEN(셀프호스트). 모든 테넌트 접근. */
      adminToken: string
      /** 대상 테넌트(글로벌 토큰 사용 시 필수) — tenantId 또는 publishableKey 중 하나. */
      tenantId?: string
      publishableKey?: string
      endpoint: string
      fetch?: typeof fetch
    }

/** secret 또는 글로벌 토큰으로 인증하는 어드민 클라이언트. */
export interface CommunityAdminClient {
  // 테넌트
  /** 내 테넌트 설정·usage·키(공개 정보). */
  getTenant(signal?: AbortSignal): Promise<TenantDto>
  /** 설정 수정(name·corsOrigins·plan). */
  updateTenant(input: UpdateTenantInput, signal?: AbortSignal): Promise<TenantDto>
  /** 키 회전 — 새 publishable/secret(secret 1회 노출). 기존 키 즉시 무효. */
  rotateKeys(signal?: AbortSignal): Promise<TenantCreatedDto>

  // 게시판
  /** 게시판·카페 목록(노출 글 수 포함). */
  listBoards(signal?: AbortSignal): Promise<BoardDto[]>
  /** 게시판·카페 생성(slug·name·kind). */
  createBoard(input: CreateBoardInput, signal?: AbortSignal): Promise<BoardDto>
  /** 게시판 수정(name·description·kind). slug 불변. */
  updateBoard(boardId: string, input: UpdateBoardInput, signal?: AbortSignal): Promise<BoardDto>
  /** 게시판 삭제(글도 함께 정리). */
  deleteBoard(boardId: string, signal?: AbortSignal): Promise<void>

  // 글/댓글 검수·운영
  /** 글 목록 — boardSlug/status/tag 필터, 페이지네이션. */
  listPosts(query?: AdminPostsQuery, signal?: AbortSignal): Promise<AdminPostListDto>
  /** 글 운영 — show|hide|pin|unpin|lock|unlock|approve. */
  moderatePost(
    postId: string,
    input: ModeratePostInput,
    signal?: AbortSignal
  ): Promise<{ ok: true }>
  /** 글 삭제(댓글 함께 정리). */
  deletePost(postId: string, signal?: AbortSignal): Promise<void>
  /** 댓글 운영 — show|hide|approve. */
  moderateComment(
    commentId: string,
    input: ModerateCommentInput,
    signal?: AbortSignal
  ): Promise<{ ok: true }>
  /** 댓글 삭제. */
  deleteComment(commentId: string, signal?: AbortSignal): Promise<void>
}

function resolveHeaders(options: CommunityAdminClientOptions): Record<string, string> {
  if ('secretKey' in options) {
    return { 'x-sk': options.secretKey }
  }
  const h: Record<string, string> = { 'x-admin-token': options.adminToken }
  // 글로벌 토큰 사용 시 대상 테넌트 지정(서버가 x-tenant-id / x-pk 로 해석).
  if (options.tenantId) h['x-tenant-id'] = options.tenantId
  if (options.publishableKey) h['x-pk'] = options.publishableKey
  return h
}

export function createCommunityAdminClient(
  options: CommunityAdminClientOptions
): CommunityAdminClient {
  const http: HttpClient = createHttpClient({
    endpoint: options.endpoint,
    baseHeaders: resolveHeaders(options),
    fetch: options.fetch,
  })

  return {
    // 테넌트
    getTenant(signal) {
      return http.request<TenantDto>('/admin/tenant', { signal })
    },
    updateTenant(input, signal) {
      return http.request<TenantDto>('/admin/tenant', { method: 'PUT', body: input, signal })
    },
    rotateKeys(signal) {
      return http.request<TenantCreatedDto>('/admin/tenant/rotate-keys', {
        method: 'POST',
        signal,
      })
    },

    // 게시판
    listBoards(signal) {
      return http.request<BoardDto[]>('/admin/boards', { signal })
    },
    createBoard(input, signal) {
      return http.request<BoardDto>('/admin/boards', { method: 'POST', body: input, signal })
    },
    updateBoard(boardId, input, signal) {
      return http.request<BoardDto>(`/admin/boards/${encodeURIComponent(boardId)}`, {
        method: 'PUT',
        body: input,
        signal,
      })
    },
    deleteBoard(boardId, signal) {
      return http.request<void>(`/admin/boards/${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
        signal,
      })
    },

    // 글/댓글
    listPosts(query, signal) {
      return http.request<AdminPostListDto>('/admin/posts', {
        query: query as Record<string, string | number | undefined>,
        signal,
      })
    },
    moderatePost(postId, input, signal) {
      return http.request<{ ok: true }>(`/admin/posts/${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        body: input,
        signal,
      })
    },
    deletePost(postId, signal) {
      return http.request<void>(`/admin/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        signal,
      })
    },
    moderateComment(commentId, input, signal) {
      return http.request<{ ok: true }>(`/admin/comments/${encodeURIComponent(commentId)}`, {
        method: 'PATCH',
        body: input,
        signal,
      })
    },
    deleteComment(commentId, signal) {
      return http.request<void>(`/admin/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        signal,
      })
    },
  }
}
