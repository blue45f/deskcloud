/**
 * @heejun/deskcloud/server — Community Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors CommunityDesk's admin, SecretKeyGuard-protected REST routes
 * (global prefix `/api`). Covers post/comment moderation, board CRUD, and
 * tenant settings:
 *   - GET    /api/admin/posts            list/filter posts            → AdminPostList
 *   - PATCH  /api/admin/posts/:id        moderate a post              → { ok: true }
 *   - DELETE /api/admin/posts/:id        delete a post (+comments)    → void (204)
 *   - PATCH  /api/admin/comments/:id     moderate a comment           → { ok: true }
 *   - DELETE /api/admin/comments/:id     delete a comment             → void (204)
 *   - GET    /api/admin/boards           list boards/cafes            → Board[]
 *   - POST   /api/admin/boards           create a board/cafe          → Board
 *   - PUT    /api/admin/boards/:id       update a board               → Board
 *   - DELETE /api/admin/boards/:id       delete a board (+posts)      → void (204)
 *   - GET    /api/admin/tenant           my tenant settings + usage   → Tenant
 *   - PUT    /api/admin/tenant           update settings              → Tenant
 *   - POST   /api/admin/tenant/rotate-keys rotate keys (sk shown once)→ TenantCreated
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header
 * (the host may alternatively use a global X-Admin-Token, but this client wires
 * the per-tenant secret key).
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from CommunityDesk's
 * packages/shared) so the SDK stays self-contained with zero deps on the Desk
 * repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain enums / primitives (mirrored from @communitydesk/shared)
// ---------------------------------------------------------------------------

/** Board kind — `board` (regular forum) | `cafe` (group/cafe). */
export type BoardKind = "board" | "cafe";

/** Content lifecycle — `visible` | `hidden` (operator) | `pending` (awaiting review). */
export type ContentStatus = "visible" | "hidden" | "pending";

/** Allowed reaction kinds (emoji keys). */
export type ReactionKind = "like" | "love" | "laugh" | "wow" | "sad" | "angry";

/** Per-kind reaction tallies, e.g. `{ like: 3, love: 1 }`. */
export type ReactionCounts = Partial<Record<ReactionKind, number>>;

/** Post moderation actions (the PATCH `action` field). */
export type PostModerationAction =
  | "show"
  | "hide"
  | "pin"
  | "unpin"
  | "lock"
  | "unlock"
  | "approve";

/** Comment moderation actions (the PATCH `action` field). */
export type CommentModerationAction = "show" | "hide" | "approve";

/** Tenant billing plan. `free` is subject to a soft usage cap. */
export type Plan = "free" | "pro" | "scale";

// ---------------------------------------------------------------------------
// Domain types (admin surface — full fields)
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

/** An admin post (all fields — includes authorMemberId / status). */
export interface AdminPost {
  id: string;
  tenantId: string;
  boardId: string;
  boardSlug: string;
  authorMemberId: string;
  authorName: string;
  title: string | null;
  /** Original markdown. */
  body: string;
  /** Server-sanitized HTML. */
  bodyHtml: string;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  status: ContentStatus;
  reactions: ReactionCounts;
  replyCount: number;
  createdAt: string;
}

/** Paginated admin post list (mirrors X-Total-Count). */
export interface AdminPostList {
  items: AdminPost[];
  /** Total count for the same filter (matches the X-Total-Count header). */
  total: number;
  offset: number;
  limit: number;
}

/** Public tenant representation (secret hash never exposed). */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  publishableKey: string;
  corsOrigins: string[];
  plan: Plan;
  /** Cumulative posts created (free-plan soft-cap check). */
  postsCount: number;
  /** Cumulative reads. */
  readsCount: number;
  createdAt: string;
}

/**
 * Tenant created/rotated response. The secret key is exposed exactly ONCE
 * here (the DB stores only its hash thereafter).
 */
