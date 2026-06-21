/**
 * @heejun/deskcloud/server — Moderation Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors ModerationDesk's admin, SecretKeyGuard-protected REST routes
 * (global prefix `/api`), plus the server-side moderate call and tenant signup:
 *   - POST   /api/moderate                  check text (server-side, sk)     → ModerateResult
 *   - GET    /api/admin/rules               list forbidden rules             → AdminRule[]
 *   - POST   /api/admin/rules               create a rule                    → AdminRule
 *   - PATCH  /api/admin/rules/:id           update a rule (partial)          → AdminRule
 *   - DELETE /api/admin/rules/:id           delete a rule                    → void (204)
 *   - GET    /api/admin/reports             list/filter reports              → AdminReportList
 *   - PATCH  /api/admin/reports/:id         update report (status/notes)     → AdminReport
 *   - GET    /api/admin/logs                list/filter moderation logs      → AdminLogList
 *   - GET    /api/admin/tenant              my tenant settings + usage       → Tenant
 *   - PUT    /api/admin/tenant              update settings                  → Tenant
 *   - POST   /api/admin/tenant/rotate-keys  rotate keys (sk shown once)      → TenantCreated
 *   - POST   /api/tenants                   self-serve signup (sk shown once)→ TenantCreated
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 * (`POST /api/tenants` is unauthenticated signup — the secret key is irrelevant
 * to that one call but harmless to send.)
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from ModerationDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @moderationdesk/shared — admin surface)
// ---------------------------------------------------------------------------

/** Moderation verdict — strength order: allow < flag < block. */
export type Verdict = "allow" | "flag" | "block";

/** How a forbidden rule matches text. */
export type RuleKind = "exact" | "substring" | "regex";

/** What a matched rule triggers (`review` maps to a `flag` verdict). */
export type RuleAction = "block" | "flag" | "review";

/** Report lifecycle. */
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

/** Tenant billing plan. `free` is subject to a soft usage cap. */
export type Plan = "free" | "pro" | "scale";

/** Summary of one forbidden rule that matched the checked text. */
export interface MatchedRule {
  id: string;
  pattern: string;
  kind: RuleKind;
  action: RuleAction;
}

/** Optional caller-supplied context attached to a moderation check (all optional). */
export interface ModerateMeta {
  pageUrl?: string;
  userId?: string;
  source?: string;
}

/** Moderation check result. */
export interface ModerateResult {
  verdict: Verdict;
  matchedRules: MatchedRule[];
  aiScore?: number;
  logId: string;
}

/** A forbidden rule — admin representation. */
export interface AdminRule {
  id: string;
  tenantId: string;
  pattern: string;
  kind: RuleKind;
  action: RuleAction;
  label: string | null;
  enabled: boolean;
  createdAt: string;
}

/** A report — admin representation (includes operator notes). */
export interface AdminReport {
  id: string;
  tenantId: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  reporterId: string | null;
  status: ReportStatus;
  notes: string | null;
  createdAt: string;
}

/** Paginated admin report list (mirrors the X-Total-Count header). */
export interface AdminReportList {
  items: AdminReport[];
  /** Total count for the same filter (matches the X-Total-Count header). */
  total: number;
  offset: number;
  limit: number;
}

/** A moderation log — admin representation. */
export interface AdminLog {
  id: string;
  tenantId: string;
  text: string;
  verdict: Verdict;
  matchedRules: MatchedRule[];
  aiScore: number | null;
  source: string | null;
  createdAt: string;
}

/** Paginated admin log list (mirrors the X-Total-Count header). */
export interface AdminLogList {
  items: AdminLog[];
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
  usageCount: number;
  createdAt: string;
}

/**
 * Tenant created/rotated response. The secret key is exposed exactly ONCE
 * here (the DB stores only its hash thereafter).
 */
export interface TenantCreated {
  tenant: Tenant;
  /** Browser-safe (moderate + report). */
  publishableKey: string;
  /** Server-only (rules/reports/logs/tenant). Not retrievable after this response. */
  secretKey: string;
}

// ---------------------------------------------------------------------------
// Input / param types
// ---------------------------------------------------------------------------

/** Payload for {@link ModerationAdminClient.check} (server-side moderate). */
export interface ModerateInput {
  text: string;
  useAi?: boolean;
  meta?: ModerateMeta;
}

/** Payload for {@link ModerationAdminClient.createRule}. */
export interface CreateRuleInput {
  pattern: string;
  /** Defaults to `substring` server-side. */
  kind?: RuleKind;
  /** Defaults to `block` server-side. */
  action?: RuleAction;
  label?: string | null;
  /** Defaults to `true` server-side. */
  enabled?: boolean;
}

/** Partial rule update for {@link ModerationAdminClient.updateRule}. */
export interface UpdateRuleInput {
  pattern?: string;
  kind?: RuleKind;
  action?: RuleAction;
  label?: string | null;
  enabled?: boolean;
}

