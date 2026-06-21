/**
 * @heejun/deskcloud — Community Desk BROWSER client (publishable `pk_` surface).
 *
 * Mirrors CommunityDesk's public, PublishableKeyGuard-protected REST routes
 * (global prefix `/api`). Covers the read/display + member-submit surface a
 * board/cafe widget needs:
 *   - GET    /api/boards                 list boards/cafes            → Board[]
 *   - GET    /api/boards/:slug/posts     posts in a board (paged)     → PostList
 *   - GET    /api/posts/:id              post detail + comment tree   → PostDetail
 *   - POST   /api/posts                  create a post                → PostReceipt
 *   - POST   /api/posts/:id/comments     create a (nested) comment    → PostReceipt
 *   - POST   /api/reactions              toggle a reaction            → ReactionToggle
 *
 * Auth is handled by the transport: the publishable key is sent as the `x-pk`
 * header AND the `?pk=` query param. The host app identifies its end-users via
 * the `authorMemberId` / `memberId` it supplies — there is NO separate user
 * auth here. NEVER reference a secret key in this module — admin/moderation
 * operations live in '@heejun/deskcloud/server' (createCommunityAdminClient).
 *
 * Domain types are duplicated here (derived from CommunityDesk's
 * packages/shared) so the SDK stays self-contained with zero deps on the Desk
 * repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain enums / primitives (mirrored from @communitydesk/shared)
// ---------------------------------------------------------------------------

/** Board kind — `board` (regular forum) | `cafe` (group/cafe). */
export type BoardKind = "board" | "cafe";

/** Content lifecycle — `visible` | `hidden` (operator) | `pending` (awaiting review). */
export type ContentStatus = "visible" | "hidden" | "pending";

/** Reaction target — a post or a comment. */
export type ReactionTarget = "post" | "comment";

/** Allowed reaction kinds (emoji keys). Toggling the same kind again clears it. */
export type ReactionKind = "like" | "love" | "laugh" | "wow" | "sad" | "angry";

/** Public post list sort — `recent` | `popular` (by reactions) | `replies`. */
export type PostSort = "recent" | "popular" | "replies";

/** Per-kind reaction tallies, e.g. `{ like: 3, love: 1 }`. */
export type ReactionCounts = Partial<Record<ReactionKind, number>>;

// ---------------------------------------------------------------------------
// Domain types (public surface)
// ---------------------------------------------------------------------------

/** A board / cafe. */
export interface Board {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: BoardKind;
  /** Number of visible posts. */
  postCount: number;
  createdAt: string;
}

/** A post list item (summary — no body HTML, preview only). */
export interface PostSummary {
  id: string;
  boardSlug: string;
  authorName: string;
  title: string | null;
  /** Plain-text preview (markup stripped). */
  excerpt: string;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  reactions: ReactionCounts;
  replyCount: number;
  createdAt: string;
}

/** A public comment (tree node). */
export interface CommentNode {
  id: string;
  parentId: string | null;
  authorName: string;
  /** Server-sanitized HTML. */
  bodyHtml: string;
  reactions: ReactionCounts;
  depth: number;
  createdAt: string;
  children: CommentNode[];
}

/** Post detail (sanitized HTML body + comment tree). */
export interface PostDetail {
  id: string;
  boardSlug: string;
  authorMemberId: string;
  authorName: string;
  title: string | null;
  /** Server-sanitized HTML. */
  bodyHtml: string;
  /** Original markdown (for edit / re-render). */
  body: string;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  reactions: ReactionCounts;
  replyCount: number;
  createdAt: string;
  comments: CommentNode[];
}

/** Paginated public post list for one board. */
export interface PostList {
  boardSlug: string;
  items: PostSummary[];
  /** Total visible posts for the filter (matches the X-Total-Count header). */
  total: number;
  offset: number;
  limit: number;
}

/** Receipt returned after creating a post or comment. */
export interface PostReceipt {
  id: string;
  status: ContentStatus;
  createdAt: string;
}

/** Result of toggling a reaction — new state + refreshed tallies. */
export interface ReactionToggle {
  /** true if the reaction was just added, false if it was cleared. */
  active: boolean;
  reactions: ReactionCounts;
}

