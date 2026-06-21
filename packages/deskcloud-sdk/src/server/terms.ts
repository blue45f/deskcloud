/**
 * @heejun/deskcloud/server — Terms Desk SERVER (admin/dashboard) client.
 *
 * Mirrors TermsDesk's dashboard REST routes (NestJS global prefix `/api`,
 * SessionGuard + permission matrix). Covers policy/version lifecycle, the
 * consent-receipt + inquiry boards, members/org/plan, audit log, operational
 * insights, API-key management, and CSV exports:
 *
 *   Policies (policy.read/write):
 *     - GET    /api/policies                 list                       → Policy[]
 *     - POST   /api/policies                 create (empty registry)    → Policy
 *     - GET    /api/policies/:idOrSlug       one (id or slug)           → Policy
 *     - PATCH  /api/policies/:idOrSlug       update metadata            → Policy
 *     - DELETE /api/policies/:idOrSlug       archive                    → { ok: true }
 *
 *   Versions (policy.read / version.create / version.publish):
 *     - GET    /api/policies/:policyId/versions          timeline       → PolicyVersionSummary[]
 *     - POST   /api/policies/:policyId/versions          new draft      → PolicyVersionDetail
 *     - GET    /api/versions/:versionId                  detail (body)  → PolicyVersionDetail
 *     - PATCH  /api/versions/:versionId                  edit draft     → PolicyVersionDetail
 *     - POST   /api/versions/:versionId/publish          publish/freeze → PolicyVersionDetail
 *
 *   Consents (consent.read):
 *     - GET    /api/consents                 receipts (filtered)        → ConsentReceipt[]
 *     - GET    /api/consents/subject/:ref    one subject's history      → ConsentReceipt[]
 *
 *   Inquiries (inquiry.read/manage):
 *     - GET    /api/inquiries                board (filtered)           → InquiryList
 *     - GET    /api/inquiries/:id            one                        → Inquiry
 *     - PATCH  /api/inquiries/:id            triage (status/note)       → Inquiry
 *
 *   Members / Org / Plan (member.manage):
 *     - GET    /api/members                  list                       → Member[]
 *     - POST   /api/members                  invite                     → Member
 *     - PATCH  /api/members/:id              change role                → Member
 *     - DELETE /api/members/:id              remove                     → { ok: true }
 *     - PATCH  /api/org                       update org                 → Org
 *     - GET    /api/org/usage                plan/limits/usage          → PlanUsage
 *     - PATCH  /api/org/plan                  change plan (mock billing) → Org
 *
 *   API keys (apikey.manage):
 *     - GET    /api/apikeys                  list                       → ApiKey[]
 *     - POST   /api/apikeys                  issue (plaintext once)     → ApiKeyCreated
 *     - DELETE /api/apikeys/:id              revoke                     → { ok: true }
 *
 *   Audit / Insights / Export:
 *     - GET    /api/audit                                 change log    → AuditEvent[]
 *     - GET    /api/insights/consents/daily               consent trend → ConsentTrendPoint[]
 *     - GET    /api/insights/reconsent                    reconsent     → ReconsentStatus[]
 *     - GET    /api/insights/apikeys                      key usage     → ApiKeyUsage
 *     - GET    /api/export/consents.csv                   CSV           → string
 *     - GET    /api/export/policies/:policyId/versions.csv CSV          → string
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 * TermsDesk's dashboard is session-guarded; for SDK/server use the secret key is
 * supplied as a session-bearer credential the transport forwards.
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from @termsdesk/shared — admin
 * surface) so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain enums / value types (mirrored from @termsdesk/shared)
// ---------------------------------------------------------------------------

/** Document classification. */
export type PolicyType =
  | "terms"
  | "privacy"
  | "marketing"
  | "refund"
  | "cookie"
  | "custom";

/** Policy visibility — controls fully-public render exposure only. */
export type PolicyVisibility = "public" | "private";

