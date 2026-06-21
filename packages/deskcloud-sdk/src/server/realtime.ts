/**
 * @heejun/deskcloud/server — Realtime Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors RealtimeDesk's secret-key REST routes (global prefix `/api`). The
 * secret key drives both the core publish path and tenant self-service:
 *   - POST  /api/publish                  broadcast {channel,event,data}   → PublishResult
 *                                         (SecretKeyGuard)
 *   - GET   /api/admin/tenant             my tenant (keys + usage)         → RealtimeTenant
 *   - GET   /api/admin/tenant/usage       usage counters (messages/conns)  → RealtimeUsage
 *   - PATCH /api/admin/tenant             update settings (name/cors/plan) → RealtimeTenant
 *   - POST  /api/admin/tenant/rotate-keys rotate keys (sk shown once)      → TenantWithSecret
 *                                         (AdminGuard — sk identifies tenant)
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 * This Desk's guards read the key from the `X-Realtime-Key` header, so we ALSO
 * bridge it there via the transport's `defaultHeaders`.
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from RealtimeDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @realtimedesk/shared — admin surface)
// ---------------------------------------------------------------------------

/** Tenant billing plan. `free` is subject to a soft usage cap. */
export type RealtimePlan = "free" | "pro";

/** Realtime usage counters for a tenant. */
export interface RealtimeUsage {
  /** Cumulative published message count. */
  messages: number;
  /** Cumulative successful-handshake connection count. */
  connections: number;
  /** Plan caps. */
  cap: { messages: number; connections: number };
}

/** Public tenant representation (secret hash never exposed). */
export interface RealtimeTenant {
  id: string;
  name: string;
  publishableKey: string;
  corsOrigins: string[];
  plan: RealtimePlan;
  usage: RealtimeUsage;
  /** ISO timestamp. */
  createdAt: string;
}

/**
 * Signup / rotate response — a {@link RealtimeTenant} PLUS the plaintext secret
 * key, exposed exactly ONCE (the DB stores only its hash thereafter).
 */
export interface RealtimeTenantWithSecret extends RealtimeTenant {
  /** Plaintext secret key (`sk_…`). Store securely; not retrievable again. */
  secretKey: string;
}

/** A single realtime message (the persisted publish result). */
export interface RealtimeMessage {
  id: string;
  tenantId: string;
  channel: string;
  event: string;
  /** Arbitrary JSON payload. */
  data: unknown;
  /** ISO timestamp. */
  publishedAt: string;
}

/**
 * Result of a publish — the number of (socket) subscribers it reached plus the
 * persisted message (or `null` when history is disabled, REALTIME_HISTORY_LIMIT=0).
 */
export interface PublishResult {
  /** Count of socket subscribers the event was delivered to. */
  delivered: number;
  /** The persisted message, or null when persistence is disabled. */
  message: RealtimeMessage | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Publish payload (POST /api/publish). */
export interface PublishInput {
  /** Channel name (1..128 chars, [A-Za-z0-9_.:-]). */
  channel: string;
  /** Event name (1..128 chars, [A-Za-z0-9_.:-]). */
  event: string;
  /** Arbitrary JSON payload. Omit to signal an event with no body. */
  data?: unknown;
}

/**
 * Partial tenant settings update (PATCH /api/admin/tenant). Only sent fields
 * are updated; at least one must be present. Keys/usage cannot be changed here
 * (keys are rotated via {@link RealtimeAdminClient.rotateKeys}).
 */
export interface UpdateTenantSettingsInput {
  name?: string;
  /** WS-handshake / pk-route Origin allowlist (full replace). */
  corsOrigins?: string[];
  plan?: RealtimePlan;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createRealtimeAdminClient}. Server-only (secret key required). */
export interface RealtimeAdminClientOptions {
  /** Base URL of the Realtime Desk (e.g. 'https://realtimedesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin + publish routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin/server Realtime Desk client surface. */
export interface RealtimeAdminClient {
  /**
   * Broadcast an event to a channel's subscribers and (if history is enabled)
   * persist it (POST /api/publish). Subject to the tenant's monthly message cap
   * (over-cap publishes throw a 429 DeskError).
   */
  publish(
    input: PublishInput,
    opts?: { signal?: AbortSignal },
  ): Promise<PublishResult>;
  /** My tenant settings, keys, and usage (GET /api/admin/tenant). */
  getTenant(opts?: { signal?: AbortSignal }): Promise<RealtimeTenant>;
  /** Usage counters — messages / connections / caps (GET /api/admin/tenant/usage). */
  getUsage(opts?: { signal?: AbortSignal }): Promise<RealtimeUsage>;
  /** Update tenant settings — name / corsOrigins / plan (PATCH /api/admin/tenant). */
  updateSettings(
    input: UpdateTenantSettingsInput,
    opts?: { signal?: AbortSignal },
  ): Promise<RealtimeTenant>;
  /** Rotate keys — returns new pk/sk (sk shown once); old keys invalidated (POST /api/admin/tenant/rotate-keys). */
  rotateKeys(opts?: {
    signal?: AbortSignal;
  }): Promise<RealtimeTenantWithSecret>;
}

/**
 * Create a server-only Realtime Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createRealtimeAdminClient({ endpoint, secretKey })
 *   const { delivered } = await admin.publish({ channel: 'room:42', event: 'msg', data: { text: 'hi' } })
 *   const usage = await admin.getUsage()
 */
export function createRealtimeAdminClient(
  opts: RealtimeAdminClientOptions,
): RealtimeAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
    // This Desk's SecretKeyGuard / AdminGuard read the key from `X-Realtime-Key`.
    defaultHeaders: { "x-realtime-key": opts.secretKey },
  });

  return {
    publish: (input, reqOpts) =>
      t.post<PublishResult>("/api/publish", {
        body: input,
        signal: reqOpts?.signal,
      }),
    getTenant: (reqOpts) =>
      t.get<RealtimeTenant>("/api/admin/tenant", { signal: reqOpts?.signal }),
    getUsage: (reqOpts) =>
      t.get<RealtimeUsage>("/api/admin/tenant/usage", {
        signal: reqOpts?.signal,
      }),
    updateSettings: (input, reqOpts) =>
      t.patch<RealtimeTenant>("/api/admin/tenant", {
        body: input,
        signal: reqOpts?.signal,
      }),
    rotateKeys: (reqOpts) =>
      t.post<RealtimeTenantWithSecret>("/api/admin/tenant/rotate-keys", {
        signal: reqOpts?.signal,
      }),
  };
}
