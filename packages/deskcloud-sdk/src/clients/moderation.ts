/**
 * @heejun/deskcloud — Moderation Desk BROWSER client (publishable `pk_` surface).
 *
 * Mirrors ModerationDesk's public REST routes (global prefix `/api`). Covers the
 * client-facing surface a browser widget / app frontend needs:
 *   - POST /api/moderate   check text → { verdict, matchedRules, aiScore?, logId }
 *                          (accepts pk OR sk; the browser uses pk)
 *   - POST /api/reports    report content → receipt (id·status·createdAt)
 *
 * Rule-based moderation always runs; the optional Claude AI assist runs only when
 * the Desk has an ANTHROPIC_API_KEY configured (and `useAi` is not false).
 *
 * Auth is handled by the transport: the publishable key is sent as the `x-pk`
 * header AND the `?pk=` query param. NEVER reference a secret key here — admin
 * operations (rules/reports/logs/tenant) live in '@heejun/deskcloud/server'
 * (createModerationAdminClient).
 *
 * Domain types are duplicated here (derived from ModerationDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @moderationdesk/shared — public surface only)
// ---------------------------------------------------------------------------

/** Moderation verdict — strength order: allow < flag < block. */
export type Verdict = "allow" | "flag" | "block";

/** How a forbidden rule matches text. */
export type RuleKind = "exact" | "substring" | "regex";

/** What a matched rule triggers (`review` maps to a `flag` verdict). */
export type RuleAction = "block" | "flag" | "review";

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

/** Public moderation check result. */
export interface ModerateResult {
  verdict: Verdict;
  /** Forbidden rules that matched (rule-based). Empty array when none. */
  matchedRules: MatchedRule[];
  /**
   * AI-assist toxicity score (0..1). Present only when the AI path ran and
   * produced a score; absent when the key is unset / errored / `useAi` was false.
   */
  aiScore?: number;
  /** Id of the moderation log row recorded for this check (for tracing). */
  logId: string;
}

/** Report lifecycle. */
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

/** Receipt returned to a reporter (minimal — no operator notes). */
export interface ReportReceipt {
  id: string;
  status: ReportStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Payload for {@link ModerationClient.check} (POST /api/moderate). */
export interface ModerateInput {
  /** Text to check (1..20000 chars; server sanitizes). */
  text: string;
  /**
   * Force the AI assist off with `false` (rules only, even when a key exists).
   * Default behaviour is to use AI when the Desk has a key configured.
   */
  useAi?: boolean;
  /** Optional context metadata. */
  meta?: ModerateMeta;
}

/**
 * Payload for {@link ModerationClient.report} (POST /api/reports).
 * Server-controlled fields (status/notes) are intentionally absent.
 */
export interface SubmitReportInput {
  /** Kind of subject being reported (e.g. 'comment', 'post'). */
  subjectType: string;
  /** Identifier of the reported subject. */
  subjectId: string;
  /** Why it is being reported. */
  reason: string;
  /** Optional id of the reporter. */
  reporterId?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createModerationClient}. Browser-safe (publishable key only). */
export interface ModerationClientOptions {
  /** Base URL of the Moderation Desk (e.g. 'https://moderationdesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Moderation Desk client surface. */
export interface ModerationClient {
  /**
   * Check text against the tenant's forbidden rules (+ optional AI assist).
   * POST /api/moderate. Returns the verdict, matched rules, and log id.
   */
  check(
    input: ModerateInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ModerateResult>;
  /**
   * Report a piece of content for operator review. POST /api/reports.
   * Returns a receipt (status starts as `open`).
   */
  report(
    input: SubmitReportInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ReportReceipt>;
}

/**
 * Create a browser-safe Moderation Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const moderation = createModerationClient({ endpoint, publishableKey })
 *   const { verdict } = await moderation.check({ text: comment })
 *   if (verdict === 'block') reject()
 */
export function createModerationClient(
  opts: ModerationClientOptions,
): ModerationClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    check: (input, reqOpts) =>
      t.post<ModerateResult>("/api/moderate", {
        body: input,
        signal: reqOpts?.signal,
      }),
    report: (input, reqOpts) =>
      t.post<ReportReceipt>("/api/reports", {
        body: input,
        signal: reqOpts?.signal,
      }),
  };
}
