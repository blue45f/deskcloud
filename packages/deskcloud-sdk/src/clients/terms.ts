/**
 * @heejun/deskcloud — Terms Desk BROWSER client (public SDK surface).
 *
 * Mirrors TermsDesk's public REST routes (NestJS global prefix `/api`). TermsDesk
 * is a terms/policy version-control + consent-receipt service, so the browser
 * surface is the read/display + public-submit path a footer link, consent popup,
 * iframe, or contact form needs:
 *
 *   API-key (publishable) routes — ApiKeyGuard, key sent as `?pk=` / `x-pk`:
 *     - GET  /api/v1/policies/:slug/current   current published version + hash → PublicPolicy
 *     - POST /api/v1/consents                 record a consent receipt          → ConsentReceiptCreated
 *
 *   Fully-public (no key) render/verify + intake routes:
 *     - GET  /api/public/:orgSlug/policies/:slug         rendered doc (JSON)    → PublicRender
 *     - GET  /api/public/:orgSlug/policies/:slug/html    standalone HTML doc    → string
 *     - GET  /api/public/:orgSlug/policies/:slug/text    text/plain doc         → string
 *     - GET  /api/public/:orgSlug/policies/:slug/verify  tamper-check hash      → PublicVerify
 *     - POST /api/public/:siteSlug/inquiries             private inquiry intake → InquiryReceipt
 *     - GET  /api/public/support/:projectSlug/posts      public support board   → SupportPostList
 *     - POST /api/public/support/:projectSlug/posts      create support post    → SupportPost
 *
 * Auth is handled by the transport: the publishable key (an API key whose scopes
 * cover `read:current` / `write:consent`) is sent as the `x-pk` header AND the
 * `?pk=` query param. The fully-public routes ignore it. NEVER reference a secret
 * key here — dashboard/admin operations live in '@heejun/deskcloud/server'
 * (createTermsAdminClient).
 *
 * Domain types are duplicated here (derived from @termsdesk/shared — public
 * surface only) so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain enums / value types (mirrored from @termsdesk/shared)
// ---------------------------------------------------------------------------

/** Document classification. TermsDesk versions/serves docs, it does not author them. */
export type PolicyType =
  | "terms"
  | "privacy"
  | "marketing"
  | "refund"
  | "cookie"
  | "custom";

/** End-user consent decision. Withdrawal/re-consent are appended as new rows. */
export type ConsentDecision = "accepted" | "declined" | "withdrawn";

/** How a consent was collected (evidence). */
export type ConsentMethod = "checkbox_clickwrap" | "api" | "import" | "sso";

/** Public support-board categories. */
export type SupportCategory = "site-inquiry" | "partnership" | "bug";

/** Public support-board statuses. */
export type SupportStatus = "open" | "in-review" | "resolved";

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
// Public read DTOs
// ---------------------------------------------------------------------------

/**
 * Currently-published policy version served to the SDK (API-key path).
 * `reconsentRequired` is only present when `subjectRef` is supplied.
 */
export interface PublicPolicy {
  policySlug: string;
  name: string;
  type: PolicyType;
  locale: string;
  versionId: string;
  versionLabel: string;
  contentHash: string;
  body: string;
  effectiveAt: string | null;
  publishedAt: string | null;
  changeSummary: string | null;
  /** Org logo for embed/hosted headers (monogram fallback when absent). */
  orgLogoUrl?: string | null;
  /** True when the subject has not yet accepted the current content hash. */
  reconsentRequired?: boolean;
}

/**
 * Fully-public rendered policy document — for hosted pages, iframes, embeds.
 * Supports `version`/locale selection and `{{var}}` template substitution.
 */
export interface PublicRender {
  orgName: string;
  /** Org logo for the public page header (monogram fallback when absent). */
  orgLogoUrl?: string | null;
  policySlug: string;
  name: string;
  type: PolicyType;
  locale: string;
  versionId: string;
  versionLabel: string;
  contentHash: string;
  /** Display body with template vars substituted (source hash stays immutable). */
  body: string;
  effectiveAt: string | null;
  publishedAt: string | null;
  changeSummary: string | null;
  /** Selectable (previously published) version labels, newest first. */
  availableVersions: string[];
  /** Template var keys left unresolved (no value supplied). */
  unresolvedVars: string[];
}

/**
 * Public tamper-check result. Re-hashes the stored published body to prove
 * (a) it matches the frozen publish-time hash and (b) a presented hash is real.
 */
export interface PublicVerify {
  verified: boolean;
  orgName: string;
  policySlug: string;
  versionLabel: string | null;
  /** Frozen publish-time hash of the matched/current version. */
  contentHash: string | null;
  /** Hash recomputed now from the stored body (= contentHash when intact). */
  recomputedHash: string;
  effectiveAt: string | null;
  publishedAt: string | null;
  /** Reason when verified=false. */
  reason?: string;
}

