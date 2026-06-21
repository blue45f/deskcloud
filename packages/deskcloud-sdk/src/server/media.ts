/**
 * @heejun/deskcloud/server — Media Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors MediaDesk's admin, AdminAuthGuard-protected REST routes
 * (global prefix `/api`; the secret key is read from the `x-sk` header).
 * Covers full asset management + tenant settings/keys:
 *   - GET    /api/admin/me                  current tenant (+ usage)   → MediaTenant
 *   - PATCH  /api/admin/tenant              update name/plan/CORS      → MediaTenant
 *   - POST   /api/admin/tenant/rotate-keys  rotate keys (sk shown once)→ MediaRotateKeysResult
 *   - GET    /api/admin/storage             storage driver + transform → MediaStorageInfo
 *   - GET    /api/admin/assets              list all tenant assets     → MediaAdminAssetList
 *   - GET    /api/admin/folders             logical folder names       → string[]
 *   - DELETE /api/admin/assets/<key...>     delete an asset by key     → MediaDeleteResult
 *
 * (GET /api/admin/tenants is intentionally omitted — it requires the master
 *  X-Admin-Token, not a tenant secret key, and 400s for `sk_` callers.)
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from MediaDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @mediadesk/shared — admin surface)
// ---------------------------------------------------------------------------

/** Tenant billing plan. `free` carries a soft usage cap; `pro` is uncapped. */
export type MediaPlan = "free" | "pro";

/** A tenant asset (admin view). Mirrors @mediadesk/shared's AssetDto. */
export interface MediaAsset {
  /** Tenant-relative storage key, e.g. 'avatars/ab12-photo.png'. */
  key: string;
  /** Ready-to-use public URL (the original). */
  url: string;
  /** MIME type, e.g. 'image/png'. */
  contentType: string;
  /** Byte size. */
  size: number;
  /** Logical folder (null at the root). */
  folder: string | null;
  /** Whether this is a raster image that can be transformed on the fly. */
  transformable: boolean;
  /** Pixel dimensions (for images, when known). */
  width?: number | null;
  height?: number | null;
  /** ISO creation timestamp. */
  createdAt: string;
}

/** Paginated admin asset list (folder filter + pagination). */
export interface MediaAdminAssetList {
  items: MediaAsset[];
  /** Total count for the same filter. */
  total: number;
  offset: number;
  limit: number;
}

/** Tenant usage (bytes + object count) against the plan's soft caps. */
export interface MediaUsage {
  bytes: number;
  count: number;
  /** Free-plan soft cap (null on `pro`). */
  maxBytes: number | null;
  maxCount: number | null;
}

/** Admin view of a tenant (the secret key is never included — only its hash is stored). */
export interface MediaTenant {
  id: string;
  slug: string;
  name: string;
  plan: MediaPlan;
  /** CORS allowlist for public endpoints ('*' = allow all). */
  corsOrigins: string[];
  /** Browser-safe publishable key (pk_…). */
  publishableKey: string;
  /** Active storage driver ('local' | 's3'). */
  storageDriver: string;
  usage: MediaUsage;
  createdAt: string;
}

/**
 * Key-rotation result — new key plaintext exposed exactly ONCE. Old keys are
 * invalidated immediately; the DB stores only the secret's hash thereafter.
 */
export interface MediaRotateKeysResult {
  /** Browser-safe (upload + read). */
  publishableKey: string;
  /** Server-only (manage/delete). Not retrievable after this response. */
  secretKey: string;
}

/** Storage adapter info (admin info panel). */
export interface MediaStorageInfo {
  /** Active storage driver ('local' | 's3'). */
  driver: string;
  /** Human-readable location (local: directory, s3: bucket/region). */
  location: string;
  /** Whether on-the-fly image transforms (sharp) are available. */
  transformAvailable: boolean;
}