/** Version lifecycle. Published versions are immutable (body + hash frozen). */
export type VersionStatus = "draft" | "scheduled" | "published" | "archived";

/** End-user consent decision. */
export type ConsentDecision = "accepted" | "declined" | "withdrawn";

/** How a consent was collected. */
export type ConsentMethod = "checkbox_clickwrap" | "api" | "import" | "sso";

/** Org RBAC role. */
export type Role = "owner" | "admin" | "publisher" | "editor" | "viewer";

/** Publishable API-key scopes. */
export type ApiKeyScope = "read:current" | "write:consent" | "read:consent";

/** Billing plan. Billing is mock — plan changes record a decision only. */
export type PlanId = "free" | "pro" | "team";

/** Private inquiry categories. */
export type InquiryCategory =
  | "contact"
  | "partnership"
  | "bug"
  | "qa"
  | "question";

/** Private inquiry statuses. */
export type InquiryStatus = "new" | "in_progress" | "closed";

// ---------------------------------------------------------------------------
// Domain DTOs (admin surface)
// ---------------------------------------------------------------------------

/** A policy (the registry entry; versions live underneath). */
export interface Policy {
  id: string;
  slug: string;
  name: string;
  type: PolicyType;
  jurisdiction: string;
  description: string | null;
  visibility: PolicyVisibility;
  currentVersionId: string | null;
  currentVersionLabel: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A policy version without the body (timeline row). */
export interface PolicyVersionSummary {
  id: string;
  policyId: string;
  versionNumber: number;
  versionLabel: string;
  title: string;
  status: VersionStatus;
  locale: string;
  contentHash: string | null;
  requiresReconsent: boolean;
  changeSummary: string | null;
  effectiveAt: string | null;
  createdByName: string | null;
  publishedByName: string | null;
  createdAt: string;
  publishedAt: string | null;
}

/** A policy version with its body. */
export interface PolicyVersionDetail extends PolicyVersionSummary {
  body: string;
}

/** Optional consent evidence stored with a receipt. */
export interface ConsentEvidence {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  buttonLabel?: string;
  widgetVersion?: string;
  renderedHashEcho?: string;
  [key: string]: unknown;
}

/** A consent receipt (append-only audit record). */
export interface ConsentReceipt {
  id: string;
  policySlug: string;
  policyVersionId: string;
  versionLabel: string;
  contentHash: string;
  subjectRef: string;
  decision: ConsentDecision;
  method: ConsentMethod;
  locale: string;
  evidence: ConsentEvidence | null;
  parentReceiptId: string | null;
  createdAt: string;
}

/** Private inquiry (board view — includes contact/IP, never in public output). */
export interface Inquiry {
  id: string;
  siteSlug: string;
  orgId: string | null;
  category: InquiryCategory;
  status: InquiryStatus;
  title: string;
  body: string;
  contactEmail: string | null;
  originUrl: string | null;
  userAgent: string | null;
  ip: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Inquiry board listing (mirrors X-Total-Count). */
export interface InquiryList {
  items: Inquiry[];
  /** Total for the same filter (matches the X-Total-Count header). */
  total: number;
}

/** An org member. */
export interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

/** The organization (tenant). */
export interface Org {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: PlanId;
  planChangedAt: string | null;
  createdAt: string;
}

/** Plan limit set (-1 = unlimited). */
export interface PlanLimits {
  members: number;
  policies: number;
  apiKeys: number;
  apiCallsPerMonth: number;
}

/** Current plan + limits + usage snapshot. */
export interface PlanUsage {
  plan: PlanId;
  planChangedAt: string | null;
  limits: PlanLimits;
  usage: {
    members: number;
    policies: number;
    apiKeys: number;
    apiCallsThisMonth: number;
  };
  /** Aggregation month (UTC), 'YYYY-MM'. */
  month: string;
}

/** A publishable API key (the hash is never exposed). */
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

/** API-key issue response — the plaintext key is shown exactly once. */
export interface ApiKeyCreated extends ApiKey {
  plaintextKey: string;
}

/** An append-only audit/change-log event. */
export interface AuditEvent {
  id: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string | null;
  ip: string | null;
  createdAt: string;
}

/** A single day's consent-trend bucket (UTC). */
export interface ConsentTrendPoint {
  /** YYYY-MM-DD (UTC). */
  date: string;
  accepted: number;
  declined: number;
  withdrawn: number;
  total: number;
}

/** Per-policy re-consent status against the current published hash. */
export interface ReconsentStatus {
  policyId: string;
  policySlug: string;
  policyName: string;
  currentVersionLabel: string | null;
  totalSubjects: number;
  acceptedCurrent: number;
  pendingReconsent: number;
}

/** API-key usage summary. */
export interface ApiKeyUsage {
  keys: ApiKey[];
  /** Last-30-day consent writes via API (audit_events action='consent.recorded'). */
  consentWrites30d: number;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/** Create-policy payload. */
export interface CreatePolicyInput {
  slug: string;
  name: string;
  type: PolicyType;
  /** Defaults to 'KR' server-side. */
  jurisdiction?: string;
  description?: string;
}

/** Partial policy-metadata update. */
export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  jurisdiction?: string;
  visibility?: PolicyVisibility;
}

/** New-version draft payload. */
export interface CreateVersionInput {
  title: string;
  body: string;
  /** Defaults to 'ko' server-side. */
  locale?: string;
  changeSummary?: string;
}

/** Draft edit payload (published versions are immutable). */
export interface UpdateVersionInput {
  title?: string;
  body?: string;
  changeSummary?: string;
}

/** Publish payload — freezes content_hash and promotes to current. */
export interface PublishVersionInput {
  /** Effective date; future → scheduled, past/now → published immediately. */
  effectiveAt?: string;
  /** Operator-declared: material/adverse change requires re-consent. */
  requiresReconsent?: boolean;
  changeSummary?: string;
}

/** Filter + pagination for {@link TermsAdminClient.listConsents}. */
export interface ListConsentsParams {
  subjectRef?: string;
  policySlug?: string;
  decision?: ConsentDecision;
  method?: ConsentMethod;
  /** ISO start (inclusive). */
  from?: string;
  /** ISO end (inclusive). */
  to?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** Filter + pagination for {@link TermsAdminClient.listInquiries}. */
export interface ListInquiriesParams {
  status?: InquiryStatus;
  category?: InquiryCategory;
  /** Source site slug filter. */
  site?: string;
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

/** Inquiry triage payload. */
export interface UpdateInquiryInput {
  status?: InquiryStatus;
  /** null clears the note; omit to leave unchanged. */
  adminNote?: string | null;
}

/** Member-invite payload. */
export interface InviteMemberInput {
  email: string;
  name: string;
  /** Defaults to 'viewer' server-side. */
  role?: Role;
  password: string;
}

/** Org-metadata update. */
export interface UpdateOrgInput {
  name?: string;
  /** http(s) URL; '' or null removes the logo; omit to leave unchanged. */
  logoUrl?: string | null;
}

/** API-key issue payload. */
export interface CreateApiKeyInput {
  name: string;
  /** Defaults to ['read:current','write:consent'] server-side. */
  scopes?: ApiKeyScope[];
}

/** CSV-export filter for {@link TermsAdminClient.exportConsentsCsv}. */
export interface ExportConsentsParams {
  policySlug?: string;
  subjectRef?: string;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createTermsAdminClient}. Server-only (secret key required). */
export interface TermsAdminClientOptions {
  /** Base URL of the Terms Desk (e.g. 'https://termsdesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for dashboard routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Terms Desk client surface. */
export interface TermsAdminClient {
  // — Policies —
  /** List policies (GET /api/policies). */
  listPolicies(opts?: { signal?: AbortSignal }): Promise<Policy[]>;
  /** Create a policy (POST /api/policies). */
  createPolicy(
    input: CreatePolicyInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Policy>;
  /** Get one policy by id or slug (GET /api/policies/:idOrSlug). */
  getPolicy(idOrSlug: string, opts?: { signal?: AbortSignal }): Promise<Policy>;
  /** Update policy metadata (PATCH /api/policies/:idOrSlug). */
  updatePolicy(
    idOrSlug: string,
    input: UpdatePolicyInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Policy>;
  /** Archive a policy (DELETE /api/policies/:idOrSlug). */
  archivePolicy(
    idOrSlug: string,
    opts?: { signal?: AbortSignal },
  ): Promise<{ ok: true }>;

  // — Versions —
  /** Version timeline for a policy (GET /api/policies/:policyId/versions). */
  listVersions(
    policyId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<PolicyVersionSummary[]>;
  /** Create a draft version (POST /api/policies/:policyId/versions). */
  createVersion(
    policyId: string,
    input: CreateVersionInput,
    opts?: { signal?: AbortSignal },
  ): Promise<PolicyVersionDetail>;
  /** Version detail incl. body (GET /api/versions/:versionId). */
  getVersion(
    versionId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<PolicyVersionDetail>;
  /** Edit a draft version (PATCH /api/versions/:versionId). */
  updateVersion(
    versionId: string,
    input: UpdateVersionInput,
    opts?: { signal?: AbortSignal },
  ): Promise<PolicyVersionDetail>;
  /** Publish — freeze hash, promote to current (POST /api/versions/:versionId/publish). */
  publishVersion(
    versionId: string,
    input?: PublishVersionInput,
    opts?: { signal?: AbortSignal },
  ): Promise<PolicyVersionDetail>;

  // — Consents —
  /** List consent receipts with filters (GET /api/consents). */
  listConsents(params?: ListConsentsParams): Promise<ConsentReceipt[]>;
  /** Full consent history for one subject (GET /api/consents/subject/:subjectRef). */
  getSubjectConsents(
    subjectRef: string,
    opts?: { signal?: AbortSignal },
  ): Promise<ConsentReceipt[]>;

  // — Inquiries —
  /** Inquiry board with filters (GET /api/inquiries). */
  listInquiries(params?: ListInquiriesParams): Promise<InquiryList>;
  /** Get one inquiry (GET /api/inquiries/:id). */
  getInquiry(id: string, opts?: { signal?: AbortSignal }): Promise<Inquiry>;
  /** Triage an inquiry — status / admin note (PATCH /api/inquiries/:id). */
  updateInquiry(
    id: string,
    input: UpdateInquiryInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Inquiry>;

  // — Members —
  /** List org members (GET /api/members). */
  listMembers(opts?: { signal?: AbortSignal }): Promise<Member[]>;
  /** Invite a member (POST /api/members). */
  inviteMember(
    input: InviteMemberInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Member>;
  /** Change a member's role (PATCH /api/members/:id). */
  updateMemberRole(
    id: string,
    role: Role,
    opts?: { signal?: AbortSignal },
  ): Promise<Member>;
  /** Remove a member (DELETE /api/members/:id). */
  removeMember(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<{ ok: true }>;

  // — Org / Plan —
  /** Update the org (PATCH /api/org). */
  updateOrg(
    input: UpdateOrgInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Org>;
  /** Plan, limits, and usage (GET /api/org/usage). */
  getUsage(opts?: { signal?: AbortSignal }): Promise<PlanUsage>;
  /** Change plan — mock billing, records a decision only (PATCH /api/org/plan). */
  changePlan(plan: PlanId, opts?: { signal?: AbortSignal }): Promise<Org>;

  // — API keys —
  /** List API keys (GET /api/apikeys). */
  listApiKeys(opts?: { signal?: AbortSignal }): Promise<ApiKey[]>;
  /** Issue an API key — plaintext exposed once (POST /api/apikeys). */
  createApiKey(
    input: CreateApiKeyInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ApiKeyCreated>;
  /** Revoke an API key (DELETE /api/apikeys/:id). */
  revokeApiKey(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<{ ok: true }>;

  // — Audit / Insights —
  /** Audit/change log, append-only (GET /api/audit). */
  listAudit(params?: {
    limit?: number;
    signal?: AbortSignal;
  }): Promise<AuditEvent[]>;
  /** Daily consent trend (GET /api/insights/consents/daily). */
  getConsentTrend(params?: {
    days?: number;
    signal?: AbortSignal;
  }): Promise<ConsentTrendPoint[]>;
  /** Per-policy re-consent status (GET /api/insights/reconsent). */
  getReconsentStatus(opts?: {
    signal?: AbortSignal;
  }): Promise<ReconsentStatus[]>;
  /** API-key usage summary (GET /api/insights/apikeys). */
  getApiKeyUsage(opts?: { signal?: AbortSignal }): Promise<ApiKeyUsage>;

  // — Exports (CSV strings) —
  /** Consent receipts as CSV (GET /api/export/consents.csv). */
  exportConsentsCsv(params?: ExportConsentsParams): Promise<string>;
  /** A policy's version history as CSV (GET /api/export/policies/:policyId/versions.csv). */
  exportVersionsCsv(
    policyId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<string>;
}

/**
 * Create a server-only Terms Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createTermsAdminClient({ endpoint, secretKey })
 *   const policy = await admin.createPolicy({ slug: 'privacy', name: '개인정보처리방침', type: 'privacy' })
 *   const draft = await admin.createVersion(policy.id, { title: 'v1', body: '...' })
 *   await admin.publishVersion(draft.id, { requiresReconsent: true })
 */
export function createTermsAdminClient(
  opts: TermsAdminClientOptions,
): TermsAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    // — Policies —
    listPolicies: (reqOpts) =>
      t.get<Policy[]>("/api/policies", { signal: reqOpts?.signal }),
    createPolicy: (input, reqOpts) =>
      t.post<Policy>("/api/policies", { body: input, signal: reqOpts?.signal }),
    getPolicy: (idOrSlug, reqOpts) =>
      t.get<Policy>(`/api/policies/${encodeURIComponent(idOrSlug)}`, {
        signal: reqOpts?.signal,
      }),
    updatePolicy: (idOrSlug, input, reqOpts) =>
      t.patch<Policy>(`/api/policies/${encodeURIComponent(idOrSlug)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    archivePolicy: (idOrSlug, reqOpts) =>
      t.del<{ ok: true }>(`/api/policies/${encodeURIComponent(idOrSlug)}`, {
        signal: reqOpts?.signal,
      }),

    // — Versions —
    listVersions: (policyId, reqOpts) =>
      t.get<PolicyVersionSummary[]>(
        `/api/policies/${encodeURIComponent(policyId)}/versions`,
        { signal: reqOpts?.signal },
      ),
    createVersion: (policyId, input, reqOpts) =>
      t.post<PolicyVersionDetail>(
        `/api/policies/${encodeURIComponent(policyId)}/versions`,
        { body: input, signal: reqOpts?.signal },
      ),
    getVersion: (versionId, reqOpts) =>
      t.get<PolicyVersionDetail>(
        `/api/versions/${encodeURIComponent(versionId)}`,
        {
          signal: reqOpts?.signal,
        },
      ),
    updateVersion: (versionId, input, reqOpts) =>
      t.patch<PolicyVersionDetail>(
        `/api/versions/${encodeURIComponent(versionId)}`,
        {
          body: input,
          signal: reqOpts?.signal,
        },
      ),
    publishVersion: (versionId, input, reqOpts) =>
      t.post<PolicyVersionDetail>(
        `/api/versions/${encodeURIComponent(versionId)}/publish`,
        { body: input ?? {}, signal: reqOpts?.signal },
      ),

    // — Consents —
    listConsents: (params) =>
      t.get<ConsentReceipt[]>("/api/consents", {
        query: {
          subjectRef: params?.subjectRef,
          policySlug: params?.policySlug,
          decision: params?.decision,
          method: params?.method,
          from: params?.from,
          to: params?.to,
          offset: params?.offset,
          limit: params?.limit,
        },
        signal: params?.signal,
      }),
    getSubjectConsents: (subjectRef, reqOpts) =>
      t.get<ConsentReceipt[]>(
        `/api/consents/subject/${encodeURIComponent(subjectRef)}`,
        { signal: reqOpts?.signal },
      ),

    // — Inquiries —
    listInquiries: (params) =>
      t.get<InquiryList>("/api/inquiries", {
        query: {
          status: params?.status,
          category: params?.category,
          site: params?.site,
          offset: params?.offset,
          limit: params?.limit,
        },
        signal: params?.signal,
      }),
    getInquiry: (id, reqOpts) =>
      t.get<Inquiry>(`/api/inquiries/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),
    updateInquiry: (id, input, reqOpts) =>
      t.patch<Inquiry>(`/api/inquiries/${encodeURIComponent(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),

    // — Members —
    listMembers: (reqOpts) =>
      t.get<Member[]>("/api/members", { signal: reqOpts?.signal }),
    inviteMember: (input, reqOpts) =>
      t.post<Member>("/api/members", { body: input, signal: reqOpts?.signal }),
    updateMemberRole: (id, role, reqOpts) =>
      t.patch<Member>(`/api/members/${encodeURIComponent(id)}`, {
        body: { role },
        signal: reqOpts?.signal,
      }),
    removeMember: (id, reqOpts) =>
      t.del<{ ok: true }>(`/api/members/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),

    // — Org / Plan —
    updateOrg: (input, reqOpts) =>
      t.patch<Org>("/api/org", { body: input, signal: reqOpts?.signal }),
    getUsage: (reqOpts) =>
      t.get<PlanUsage>("/api/org/usage", { signal: reqOpts?.signal }),
    changePlan: (plan, reqOpts) =>
      t.patch<Org>("/api/org/plan", {
        body: { plan },
        signal: reqOpts?.signal,
      }),

    // — API keys —
    listApiKeys: (reqOpts) =>
      t.get<ApiKey[]>("/api/apikeys", { signal: reqOpts?.signal }),
    createApiKey: (input, reqOpts) =>
      t.post<ApiKeyCreated>("/api/apikeys", {
        body: input,
        signal: reqOpts?.signal,
      }),
    revokeApiKey: (id, reqOpts) =>
      t.del<{ ok: true }>(`/api/apikeys/${encodeURIComponent(id)}`, {
        signal: reqOpts?.signal,
      }),

    // — Audit / Insights —
    listAudit: (params) =>
      t.get<AuditEvent[]>("/api/audit", {
        query: { limit: params?.limit },
        signal: params?.signal,
      }),
    getConsentTrend: (params) =>
      t.get<ConsentTrendPoint[]>("/api/insights/consents/daily", {
        query: { days: params?.days },
        signal: params?.signal,
      }),
    getReconsentStatus: (reqOpts) =>
      t.get<ReconsentStatus[]>("/api/insights/reconsent", {
        signal: reqOpts?.signal,
      }),
    getApiKeyUsage: (reqOpts) =>
      t.get<ApiKeyUsage>("/api/insights/apikeys", { signal: reqOpts?.signal }),

    // — Exports —
    exportConsentsCsv: (params) =>
      t.get<string>("/api/export/consents.csv", {
        query: {
          policySlug: params?.policySlug,
          subjectRef: params?.subjectRef,
        },
        headers: { accept: "text/csv" },
        signal: params?.signal,
      }),
    exportVersionsCsv: (policyId, reqOpts) =>
      t.get<string>(
        `/api/export/policies/${encodeURIComponent(policyId)}/versions.csv`,
        { headers: { accept: "text/csv" }, signal: reqOpts?.signal },
      ),
  };
}