// ---------------------------------------------------------------------------
// Input types (public submit surface — server-controlled fields omitted)
// ---------------------------------------------------------------------------

/**
 * Public post creation payload. Server-controlled fields
 * (status/pinned/locked) are intentionally absent — they cannot be set here.
 */
export interface CreatePostInput {
  /** Target board slug. */
  boardSlug: string;
  /** Host-app member id (e.g. `user-42` or `anon:abcd`). */
  authorMemberId: string;
  authorName: string;
  title?: string | null;
  /** Markdown source — the server sanitizes it into `bodyHtml`. */
  body: string;
  tags?: string[];
}

/** Public comment creation payload. Use `parentId` to nest under a comment. */
export interface CreateCommentInput {
  authorMemberId: string;
  authorName: string;
  body: string;
  /** Parent comment id (omit for a top-level comment). */
  parentId?: string;
}

/** Reaction toggle payload. Re-sending the same `kind` for a member clears it. */
export interface ToggleReactionInput {
  targetType: ReactionTarget;
  targetId: string;
  memberId: string;
  kind: ReactionKind;
}

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

/** Params for {@link CommunityClient.listPosts}. */
export interface ListPostsParams {
  /** Target board slug. */
  boardSlug: string;
  /** Sort order (default `recent`). Pinned posts are always first. */
  sort?: PostSort;
  /** Filter by a single tag. */
  tag?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createCommunityClient}. Browser-safe (publishable key only). */
export interface CommunityClientOptions {
  /** Base URL of the Community Desk (e.g. 'https://communitydesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Community Desk client surface. */
export interface CommunityClient {
  /** List boards/cafes with visible-post counts (GET /api/boards). */
  listBoards(opts?: { signal?: AbortSignal }): Promise<Board[]>;
  /** List visible posts in a board, pinned-first, paginated (GET /api/boards/:slug/posts). */
  listPosts(params: ListPostsParams): Promise<PostList>;
  /** Post detail + nested comment tree; bumps the read count (GET /api/posts/:id). */
  getPost(id: string, opts?: { signal?: AbortSignal }): Promise<PostDetail>;
  /** Create a post (POST /api/posts). Returns the receipt (id·status). */
  createPost(
    input: CreatePostInput,
    opts?: { signal?: AbortSignal },
  ): Promise<PostReceipt>;
  /** Create a nested comment on a post (POST /api/posts/:id/comments). Locked posts are rejected. */
  createComment(
    postId: string,
    input: CreateCommentInput,
    opts?: { signal?: AbortSignal },
  ): Promise<PostReceipt>;
  /** Toggle a reaction on a post or comment (POST /api/reactions). Returns refreshed tallies. */
  toggleReaction(
    input: ToggleReactionInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ReactionToggle>;
}

/**
 * Create a browser-safe Community Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const community = createCommunityClient({ endpoint, publishableKey })
 *   const boards = await community.listBoards()
 *   const { items } = await community.listPosts({ boardSlug: 'notice', sort: 'recent', limit: 20 })
 */
export function createCommunityClient(
  opts: CommunityClientOptions,
): CommunityClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    listBoards: (reqOpts) =>
      t.get<Board[]>("/api/boards", { signal: reqOpts?.signal }),
    listPosts: (params) =>
      t.get<PostList>(
        `/api/boards/${encodeURIComponent(params.boardSlug)}/posts`,
        {
          query: {
            sort: params.sort,
            tag: params.tag,
            offset: params.offset,
            limit: params.limit,
          },
          signal: params.signal,
        },
      ),
    getPost: (id, reqOpts) =>
      t.get<PostDetail>(`/api/posts/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),
    createPost: (input, reqOpts) =>
      t.post<PostReceipt>("/api/posts", {
        body: input,
        signal: reqOpts?.signal,
      }),
    createComment: (postId, input, reqOpts) =>
      t.post<PostReceipt>(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    toggleReaction: (input, reqOpts) =>
      t.post<ReactionToggle>("/api/reactions", {
        body: input,
        signal: reqOpts?.signal,
      }),
  };
}