export interface TenantCreated {
  tenant: Tenant;
  /** Browser-safe (read + member post/comment/reaction). */
  publishableKey: string;
  /** Server-only (moderate/CRUD/ops). Not retrievable after this response. */
  secretKey: string;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/** Filter + pagination for {@link CommunityAdminClient.listPosts}. */
export interface ListAdminPostsParams {
  boardSlug?: string;
  status?: ContentStatus;
  tag?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** Moderation payload for {@link CommunityAdminClient.moderatePost}. */
export interface ModeratePostInput {
  action: PostModerationAction;
}

/** Moderation payload for {@link CommunityAdminClient.moderateComment}. */
export interface ModerateCommentInput {
  action: CommentModerationAction;
}

/** Board creation payload for {@link CommunityAdminClient.createBoard}. */
export interface CreateBoardInput {
  slug: string;
  name: string;
  description?: string | null;
  /** Defaults to `board` on the server. */
  kind?: BoardKind;
}

/** Board update payload (partial) for {@link CommunityAdminClient.updateBoard}. slug is immutable. */
export interface UpdateBoardInput {
  name?: string;
  description?: string | null;
  kind?: BoardKind;
}

/** Partial tenant settings update for {@link CommunityAdminClient.updateTenant}. */
export interface UpdateTenantInput {
  name?: string;
  corsOrigins?: string[];
  plan?: Plan;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createCommunityAdminClient}. Server-only (secret key required). */
export interface CommunityAdminClientOptions {
  /** Base URL of the Community Desk (e.g. 'https://communitydesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Community Desk client surface. */
export interface CommunityAdminClient {
  // ── posts / comments moderation ──────────────────────────────────────────
  /** List/filter posts with pagination (GET /api/admin/posts). */
  listPosts(params?: ListAdminPostsParams): Promise<AdminPostList>;
  /** Moderate a post — show|hide|pin|unpin|lock|unlock|approve (PATCH /api/admin/posts/:id). */
  moderatePost(
    id: string,
    input: ModeratePostInput,
    opts?: { signal?: AbortSignal },
  ): Promise<{ ok: true }>;
  /** Delete a post and its comments (DELETE /api/admin/posts/:id). */
  deletePost(id: string, opts?: { signal?: AbortSignal }): Promise<void>;
  /** Moderate a comment — show|hide|approve (PATCH /api/admin/comments/:id). */
  moderateComment(
    id: string,
    input: ModerateCommentInput,
    opts?: { signal?: AbortSignal },
  ): Promise<{ ok: true }>;
  /** Delete a comment (DELETE /api/admin/comments/:id). */
  deleteComment(id: string, opts?: { signal?: AbortSignal }): Promise<void>;

  // ── boards CRUD ──────────────────────────────────────────────────────────
  /** List boards/cafes with visible-post counts (GET /api/admin/boards). */
  listBoards(opts?: { signal?: AbortSignal }): Promise<Board[]>;
  /** Create a board/cafe — slug·name·kind (POST /api/admin/boards). */
  createBoard(
    input: CreateBoardInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Board>;
  /** Update a board — name·description·kind (PUT /api/admin/boards/:id). */
  updateBoard(
    id: string,
    input: UpdateBoardInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Board>;
  /** Delete a board and its posts (DELETE /api/admin/boards/:id). */
  deleteBoard(id: string, opts?: { signal?: AbortSignal }): Promise<void>;

  // ── tenant settings ──────────────────────────────────────────────────────
  /** My tenant settings, usage, and keys (GET /api/admin/tenant). */
  getTenant(opts?: { signal?: AbortSignal }): Promise<Tenant>;
  /** Update tenant settings — name/corsOrigins/plan (PUT /api/admin/tenant). */
  updateTenant(
    input: UpdateTenantInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Tenant>;
  /** Rotate keys — returns new pk/sk (sk shown once); old keys invalidated (POST /api/admin/tenant/rotate-keys). */
  rotateKeys(opts?: { signal?: AbortSignal }): Promise<TenantCreated>;
}

/**
 * Create a server-only Community Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createCommunityAdminClient({ endpoint, secretKey })
 *   const { items, total } = await admin.listPosts({ status: 'pending', limit: 50 })
 *   await admin.moderatePost(items[0]!.id, { action: 'approve' })
 */
export function createCommunityAdminClient(
  opts: CommunityAdminClientOptions,
): CommunityAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    // posts / comments
    listPosts: (params) =>
      t.get<AdminPostList>("/api/admin/posts", {
        query: {
          boardSlug: params?.boardSlug,
          status: params?.status,
          tag: params?.tag,
          offset: params?.offset,
          limit: params?.limit,
        },
        signal: params?.signal,
      }),
    moderatePost: (id, input, reqOpts) =>
      t.patch<{ ok: true }>(`/api/admin/posts/${encodeURIComponent(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deletePost: (id, reqOpts) =>
      t.del<void>(`/api/admin/posts/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),
    moderateComment: (id, input, reqOpts) =>
      t.patch<{ ok: true }>(`/api/admin/comments/${encodeURIComponent(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deleteComment: (id, reqOpts) =>
      t.del<void>(`/api/admin/comments/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),

    // boards
    listBoards: (reqOpts) =>
      t.get<Board[]>("/api/admin/boards", { signal: reqOpts?.signal }),
    createBoard: (input, reqOpts) =>
      t.post<Board>("/api/admin/boards", {
        body: input,
        signal: reqOpts?.signal,
      }),
    updateBoard: (id, input, reqOpts) =>
      t.put<Board>(`/api/admin/boards/${encodeURIComponent(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deleteBoard: (id, reqOpts) =>
      t.del<void>(`/api/admin/boards/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),

    // tenant
    getTenant: (reqOpts) =>
      t.get<Tenant>("/api/admin/tenant", { signal: reqOpts?.signal }),
    updateTenant: (input, reqOpts) =>
      t.put<Tenant>("/api/admin/tenant", {
        body: input,
        signal: reqOpts?.signal,
      }),
    rotateKeys: (reqOpts) =>
      t.post<TenantCreated>("/api/admin/tenant/rotate-keys", {
        signal: reqOpts?.signal,
      }),
  };
}
