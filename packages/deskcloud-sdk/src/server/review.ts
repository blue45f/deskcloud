/**
 * @heejun/deskcloud/server — Review Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors ReviewDesk's admin, SecretKeyGuard-protected REST routes
 * (global prefix `/api`). Covers review moderation/CRUD plus tenant settings:
 *   - GET    /api/admin/reviews            list/filter reviews         → AdminReviewList
 *   - PATCH  /api/admin/reviews/:id        moderate (approve/…/reply)  → { ok: true }
 *   - DELETE /api/admin/reviews/:id        delete a review             → void (204)
 *   - GET    /api/admin/tenant             my tenant settings + usage  → Tenant
 *   - PUT    /api/admin/tenant             update settings             → Tenant
 *   - POST   /api/admin/tenant/rotate-keys rotate keys (sk shown once) → TenantCreated
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from ReviewDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @reviewdesk/shared — admin surface)
// ---------------------------------------------------------------------------

/** Review moderation lifecycle. */
export type ReviewStatus = "pending" | "approved" | "rejected";

/** Admin moderation actions (the PATCH `action` field). */
export type ModerationAction =
  | "approve"
  | "reject"
  | "feature"
  | "unfeature"
  | "reply";

/** Tenant billing plan. `free` is subject to a soft usage cap. */
export type Plan = "free" | "pro" | "scale";

/** Optional widget-supplied context attached to a submission. */
export interface ReviewMeta {
  pageUrl?: string;
  userAgent?: string;
  referrer?: string;
}

/** A review with all fields (including private `authorEmail` / `meta`). */
export interface AdminReview {
  id: string;
  tenantId: string;
  subjectId: string;
  subjectLabel: string | null;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorEmail: string | null;
  status: ReviewStatus;
  featured: boolean;
  reply: string | null;
  source: string | null;
  meta: ReviewMeta | null;
  createdAt: string;
}

/** Paginated admin review list (mirrors X-Total-Count). */
export interface AdminReviewList {
  items: AdminReview[];
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
  autoApprove: boolean;
  usageCount: number;
  createdAt: string;
}

/**
 * Tenant created/rotated response. The secret key is exposed exactly ONCE
 * here (the DB stores only its hash thereafter).
 */
export interface TenantCreated {
  tenant: Tenant;
  /** Browser-safe (submit + read approved). */
  publishableKey: string;
  /** Server-only (moderate/CRUD). Not retrievable after this response. */
  secretKey: string;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/** Filter + pagination for {@link ReviewAdminClient.listReviews}. */
export interface ListReviewsParams {
  status?: ReviewStatus;
  subjectId?: string;
  featured?: boolean;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** Moderation payload for {@link ReviewAdminClient.moderate}. */
export interface ModerateReviewInput {
  action: ModerationAction;
  /** Required for the `reply` action; empty string clears an existing reply. */
  reply?: string;
}

/** Partial tenant settings update for {@link ReviewAdminClient.updateTenant}. */
export interface UpdateTenantInput {
  name?: string;
  corsOrigins?: string[];
  autoApprove?: boolean;
  plan?: Plan;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createReviewAdminClient}. Server-only (secret key required). */
export interface ReviewAdminClientOptions {
  /** Base URL of the Review Desk (e.g. 'https://reviewdesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Review Desk client surface. */
export interface ReviewAdminClient {
  /** List/filter reviews with pagination (GET /api/admin/reviews). */
  listReviews(params?: ListReviewsParams): Promise<AdminReviewList>;
  /** Moderate a review — approve|reject|feature|unfeature|reply (PATCH /api/admin/reviews/:id). */
  moderate(
    id: string,
    input: ModerateReviewInput,
    opts?: { signal?: AbortSignal },
  ): Promise<{ ok: true }>;
  /** Delete a review (DELETE /api/admin/reviews/:id). */
  deleteReview(id: string, opts?: { signal?: AbortSignal }): Promise<void>;
  /** My tenant settings, usage, and keys (GET /api/admin/tenant). */
  getTenant(opts?: { signal?: AbortSignal }): Promise<Tenant>;
  /** Update tenant settings — name/corsOrigins/autoApprove/plan (PUT /api/admin/tenant). */
  updateTenant(
    input: UpdateTenantInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Tenant>;
  /** Rotate keys — returns new pk/sk (sk shown once); old keys invalidated (POST /api/admin/tenant/rotate-keys). */
  rotateKeys(opts?: { signal?: AbortSignal }): Promise<TenantCreated>;
}

/**
 * Create a server-only Review Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createReviewAdminClient({ endpoint, secretKey })
 *   const { items, total } = await admin.listReviews({ status: 'pending', limit: 50 })
 *   await admin.moderate(items[0]!.id, { action: 'approve' })
 */
export function createReviewAdminClient(
  opts: ReviewAdminClientOptions,
): ReviewAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    listReviews: (params) =>
      t.get<AdminReviewList>("/api/admin/reviews", {
        query: {
          status: params?.status,
          subjectId: params?.subjectId,
          featured: params?.featured,
          offset: params?.offset,
          limit: params?.limit,
        },
        signal: params?.signal,
      }),
    moderate: (id, input, reqOpts) =>
      t.patch<{ ok: true }>(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deleteReview: (id, reqOpts) =>
      t.del<void>(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),
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