/** Receipt returned after recording a consent (no PII echoed back). */
export interface ConsentReceiptCreated {
  receiptId: string;
  policySlug: string;
  versionLabel: string;
  contentHash: string;
  decision: ConsentDecision;
  createdAt: string;
}

/** A public support-board post (contact details stripped from public output). */
export interface SupportPost {
  id: string;
  projectSlug: string;
  category: SupportCategory;
  status: SupportStatus;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

/** Public support-board listing. */
export interface SupportPostList {
  items: SupportPost[];
}

/** Minimal receipt returned to an inquiry submitter (body/contact never echoed). */
export interface InquiryReceipt {
  id: string;
  siteSlug: string;
  category: InquiryCategory;
  status: InquiryStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Public input / param types
// ---------------------------------------------------------------------------

/** Optional consent evidence captured by the widget. Open-ended (passthrough). */
export interface ConsentEvidence {
  ip?: string;
  userAgent?: string;
  referrer?: string;
  buttonLabel?: string;
  widgetVersion?: string;
  /** Hash of the body the client actually saw — server cross-checks for tampering. */
  renderedHashEcho?: string;
  [key: string]: unknown;
}

/** Payload for {@link TermsClient.recordConsent} (POST /api/v1/consents). */
export interface RecordConsentInput {
  /** Opaque end-user identifier. Never send raw PII — the customer keeps it. */
  subjectRef: string;
  policySlug: string;
  /** Defaults to 'accepted' server-side. */
  decision?: ConsentDecision;
  /** Defaults to 'checkbox_clickwrap' server-side. */
  method?: ConsentMethod;
  /** Defaults to 'ko' server-side. */
  locale?: string;
  /** Hash of the version consented to; server fills from current when omitted. */
  contentHash?: string;
  evidence?: ConsentEvidence;
}

/** Params for {@link TermsClient.getCurrent} (GET /api/v1/policies/:slug/current). */
export interface GetCurrentParams {
  /** Policy slug (path). */
  slug: string;
  /** Optional locale hint. */
  locale?: string;
  /** When supplied, the response includes `reconsentRequired`. */
  subjectRef?: string;
  signal?: AbortSignal;
}

/** Rendering options shared by the fully-public render/text/html routes. */
export interface RenderParams {
  /** Org slug (path). Self-hosted single-org may pass `_`. */
  orgSlug: string;
  /** Policy slug (path). */
  slug: string;
  /** Specific version label; omit for the current published version. */
  version?: string;
  /** Locale to render. */
  locale?: string;
  /** Template `{{var}}` substitutions (non-reserved query keys). */
  vars?: Record<string, string>;
  signal?: AbortSignal;
}

/** Standalone-document render options (theme/typography) for the HTML route. */
export interface RenderHtmlParams extends RenderParams {
  theme?: "auto" | "light" | "dark";
  accent?: string;
  font?: string;
  align?: string;
  width?: string;
}

/** Params for {@link TermsClient.verify} (GET …/verify). */
export interface VerifyParams {
  orgSlug: string;
  slug: string;
  /** Hash to verify; omit to verify the current/version body integrity. */
  hash?: string;
  /** Specific version label to verify. */
  version?: string;
  signal?: AbortSignal;
}

/** Payload for {@link TermsClient.submitInquiry} (POST /api/public/:siteSlug/inquiries). */
export interface SubmitInquiryInput {
  category: InquiryCategory;
  title: string;
  body: string;
  /** Reply-to email (optional). */
  contactEmail?: string | null;
  /** Page the inquiry came from (optional; server backfills from Origin). */
  originUrl?: string | null;
  /** Honeypot — leave empty; a filled value is silently discarded server-side. */
  website?: string | null;
}

/** Params for {@link TermsClient.listSupportPosts} (GET …/support/:projectSlug/posts). */
export interface ListSupportPostsParams {
  projectSlug: string;
  category?: SupportCategory;
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Payload for {@link TermsClient.createSupportPost}
 * (POST /api/public/support/:projectSlug/posts). `projectSlug` is the path param.
 */
export interface CreateSupportPostInput {
  category: SupportCategory;
  name: string;
  /** How to reach the author (email/handle/etc). */
  contact: string;
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createTermsClient}. Browser-safe (publishable key only). */
export interface TermsClientOptions {
  /** Base URL of the Terms Desk (e.g. 'https://termsdesk.example.com'). */
  endpoint: string;
  /** Publishable API key. Optional — fully-public render/intake routes work without it. */
  publishableKey?: string;
}

/** The public Terms Desk client surface. */
export interface TermsClient {
  /** Current published version + content hash (GET /api/v1/policies/:slug/current). */
  getCurrent(params: GetCurrentParams): Promise<PublicPolicy>;
  /** Record a consent receipt, append-only (POST /api/v1/consents). */
  recordConsent(
    input: RecordConsentInput,
    opts?: { signal?: AbortSignal },
  ): Promise<ConsentReceiptCreated>;
  /** Rendered public document as JSON (GET /api/public/:orgSlug/policies/:slug). */
  getDocument(params: RenderParams): Promise<PublicRender>;
  /** Rendered public document as standalone HTML (…/html). Returns the HTML string. */
  getDocumentHtml(params: RenderHtmlParams): Promise<string>;
  /** Rendered public document as text/plain (…/text). Returns the text string. */
  getDocumentText(params: RenderParams): Promise<string>;
  /** Tamper-check a content hash / body integrity (…/verify). */
  verify(params: VerifyParams): Promise<PublicVerify>;
  /** Submit a private inquiry, body/contact never echoed (POST /api/public/:siteSlug/inquiries). */
  submitInquiry(
    siteSlug: string,
    input: SubmitInquiryInput,
    opts?: { signal?: AbortSignal },
  ): Promise<InquiryReceipt>;
  /** Public support-board listing (GET /api/public/support/:projectSlug/posts). */
  listSupportPosts(params: ListSupportPostsParams): Promise<SupportPostList>;
  /** Create a public support post (POST /api/public/support/:projectSlug/posts). */
  createSupportPost(
    projectSlug: string,
    input: CreateSupportPostInput,
    opts?: { signal?: AbortSignal },
  ): Promise<SupportPost>;
}

/**
 * Create a browser-safe Terms Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const terms = createTermsClient({ endpoint, publishableKey })
 *   const policy = await terms.getCurrent({ slug: 'privacy', subjectRef: 'user_42' })
 *   if (policy.reconsentRequired) {
 *     await terms.recordConsent({ subjectRef: 'user_42', policySlug: 'privacy' })
 *   }
 */
export function createTermsClient(opts: TermsClientOptions): TermsClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    getCurrent: (params) =>
      t.get<PublicPolicy>(
        `/api/v1/policies/${encodeURIComponent(params.slug)}/current`,
        {
          query: { locale: params.locale, subjectRef: params.subjectRef },
          signal: params.signal,
        },
      ),
    recordConsent: (input, reqOpts) =>
      t.post<ConsentReceiptCreated>("/api/v1/consents", {
        body: input,
        signal: reqOpts?.signal,
      }),
    getDocument: (params) =>
      t.get<PublicRender>(
        `/api/public/${encodeURIComponent(params.orgSlug)}/policies/${encodeURIComponent(
          params.slug,
        )}`,
        {
          query: {
            version: params.version,
            locale: params.locale,
            ...params.vars,
          },
          signal: params.signal,
        },
      ),
    getDocumentHtml: (params) =>
      t.get<string>(
        `/api/public/${encodeURIComponent(params.orgSlug)}/policies/${encodeURIComponent(
          params.slug,
        )}/html`,
        {
          query: {
            version: params.version,
            locale: params.locale,
            theme: params.theme,
            accent: params.accent,
            font: params.font,
            align: params.align,
            width: params.width,
            ...params.vars,
          },
          headers: { accept: "text/html" },
          signal: params.signal,
        },
      ),
    getDocumentText: (params) =>
      t.get<string>(
        `/api/public/${encodeURIComponent(params.orgSlug)}/policies/${encodeURIComponent(
          params.slug,
        )}/text`,
        {
          query: {
            version: params.version,
            locale: params.locale,
            ...params.vars,
          },
          headers: { accept: "text/plain" },
          signal: params.signal,
        },
      ),
    verify: (params) =>
      t.get<PublicVerify>(
        `/api/public/${encodeURIComponent(params.orgSlug)}/policies/${encodeURIComponent(
          params.slug,
        )}/verify`,
        {
          query: { hash: params.hash, version: params.version },
          signal: params.signal,
        },
      ),
    submitInquiry: (siteSlug, input, reqOpts) =>
      t.post<InquiryReceipt>(
        `/api/public/${encodeURIComponent(siteSlug)}/inquiries`,
        { body: input, signal: reqOpts?.signal },
      ),
    listSupportPosts: (params) =>
      t.get<SupportPostList>(
        `/api/public/support/${encodeURIComponent(params.projectSlug)}/posts`,
        {
          query: { category: params.category, limit: params.limit },
          signal: params.signal,
        },
      ),
    createSupportPost: (projectSlug, input, reqOpts) =>
      t.post<SupportPost>(
        `/api/public/support/${encodeURIComponent(projectSlug)}/posts`,
        { body: input, signal: reqOpts?.signal },
      ),
  };
}
