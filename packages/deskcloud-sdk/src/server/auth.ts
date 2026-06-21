/**
 * @heejun/deskcloud/server — Auth Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors AuthDesk's admin, SecretKeyGuard-protected REST routes (global prefix
 * `/api`). These manage the tenant's end-user pool from a trusted backend:
 *   - GET    /api/auth/users     list end-users (paginated, email search) → UserList
 *   - DELETE /api/auth/users/:id delete an end-user (revokes sessions)    → DeleteResult
 *   - GET    /api/auth/stats     user-count / signups / logins / verified → AuthStats
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from @authdesk/shared) so the SDK
 * stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @authdesk/shared — admin surface)
// ---------------------------------------------------------------------------

/** Tenant billing plan — drives the end-user (`auth_users`) soft cap. */
export type Plan = "free" | "pro" | "scale" | "enterprise";

/**
 * An end-user as exposed by the admin API. The password hash is never present
 * in any payload.
 */
export interface EndUser {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** Paginated end-user list (GET /api/auth/users). */
export interface UserList {
  items: EndUser[];
  /** Total end-users matching the (optional) email filter. */
  total: number;
  offset: number;
  limit: number;
}

/** Tenant end-user statistics (GET /api/auth/stats). */
export interface AuthStats {
  /** Total end-users in the tenant pool. */
  userCount: number;
  /** New signups in the last 7 / 30 days. */
  signups: { last7d: number; last30d: number };
  /** Cumulative successful logins (the `logins` usage metric). */
  logins: number;
  /** Count of verified end-users. */
  verified: number;
  plan: Plan;
}

/** Response for {@link AuthAdminClient.deleteUser} (DELETE /api/auth/users/:id). */
export interface DeleteResult {
  deleted: true;
  id: string;
}

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

/** Filter + pagination for {@link AuthAdminClient.listUsers}. */
export interface ListUsersParams {
  /** Page offset (default 0). */
  offset?: number;
  /** Page size, 1..100 (default 25). */
  limit?: number;
  /** Partial email search. */
  q?: string;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createAuthAdminClient}. Server-only (secret key required). */
export interface AuthAdminClientOptions {
  /** Base URL of the Auth Desk (e.g. 'https://authdesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Auth Desk client surface. */
export interface AuthAdminClient {
  /** List/search end-users with pagination (GET /api/auth/users). */
  listUsers(params?: ListUsersParams): Promise<UserList>;
  /** Delete an end-user; their sessions are revoked too (DELETE /api/auth/users/:id). */
  deleteUser(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<DeleteResult>;
  /** Tenant end-user statistics (GET /api/auth/stats). */
  getStats(opts?: { signal?: AbortSignal }): Promise<AuthStats>;
}

/**
 * Create a server-only Auth Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createAuthAdminClient({ endpoint, secretKey })
 *   const { items, total } = await admin.listUsers({ q: 'acme.com', limit: 50 })
 *   const stats = await admin.getStats()
 */
export function createAuthAdminClient(
  opts: AuthAdminClientOptions,
): AuthAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    listUsers: (params) =>
      t.get<UserList>("/api/auth/users", {
        query: {
          offset: params?.offset,
          limit: params?.limit,
          q: params?.q,
        },
        signal: params?.signal,
      }),
    deleteUser: (id, reqOpts) =>
      t.del<DeleteResult>(`/api/auth/users/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),
    getStats: (reqOpts) =>
      t.get<AuthStats>("/api/auth/stats", { signal: reqOpts?.signal }),
  };
}