/** Filter + pagination for {@link ModerationAdminClient.listReports}. */
export interface ListReportsParams {
  status?: ReportStatus;
  subjectType?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** Report update for {@link ModerationAdminClient.updateReport} (status and/or notes). */
export interface UpdateReportInput {
  status?: ReportStatus;
  notes?: string | null;
}

/** Filter + pagination for {@link ModerationAdminClient.listLogs}. */
export interface ListLogsParams {
  verdict?: Verdict;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** Self-serve signup payload for {@link ModerationAdminClient.signup}. */
export interface CreateTenantInput {
  name: string;
  /** Optional — server derives a slug from `name` when omitted. */
  slug?: string;
  /** Allowed origins for public (pk) calls; `*` allows all. Defaults to `[]`. */
  corsOrigins?: string[];
}

/** Partial tenant settings update for {@link ModerationAdminClient.updateTenant}. */
export interface UpdateTenantInput {
  name?: string;
  corsOrigins?: string[];
  plan?: Plan;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createModerationAdminClient}. Server-only (secret key required). */
export interface ModerationAdminClientOptions {
  /** Base URL of the Moderation Desk (e.g. 'https://moderationdesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Moderation Desk client surface. */
export interface ModerationAdminClient {
  /** Check text server-side (POST /api/moderate, authenticated with the secret key). */
  check(
    input: ModerateInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ModerateResult>;

  /** List forbidden rules, newest first (GET /api/admin/rules). */
  listRules(opts?: { signal?: AbortSignal }): Promise<AdminRule[]>;
  /** Create a forbidden rule (POST /api/admin/rules). */
  createRule(
    input: CreateRuleInput,
    opts?: { signal?: AbortSignal },
  ): Promise<AdminRule>;
  /** Update a forbidden rule, partially (PATCH /api/admin/rules/:id). */
  updateRule(
    id: string,
    input: UpdateRuleInput,
    opts?: { signal?: AbortSignal },
  ): Promise<AdminRule>;
  /** Delete a forbidden rule (DELETE /api/admin/rules/:id). */
  deleteRule(id: string, opts?: { signal?: AbortSignal }): Promise<void>;

  /** List/filter reports with pagination (GET /api/admin/reports). */
  listReports(params?: ListReportsParams): Promise<AdminReportList>;
  /** Update a report — status and/or notes (PATCH /api/admin/reports/:id). */
  updateReport(
    id: string,
    input: UpdateReportInput,
    opts?: { signal?: AbortSignal },
  ): Promise<AdminReport>;

  /** List/filter moderation logs with pagination (GET /api/admin/logs). */
  listLogs(params?: ListLogsParams): Promise<AdminLogList>;

  /** My tenant settings, usage, and keys (GET /api/admin/tenant). */
  getTenant(opts?: { signal?: AbortSignal }): Promise<Tenant>;
  /** Update tenant settings — name/corsOrigins/plan (PUT /api/admin/tenant). */
  updateTenant(
    input: UpdateTenantInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Tenant>;
  /** Rotate keys — returns new pk/sk (sk shown once); old keys invalidated (POST /api/admin/tenant/rotate-keys). */
  rotateKeys(opts?: { signal?: AbortSignal }): Promise<TenantCreated>;

  /** Self-serve tenant signup — returns pk + sk (sk shown once) (POST /api/tenants). */
  signup(
    input: CreateTenantInput,
    opts?: { signal?: AbortSignal },
  ): Promise<TenantCreated>;
}

/**
 * Create a server-only Moderation Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createModerationAdminClient({ endpoint, secretKey })
 *   await admin.createRule({ pattern: 'badword', kind: 'substring', action: 'block' })
 *   const { items } = await admin.listReports({ status: 'open', limit: 50 })
 */
export function createModerationAdminClient(
  opts: ModerationAdminClientOptions,
): ModerationAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    check: (input, reqOpts) =>
      t.post<ModerateResult>("/api/moderate", {
        body: input,
        signal: reqOpts?.signal,
      }),

    listRules: (reqOpts) =>
      t.get<AdminRule[]>("/api/admin/rules", { signal: reqOpts?.signal }),
    createRule: (input, reqOpts) =>
      t.post<AdminRule>("/api/admin/rules", {
        body: input,
        signal: reqOpts?.signal,
      }),
    updateRule: (id, input, reqOpts) =>
      t.patch<AdminRule>(`/api/admin/rules/${encodeURIComponent(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deleteRule: (id, reqOpts) =>
      t.del<void>(`/api/admin/rules/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),

    listReports: (params) =>
      t.get<AdminReportList>("/api/admin/reports", {
        query: {
          status: params?.status,
          subjectType: params?.subjectType,
          offset: params?.offset,
          limit: params?.limit,
        },
        signal: params?.signal,
      }),
    updateReport: (id, input, reqOpts) =>
      t.patch<AdminReport>(`/api/admin/reports/${encodeURIComponent(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),

    listLogs: (params) =>
      t.get<AdminLogList>("/api/admin/logs", {
        query: {
          verdict: params?.verdict,
          offset: params?.offset,
          limit: params?.limit,
        },
        signal: params?.signal,
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

    signup: (input, reqOpts) =>
      t.post<TenantCreated>("/api/tenants", {
        body: input,
        signal: reqOpts?.signal,
      }),
  };
}
