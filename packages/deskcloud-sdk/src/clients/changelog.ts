/**
 * @heejun/deskcloud — Changelog Desk BROWSER client.
 *
 * Covers the public (publishable-key) surface a widget/browser needs:
 *   - the published changelog wall (incremental via `since`),
 *   - the unread-count badge (per anonymous device id),
 *   - recording the last-seen entry,
 *   - self-serve tenant onboarding (the unauthenticated signup route).
 *
 * Built on the shared `createDeskTransport`, which sends the publishable key
 * as both the `x-pk` header and the `?pk=` query param. NEVER reference a
 * secret key here — admin lives in `src/server/changelog.ts`.
 *
 * Domain types are duplicated from ChangelogDesk's `packages/shared` so this
 * SDK is self-contained (zero dependency on the Desk repos).
 */
import { createDeskTransport } from "../core/http.js";

// ── domain types (mirrored from @changelogdesk/shared) ───────────────────────

/** Changelog entry tag — drives the widget badge color / filter / icon. */
export type ChangelogEntryTag = "new" | "improved" | "fixed" | "announcement";

/** Tenant plan. `free` carries a monthly soft limit. */
export type ChangelogPlan = "free" | "pro";

/** A published (or admin) changelog entry. */
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

/** Public widget list response — published entries only (newest first). */
export interface PublicChangelog {
  tenant: { name: string; slug: string };
  items: ChangelogEntry[];
  /** Total published entries matching the same filter. */
  total: number;
}

/** Unread-count response — for the widget badge. */
export interface ChangelogUnreadCount {
  /** Entries published since the anonId last saw the wall. */
  unreadCount: number;
  /** Current latest published entry id (what the widget should record next as seen). */
  latestEntryId: string | null;
}

/** Tenant view returned by onboarding (without the secret key). */
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

/** Signup / key-rotation response — `secretKey` is plaintext and shown ONCE. */
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

/** Query for the public changelog wall. */
export interface GetWallParams {
  /** ISO timestamp — only entries published after this (incremental polling). */
  since?: string;
  /** Max items (server default 20, max 100). */
  limit?: number;
  /** Per-request cancellation. */
  signal?: AbortSignal;
}

/** Params for the unread-count badge. */
export interface GetUnreadCountParams {
  /** Widget device anonymous id. */
  anonId: string;
  signal?: AbortSignal;
}

/** Body for recording the last-seen entry. */
export interface MarkSeenInput {
  /** Widget device anonymous id. */
  anonId: string;
  /** Last seen entry id (UUID). Omit to mark everything (current latest) as read. */
  lastSeenEntryId?: string;
}

/** Body for self-serve tenant onboarding (unauthenticated). */
export interface SignupInput {
  name: string;
  /** Optional slug; derived from `name` when omitted. */
  slug?: string;
  /** Origin allowlist for the embedding site(s); can be set later. */
  corsOrigins?: string[];
}

// ── client ─────────────────────────────────────────────────────────────────

export interface ChangelogClientOptions {
  endpoint: string;
  publishableKey?: string;
}

export interface ChangelogClient {
  /** GET /api/changelog — published wall (newest first); bumps tenant usage. */
  getWall: (params?: GetWallParams) => Promise<PublicChangelog>;
  /** GET /api/changelog/unread-count — unread badge count for an anonId. */
  getUnreadCount: (
    params: GetUnreadCountParams,
  ) => Promise<ChangelogUnreadCount>;
  /** POST /api/changelog/seen — record the last-seen entry for an anonId. */
  markSeen: (input: MarkSeenInput) => Promise<ChangelogOk>;
  /** POST /api/tenants — self-serve onboarding; returns plaintext secretKey ONCE. */
  signup: (input: SignupInput) => Promise<ChangelogTenantWithKeys>;
}

/**
 * Create a browser-safe Changelog client bound to one Desk endpoint + publishable key.
 *
 * @example
 *   const cl = createChangelogClient({ endpoint, publishableKey: 'pk_…' })
 *   const wall = await cl.getWall({ limit: 20 })
 */
export function createChangelogClient(
  opts: ChangelogClientOptions,
): ChangelogClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    getWall: (params) =>
      t.get<PublicChangelog>("/api/changelog", {
        query: { since: params?.since, limit: params?.limit },
        signal: params?.signal,
      }),

    getUnreadCount: (params) =>
      t.get<ChangelogUnreadCount>("/api/changelog/unread-count", {
        query: { anonId: params.anonId },
        signal: params.signal,
      }),

    markSeen: (input) =>
      t.post<ChangelogOk>("/api/changelog/seen", {
        body: { anonId: input.anonId, lastSeenEntryId: input.lastSeenEntryId },
      }),

    signup: (input) =>
      t.post<ChangelogTenantWithKeys>("/api/tenants", { body: input }),
  };
}
