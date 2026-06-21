/**
 * @heejun/deskcloud — Changelog Desk SERVER (admin) client.
 *
 * Covers the secret-key (AdminAuthGuard) surface:
 *   - changelog entry CRUD + publish toggle,
 *   - tenant settings (corsOrigins / plan) and key rotation.
 *
 * Built on the shared `createDeskTransport`, which sends the secret key as the
 * `x-sk` header. The secret key is REQUIRED here and must NEVER reach a browser.
 *
 * Domain types are duplicated from ChangelogDesk's `packages/shared` so this
 * SDK is self-contained (zero dependency on the Desk repos).
 */
import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ── domain types (mirrored from @changelogdesk/shared) ───────────────────────

/** Changelog entry tag. */
export type ChangelogEntryTag = "new" | "improved" | "fixed" | "announcement";

/** Tenant plan. */
export type ChangelogPlan = "free" | "pro";

/** A changelog entry (published or draft). */
export interface ChangelogEntry {
  id: string;
  tenantId: string;
  title: string;
  bodyMarkdown: string;
  /** Server-sanitized HTML the widget can render directly. */
  bodyHtml: string;
  tag: ChangelogEntryTag;
  version: string | null;
  category: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

/** Admin entry list (published + draft, newest first). */
export interface ChangelogAdminEntryList {
  items: ChangelogEntry[];
  total: number;
}

/** Tenant view returned by admin reads (without the secret key). */
export interface ChangelogTenant {
  id: string;
  name: string;
  slug: string;
  publishableKey: string;
  corsOrigins: string[];
  plan: ChangelogPlan;
  usageCount: number;
  /** free-plan monthly soft limit; `overLimit` is true once exceeded. */
  monthlyLimit: number;
  overLimit: boolean;
  createdAt: string;
}

/** Key-rotation response — `secretKey` is plaintext and shown ONCE. */
export interface ChangelogTenantWithKeys {
  tenant: ChangelogTenant;
  publishableKey: string;
  /** Plaintext secret key — exposed only in this response. Store it securely. */
  secretKey: string;
}

/** Simple acknowledgement envelope. */
export interface ChangelogOk {
  ok: true;
}

// ── params ───────────────────────────────────────────────────────────────────

/** Body to create a changelog entry. `isPublished: true` publishes immediately. */
export interface CreateEntryInput {
  title: string;
  bodyMarkdown?: string;
  tag: ChangelogEntryTag;
  version?: string | null;
  category?: string | null;
  isPublished?: boolean;
  /** ISO timestamp; server fills it at publish time when omitted. */
  publishedAt?: string | null;
}

/** Body to update a changelog entry — all fields optional (partial update). */
export interface UpdateEntryInput {
  title?: string;
  bodyMarkdown?: string;
  tag?: ChangelogEntryTag;
  version?: string | null;
  category?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
}

/** Body to update tenant settings — at least one of `corsOrigins` / `plan`. */
export interface UpdateTenantInput {
  corsOrigins?: string[];
  plan?: ChangelogPlan;
}

// ── client ─────────────────────────────────────────────────────────────────

export interface ChangelogAdminClientOptions {
  endpoint: string;
  secretKey: string;
}

export interface ChangelogAdminClient {
  /** GET /api/admin/changelog — all entries (published + draft), newest first. */
  listEntries: (opts?: {
    signal?: AbortSignal;
  }) => Promise<ChangelogAdminEntryList>;
  /** GET /api/admin/changelog/:id — a single entry. */
  getEntry: (
    id: string,
    opts?: { signal?: AbortSignal },
  ) => Promise<ChangelogEntry>;
  /** POST /api/admin/changelog — create an entry (publishes if isPublished). */
  createEntry: (input: CreateEntryInput) => Promise<ChangelogEntry>;
  /** PUT /api/admin/changelog/:id — partial update / publish toggle. */
  updateEntry: (id: string, input: UpdateEntryInput) => Promise<ChangelogEntry>;
  /** DELETE /api/admin/changelog/:id — delete an entry. */
  deleteEntry: (id: string) => Promise<ChangelogOk>;
  /** GET /api/admin/tenant — tenant settings, publishable key, and usage. */
  getTenant: (opts?: { signal?: AbortSignal }) => Promise<ChangelogTenant>;
  /** PUT /api/admin/tenant — update corsOrigins / plan. */
  updateTenant: (input: UpdateTenantInput) => Promise<ChangelogTenant>;
  /** POST /api/admin/tenant/rotate-keys — reissue pk/sk; returns secretKey ONCE. */
  rotateKeys: () => Promise<ChangelogTenantWithKeys>;
}

/**
 * Create a server-side Changelog admin client bound to one Desk endpoint + secret key.
 *
 * @example
 *   const admin = createChangelogAdminClient({ endpoint, secretKey: 'sk_…' })
 *   const entry = await admin.createEntry({ title: 'v2', tag: 'new', isPublished: true })
 */
export function createChangelogAdminClient(
  opts: ChangelogAdminClientOptions,
): ChangelogAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    listEntries: (o) =>
      t.get<ChangelogAdminEntryList>("/api/admin/changelog", {
        signal: o?.signal,
      }),

    getEntry: (id, o) =>
      t.get<ChangelogEntry>(`/api/admin/changelog/${encodeURIComponent(id)}`, {
        signal: o?.signal,
      }),

    createEntry: (input) =>
      t.post<ChangelogEntry>("/api/admin/changelog", { body: input }),

    updateEntry: (id, input) =>
      t.put<ChangelogEntry>(`/api/admin/changelog/${encodeURIComponent(id)}`, {
        body: input,
      }),

    deleteEntry: (id) =>
      t.del<ChangelogOk>(`/api/admin/changelog/${encodeURIComponent(id)}`),

    getTenant: (o) =>
      t.get<ChangelogTenant>("/api/admin/tenant", { signal: o?.signal }),

    updateTenant: (input) =>
      t.put<ChangelogTenant>("/api/admin/tenant", { body: input }),

    rotateKeys: () =>
      t.post<ChangelogTenantWithKeys>("/api/admin/tenant/rotate-keys"),
  };
}
