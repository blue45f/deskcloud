/**
 * @heejun/deskcloud/server — SearchDesk SERVER (admin) client (secret `sk_`).
 *
 * Covers the SecretKeyGuard surface a backend needs:
 *   - document indexing: upsert (single/batch) + delete  (`/api/docs`)
 *   - admin: list indexed docs, read/update tenant, rotate keys, usage (`/api/admin/*`)
 *
 * SECURITY: SERVER-ONLY. Uses the secret key (`sk_…`, sent as `x-sk`). NEVER import
 * this from browser/client-bundled code.
 *
 * Types below are duplicated from the SearchDesk `packages/shared` contract so the
 * SDK is self-contained (zero dependency on the Desk repo).
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ── Domain types (mirrored from @searchdesk/shared) ──────────────────────────

/** Tenant plan — `free` has a soft document cap, `pro` is unlimited. */
export type SearchPlan = "free" | "pro";

/** A single document to index. `title`/`body` are the full-text search targets. */
export interface SearchDocumentInput {
  /** Stable tenant-chosen id (upsert key). */
  id: string;
  /** Target index; defaults to `default` server-side. */
  index?: string;
  title: string;
  /** Searchable body. Empty allowed (title-only docs). */
  body?: string | null;
  /** Click-through URL (optional). */
  url?: string | null;
  /** Single facet/filter category (optional). */
  category?: string | null;
  /** Facet/filter tags (optional; de-duplicated server-side). */
  tags?: string[];
  /** Arbitrary structured metadata (not searched; echoed back on results). */
  attrs?: Record<string, unknown>;
}

/**
 * Index request — a single `document` OR a `documents[]` batch (one is required).
 * Same `(index, id)` is upserted (overwritten).
 */
export interface SearchUpsertInput {
  document?: SearchDocumentInput;
  documents?: SearchDocumentInput[];
}

/** Result of an upsert — count indexed + current total + whether the cap was hit. */
export interface SearchIndexResult {
  /** Documents upserted by this request. */
  upserted: number;
  /** Tenant's current total document count. */
  docCount: number;
  /** Whether the free-plan cap rejected some/all docs. */
  capExceeded: boolean;
}

/** Result of a document delete. */
export interface SearchDeleteResult {
  deleted: boolean;
  docCount: number;
}

/** An indexed document (admin list / index responses). */
export interface SearchDocument {
  id: string;
  index: string;
  title: string;
  body: string;
  url: string | null;
  category: string | null;
  tags: string[];
  attrs: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** Paginated admin document list. */
export interface SearchDocumentList {
  items: SearchDocument[];
  total: number;
  offset: number;
  limit: number;
}

/** Tenant representation (secret plaintext excluded) — admin read/update responses. */
export interface SearchTenant {
  id: string;
  name: string;
  slug: string;
  plan: SearchPlan;
  publishableKey: string;
  corsOrigins: string[];
  /** Cumulative indexed document count (soft-cap basis). */
  docCount: number;
  createdAt: string;
}

/**
 * Tenant credentials returned ONLY by rotate-keys — the plaintext secret key is
 * exposed exactly once here (stored hashed thereafter).
 */
export interface SearchTenantCredentials {
  id: string;
  name: string;
  slug: string;
  plan: SearchPlan;
  publishableKey: string;
  /** Plaintext secret key — surfaced only in this rotate (or signup) response. */
  secretKey: string;
  corsOrigins: string[];
  createdAt: string;
}

/** Usage summary (admin) — counts + plan cap. */
export interface SearchUsage {
  tenantId: string;
  plan: SearchPlan;
  /** Cumulative indexed document count. */
  docCount: number;
  /** Free-plan cap (null = unlimited, i.e. `pro`). */
  docCap: number | null;
  /** Cumulative search-call count. */
  searchCount: number;
}

/** Tenant settings update (admin) — at least one field required server-side. */
export interface SearchTenantUpdate {
  name?: string;
  corsOrigins?: string[];
  plan?: SearchPlan;
}

/** Pagination/filter params for {@link SearchAdminClient.listDocuments}. */
export interface SearchListDocumentsParams {
  /** Limit to a single index (defaults to all of the tenant's docs). */
  index?: string;
  offset?: number;
  limit?: number;
}

/** Options accepted by {@link createSearchAdminClient}. */
export interface SearchAdminClientOptions {
  endpoint: string;
  secretKey: string;
}

/** The SearchDesk server (admin) client surface. */
export interface SearchAdminClient {
  /** Upsert one or many documents (`POST /api/docs`). */
  upsertDocuments: (input: SearchUpsertInput) => Promise<SearchIndexResult>;
  /** Delete a document by id (`DELETE /api/docs/:id`); `index` defaults to `default`. */
  deleteDocument: (id: string, index?: string) => Promise<SearchDeleteResult>;
  /** List indexed documents, newest first (`GET /api/admin/docs`). */
  listDocuments: (
    params?: SearchListDocumentsParams,
  ) => Promise<SearchDocumentList>;
  /** Read the authenticated tenant (`GET /api/admin/tenant`). */
  getTenant: () => Promise<SearchTenant>;
  /** Update tenant settings — name/corsOrigins/plan (`PUT /api/admin/tenant`). */
  updateTenant: (input: SearchTenantUpdate) => Promise<SearchTenant>;
  /** Rotate keys — issue a new `pk_`/`sk_` pair (`POST /api/admin/tenant/rotate-keys`). */
  rotateKeys: () => Promise<SearchTenantCredentials>;
  /** Usage summary — doc/search counts + plan cap (`GET /api/admin/usage`). */
  getUsage: () => Promise<SearchUsage>;
}

/**
 * Create a SearchDesk server (admin) client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createSearchAdminClient({ endpoint, secretKey: 'sk_…' })
 *   await admin.upsertDocuments({ document: { id: 'd1', title: 'Hello' } })
 */
export function createSearchAdminClient(
  opts: SearchAdminClientOptions,
): SearchAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    upsertDocuments: (input) =>
      t.post<SearchIndexResult>("/api/docs", { body: input }),

    deleteDocument: (id, index) =>
      t.del<SearchDeleteResult>(`/api/docs/${encodeURIComponent(id)}`, {
        query: { index },
      }),

    listDocuments: (params = {}) =>
      t.get<SearchDocumentList>("/api/admin/docs", {
        query: {
          index: params.index,
          offset: params.offset,
          limit: params.limit,
        },
      }),

    getTenant: () => t.get<SearchTenant>("/api/admin/tenant"),

    updateTenant: (input) =>
      t.put<SearchTenant>("/api/admin/tenant", { body: input }),

    rotateKeys: () =>
      t.post<SearchTenantCredentials>("/api/admin/tenant/rotate-keys"),

    getUsage: () => t.get<SearchUsage>("/api/admin/usage"),
  };
}