/** Result of an asset delete. */
export interface MediaDeleteResult {
  deleted: true;
  key: string;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/** Filter + pagination for {@link MediaAdminClient.listAssets}. */
export interface ListMediaAssetsParams {
  /** Restrict to one logical folder. */
  folder?: string;
  /** Max items to return (server clamps to 1..200). */
  limit?: number;
  /** Pagination offset. */
  offset?: number;
  signal?: AbortSignal;
}

/** Partial tenant settings update for {@link MediaAdminClient.updateTenant}. */
export interface UpdateMediaTenantInput {
  name?: string;
  plan?: MediaPlan;
  corsOrigins?: string[];
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createMediaAdminClient}. Server-only (secret key required). */
export interface MediaAdminClientOptions {
  /** Base URL of the Media Desk (e.g. 'https://mediadesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Media Desk client surface. */
export interface MediaAdminClient {
  /** Current authenticated tenant, including usage (GET /api/admin/me). */
  getTenant(opts?: { signal?: AbortSignal }): Promise<MediaTenant>;
  /** Update tenant settings — name/plan/corsOrigins (PATCH /api/admin/tenant). */
  updateTenant(
    input: UpdateMediaTenantInput,
    opts?: { signal?: AbortSignal },
  ): Promise<MediaTenant>;
  /** Rotate keys — returns new pk/sk (sk shown once); old keys invalidated (POST /api/admin/tenant/rotate-keys). */
  rotateKeys(opts?: { signal?: AbortSignal }): Promise<MediaRotateKeysResult>;
  /** Storage adapter info + transform availability (GET /api/admin/storage). */
  getStorageInfo(opts?: { signal?: AbortSignal }): Promise<MediaStorageInfo>;
  /** List all tenant assets — folder filter + pagination (GET /api/admin/assets). */
  listAssets(params?: ListMediaAssetsParams): Promise<MediaAdminAssetList>;
  /** List the tenant's logical folders (GET /api/admin/folders). */
  listFolders(opts?: { signal?: AbortSignal }): Promise<string[]>;
  /** Delete an asset by key — storage, DB, and usage are all updated (DELETE /api/admin/assets/:key). */
  deleteAsset(
    key: string,
    opts?: { signal?: AbortSignal },
  ): Promise<MediaDeleteResult>;
}

/** Encode a tenant-relative key into a path while preserving folder separators. */
function encodeKeyPath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Create a server-only Media Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createMediaAdminClient({ endpoint, secretKey })
 *   const { items, total } = await admin.listAssets({ folder: 'avatars', limit: 50 })
 *   await admin.deleteAsset(items[0]!.key)
 */
export function createMediaAdminClient(
  opts: MediaAdminClientOptions,
): MediaAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    getTenant: (reqOpts) =>
      t.get<MediaTenant>("/api/admin/me", { signal: reqOpts?.signal }),
    updateTenant: (input, reqOpts) =>
      t.patch<MediaTenant>("/api/admin/tenant", {
        body: input,
        signal: reqOpts?.signal,
      }),
    rotateKeys: (reqOpts) =>
      t.post<MediaRotateKeysResult>("/api/admin/tenant/rotate-keys", {
        signal: reqOpts?.signal,
      }),
    getStorageInfo: (reqOpts) =>
      t.get<MediaStorageInfo>("/api/admin/storage", {
        signal: reqOpts?.signal,
      }),
    listAssets: (params) =>
      t.get<MediaAdminAssetList>("/api/admin/assets", {
        query: {
          folder: params?.folder,
          limit: params?.limit,
          offset: params?.offset,
        },
        signal: params?.signal,
      }),
    listFolders: (reqOpts) =>
      t.get<string[]>("/api/admin/folders", { signal: reqOpts?.signal }),
    deleteAsset: (key, reqOpts) =>
      t.del<MediaDeleteResult>(`/api/admin/assets/${encodeKeyPath(key)}`, {
        signal: reqOpts?.signal,
      }),
  };
}
