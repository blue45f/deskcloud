/**
 * @communitydesk/sdk/browser — publishable(pk) 브라우저 클라이언트.
 *
 * publishable 키는 브라우저에 노출해도 안전하다(읽기 + 멤버를 대신한 글·댓글·반응 작성).
 * 모든 요청은 `x-pk` 헤더로 키를 싣고, 브라우저가 자동으로 보내는 `Origin` 을 서버가
 * 테넌트 corsOrigins 허용목록과 대조한다. 엔드유저(호스트 앱의 사용자)는 호스트 앱이
 * 넘겨주는 memberId/memberName 으로 식별 — 이 SDK 자체엔 인증 시스템이 없다.
 *
 * 의존성 0(타입만 @communitydesk/shared 에서).
 */
import { createHttpClient, type HttpClient } from './http'

import type {
  BoardDto,
  CreateCommentInput,
  CreatePostInput,
  CreateTenantInput,
  PostDetailDto,
  PostListDto,
  PostReceiptDto,
  PublicPostsQuery,
  ReactionToggleDto,
  TenantCreatedDto,
  ToggleReactionInput,
} from '@communitydesk/shared'

export interface CommunityBrowserClientOptions {
  /** publishable 키(pk_...). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://community.example.com' (끝의 / 는 무시). */
  endpoint: string
  /** 커스텀 fetch(SSR/테스트). 기본은 전역 fetch. */
  fetch?: typeof fetch
}

/**
 * publishable 클라이언트 — 게시판/글/댓글을 읽고, 멤버를 대신해 글·댓글·반응을 쓴다.
 *
 * 작성 메서드(createPost/comment/react)는 author/member 정보를 인자로 받는다(호스트 앱 책임).
 */
export interface CommunityBrowserClient {
  /** 게시판·카페 목록(노출 글 수 포함). */
  listBoards(signal?: AbortSignal): Promise<BoardDto[]>
  /** 보드의 글 목록(노출 글만, 고정글 우선, 페이지네이션·정렬·태그필터). */
  listPosts(boardSlug: string, query?: PublicPostsQuery, signal?: AbortSignal): Promise<PostListDto>
  /** 글 상세 + 중첩 댓글 트리(읽기 카운트 증가). */
  getPost(postId: string, signal?: AbortSignal): Promise<PostDetailDto>
  /** 글 작성(마크다운 → 서버 살균). 영수증(id·status) 반환. */
  createPost(input: CreatePostInput, signal?: AbortSignal): Promise<PostReceiptDto>
  /** 댓글 작성(parentId 로 중첩). 잠긴 글은 서버가 거부. */
  createComment(
    postId: string,
    input: CreateCommentInput,
    signal?: AbortSignal
  ): Promise<PostReceiptDto>
  /** 반응 토글(post|comment) — 갱신된 집계 반환. */
  toggleReaction(input: ToggleReactionInput, signal?: AbortSignal): Promise<ReactionToggleDto>
}

export function createCommunityBrowserClient(
  options: CommunityBrowserClientOptions
): CommunityBrowserClient {
  const http: HttpClient = createHttpClient({
    endpoint: options.endpoint,
    baseHeaders: { 'x-pk': options.publishableKey },
    fetch: options.fetch,
  })

  return {
    listBoards(signal) {
      return http.request<BoardDto[]>('/boards', { signal })
    },

    listPosts(boardSlug, query, signal) {
      return http.request<PostListDto>(`/boards/${encodeURIComponent(boardSlug)}/posts`, {
        query: query as Record<string, string | number | undefined>,
        signal,
      })
    },

    getPost(postId, signal) {
      return http.request<PostDetailDto>(`/posts/${encodeURIComponent(postId)}`, { signal })
    },

    createPost(input, signal) {
      return http.request<PostReceiptDto>('/posts', { method: 'POST', body: input, signal })
    },

    createComment(postId, input, signal) {
      return http.request<PostReceiptDto>(`/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        body: input,
        signal,
      })
    },

    toggleReaction(input, signal) {
      return http.request<ReactionToggleDto>('/reactions', {
        method: 'POST',
        body: input,
        signal,
      })
    },
  }
}

/**
 * 테넌트 셀프 가입(공개) — publishable + secret 키 발급.
 *
 * secret 키는 이 응답에서 **단 한 번만** 평문으로 노출되므로(이후 해시만 저장) 서버 측에
 * 안전히 보관해야 한다. 키가 없는 상태에서 호출하므로 클라이언트 인스턴스가 필요 없다.
 */
export function registerTenant(
  endpoint: string,
  input: CreateTenantInput,
  init?: { fetch?: typeof fetch; signal?: AbortSignal }
): Promise<TenantCreatedDto> {
  const http = createHttpClient({ endpoint, baseHeaders: {}, fetch: init?.fetch })
  return http.request<TenantCreatedDto>('/tenants', {
    method: 'POST',
    body: input,
    signal: init?.signal,
  })
}
