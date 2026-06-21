/**
 * @heejun/deskcloud/server — FileDesk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors FileDesk's admin, SecretKeyGuard-protected REST routes (global prefix
 * `/api`). Covers file management plus tenant settings:
 *   - GET    /api/files                 list files (paginated, visibility filter) → FileList
 *   - GET    /api/files/stats           usage stats (count + bytes, by visibility) → FileStats
 *   - POST   /api/files/:id/signed-url  issue a signed token for a private file    → SignedUrl
 *   - DELETE /api/files/:id             delete a file (registry + storage bytes)    → DeleteResult
 *   - GET    /api/tenant                my tenant settings + usage                  → FileTenant
 *   - PUT    /api/tenant                update settings (name·corsOrigins·plan)     → FileTenant
 *   - POST   /api/tenant/rotate-keys    rotate keys — new pk/sk (sk shown once)     → FileTenantCredentials
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from FileDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @filedesk/shared — admin surface)
// ---------------------------------------------------------------------------

/** File visibility — `public` (anyone via URL) · `private` (sk_ or signed token). */
export type FileVisibility = "public" | "private";

/** Storage driver — `postgres` (bytea, v1 default) · `s3` (production swap). */
export type StorageDriver = "postgres" | "s3";

/** Tenant billing plan. `free` has a soft file-count cap; `pro` is unlimited. */
export type FilePlan = "free" | "pro";

/** Usage metric keys — file count · total stored bytes. */
export type UsageMetric = "files" | "storage_bytes";

/** File object metadata (no bytes — serving is a separate endpoint). */
export interface FileObject {
  id: string;
  tenantId: string;
  /** Opaque content key — the serving URL path (`/api/files/:key`). */
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  visibility: FileVisibility;
  storageDriver: StorageDriver;
  createdAt: string;
}

/** Paginated admin file list. */
export interface FileList {
  items: FileObject[];
  total: number;
  offset: number;
  limit: number;
}

/** One per-visibility usage breakdown row. */
export interface FileVisibilityStat {
  visibility: FileVisibility;
  files: number;
  storageBytes: number;
}

/** File usage stats — totals (by metric) + per-visibility breakdown. */
export interface FileStats {
  /** Per-metric totals — `{ files, storage_bytes }`. */
  metrics: Record<UsageMetric, number>;
  byVisibility: FileVisibilityStat[];
}

/** Signed-URL issuance result (time-limited private file access). */
export interface SignedUrl {
  /** Serving URL with the signed `token` appended. */
  url: string;
  /** The opaque signed token (HMAC); also embedded in `url`. */
  token: string;
  /** ISO timestamp at which the token expires. */
  expiresAt: string;
}

/** Delete result. */
export interface DeleteResult {
  deleted: boolean;
  id: string;
}

/** Tenant representation (plaintext secret never exposed) — admin read/update. */
export interface FileTenant {
  id: string;
  name: string;
  slug: string;
  plan: FilePlan;
  publishableKey: string;
  corsOrigins: string[];
  /** Cumulative upload (file count) counter. */
  usageCount: number;
  createdAt: string;
}

/**
 * Tenant credentials returned ONLY at signup/rotate — the plaintext secret key
 * is exposed exactly once here (stored hashed thereafter).
 */
export interface FileTenantCredentials {
  id: string;
  name: string;
  slug: string;
  plan: FilePlan;
  publishableKey: string;
  /** Plaintext secret key — surfaced only in this signup/rotate response. */
  secretKey: string;
  corsOrigins: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/** Filter + pagination for {@link FileAdminClient.listFiles}. */
export interface ListFilesParams {
  /** Filter by visibility. */
  visibility?: FileVisibility;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** Input for {@link FileAdminClient.signUrl}. */
export interface SignUrlInput {
  /** Seconds until expiry (default 300, min 10, max 86400). */
  expiresInSec?: number;
}

/** Partial tenant settings update for {@link FileAdminClient.updateTenant}. */
export interface UpdateTenantInput {
  name?: string;
  corsOrigins?: string[];
  plan?: FilePlan;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createFileAdminClient}. Server-only (secret key required). */
export interface FileAdminClientOptions {
  /** Base URL of the File Desk (e.g. 'https://filedesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin FileDesk client surface. */
export interface FileAdminClient {
  /** List/filter files with pagination (GET /api/files). */
  listFiles(params?: ListFilesParams): Promise<FileList>;
  /** Usage stats — count + bytes, broken down by visibility (GET /api/files/stats). */
  getStats(opts?: { signal?: AbortSignal }): Promise<FileStats>;
  /** Issue a signed token for time-limited private file access (POST /api/files/:id/signed-url). */
  signUrl(
    id: string,
    input?: SignUrlInput,
    opts?: { signal?: AbortSignal },
  ): Promise<SignedUrl>;
  /** Delete a file — registry + storage bytes (DELETE /api/files/:id). */
  deleteFile(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<DeleteResult>;
  /** My tenant settings, usage, and keys (GET /api/tenant). */
  getTenant(opts?: { signal?: AbortSignal }): Promise<FileTenant>;
  /** Update tenant settings — name/corsOrigins/plan (PUT /api/tenant). */
  updateTenant(
    input: UpdateTenantInput,
    opts?: { signal?: AbortSignal },
  ): Promise<FileTenant>;
  /** Rotate keys — returns new pk/sk (sk shown once); old keys invalidated (POST /api/tenant/rotate-keys). */
  rotateKeys(opts?: { signal?: AbortSignal }): Promise<FileTenantCredentials>;
}

/**
 * Create a server-only FileDesk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createFileAdminClient({ endpoint, secretKey })
 *   const { items, total } = await admin.listFiles({ visibility: 'private', limit: 50 })
 *   const { url } = await admin.signUrl(items[0]!.id, { expiresInSec: 600 })
 */
export function createFileAdminClient(
  opts: FileAdminClientOptions,
): FileAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    listFiles: (params) =>
      t.get<FileList>("/api/files", {
        query: {
          visibility: params?.visibility,
          offset: params?.offset,
          limit: params?.limit,
        },
        signal: params?.signal,
      }),
    getStats: (reqOpts) =>
      t.get<FileStats>("/api/files/stats", { signal: reqOpts?.signal }),
    signUrl: (id, input, reqOpts) =>
      t.post<SignedUrl>(`/api/files/${encodeURIComponent(id)}/signed-url`, {
        body: input ?? {},
        signal: reqOpts?.signal,
      }),
    deleteFile: (id, reqOpts) =>
      t.del<DeleteResult>(`/api/files/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),
    getTenant: (reqOpts) =>
      t.get<FileTenant>("/api/tenant", { signal: reqOpts?.signal }),
    updateTenant: (input, reqOpts) =>
      t.put<FileTenant>("/api/tenant", {
        body: input,
        signal: reqOpts?.signal,
      }),
    rotateKeys: (reqOpts) =>
      t.post<FileTenantCredentials>("/api/tenant/rotate-keys", {
        signal: reqOpts?.signal,
      }),
  };
}
