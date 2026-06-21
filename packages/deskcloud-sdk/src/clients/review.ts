/**
 * @heejun/deskcloud — Review Desk BROWSER client (publishable `pk_` surface).
 *
 * Mirrors ReviewDesk's public, PublishableKeyGuard-protected REST routes
 * (global prefix `/api`). Covers the read/display + public-submit surface a
 * browser widget needs:
 *   - POST   /api/reviews            submit a review              → ReviewReceipt
 *   - GET    /api/reviews            approved reviews + aggregate → PublicReviews
 *   - GET    /api/reviews/wall       featured/approved wall       → ReviewWall
 *   - GET    /api/reviews/aggregate  rating summary (badge)       → ReviewAggregate
 *
 * Auth is handled by the transport: the publishable key is sent as the `x-pk`
 * header AND the `?pk=` query param. NEVER reference a secret key here — admin
 * operations live in '@heejun/deskcloud/server' (createReviewAdminClient).
 *
 * Domain types are duplicated here (derived from ReviewDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @reviewdesk/shared — public surface only)
// ---------------------------------------------------------------------------

/** Review moderation lifecycle. */
export type ReviewStatus = "pending" | "approved" | "rejected";

/** Optional widget-supplied context attached to a submission. */
export interface ReviewMeta {
  pageUrl?: string;
  userAgent?: string;
  referrer?: string;
}

/** Rating-distribution + satisfaction summary for a subject (or whole tenant). */
export interface ReviewAggregate {
  /** Number of reviews counted (valid integer ratings only). */
  count: number;
  /** Mean rating rounded to 2 decimals; null when the sample is empty. */
  avgRating: number | null;
  /** Per-star counts, keyed `'1'..'5'`. */
  distribution: Record<string, number>;
  /** NPS-style score (promoters% − detractors%), −100..100; null when empty. */
  satisfaction: number | null;
}

/** A review as exposed to the public widget (private fields stripped). */
export interface PublicReview {
  id: string;
  subjectId: string;
  subjectLabel: string | null;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  featured: boolean;
  /** Operator reply, if any. */
  reply: string | null;
  createdAt: string;
}

/** Public review list + aggregate for one subject. */
export interface PublicReviews {
  subjectId: string;
  items: PublicReview[];
  aggregate: ReviewAggregate;
}

/** Testimonials wall — approved + featured reviews. */
export interface ReviewWall {
  items: PublicReview[];
}

/** Receipt returned to the submitter (minimal, no moderation fields). */
export interface ReviewReceipt {
  id: string;
  subjectId: string;
  status: ReviewStatus;
  createdAt: string;
}

/**
 * Public review submission payload. Server-controlled fields
 * (status/featured/reply) are intentionally absent — they cannot be set here.
 */
export interface ReviewSubmission {
  subjectId: string;
  subjectLabel?: string | null;
  rating: number;
  title?: string | null;
  body: string;
  authorName: string;
  /** Private — surfaced only to admins. */
  authorEmail?: string;
  source?: string;
  meta?: ReviewMeta;
}

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

/** Params for {@link ReviewClient.getWall}. */
export interface GetWallParams {
  /** Max items to return. */
  limit?: number;
  /** Optional cancellation signal. */
  signal?: AbortSignal;
}

/** Params for {@link ReviewClient.list}. */
export interface ListReviewsParams {
  /** Subject (product/page/entity) identifier. */
  subjectId: string;
  /** Max items to return. */
  limit?: number;
  signal?: AbortSignal;
}

/** Params for {@link ReviewClient.getAggregate}. */
export interface GetAggregateParams {
  subjectId: string;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createReviewClient}. Browser-safe (publishable key only). */
export interface ReviewClientOptions {
  /** Base URL of the Review Desk (e.g. 'https://reviewdesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Review Desk client surface. */
export interface ReviewClient {
  /** Submit a review (POST /api/reviews). Returns the submission receipt. */
  submit(
    input: ReviewSubmission,
    opts?: { signal?: AbortSignal },
  ): Promise<ReviewReceipt>;
  /** Approved reviews + aggregate for a subject (GET /api/reviews). */
  list(params: ListReviewsParams): Promise<PublicReviews>;
  /** Testimonials wall — approved + featured reviews (GET /api/reviews/wall). */
  getWall(params?: GetWallParams): Promise<ReviewWall>;
  /** Rating summary for a subject, for a badge (GET /api/reviews/aggregate). */
  getAggregate(params: GetAggregateParams): Promise<ReviewAggregate>;
}

/**
 * Create a browser-safe Review Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const reviews = createReviewClient({ endpoint, publishableKey })
 *   const { items, aggregate } = await reviews.list({ subjectId: 'pro-plan', limit: 20 })
 */
export function createReviewClient(opts: ReviewClientOptions): ReviewClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    submit: (input, reqOpts) =>
      t.post<ReviewReceipt>("/api/reviews", {
        body: input,
        signal: reqOpts?.signal,
      }),
    list: (params) =>
      t.get<PublicReviews>("/api/reviews", {
        query: { subjectId: params.subjectId, limit: params.limit },
        signal: params.signal,
      }),
    getWall: (params) =>
      t.get<ReviewWall>("/api/reviews/wall", {
        query: { limit: params?.limit },
        signal: params?.signal,
      }),
    getAggregate: (params) =>
      t.get<ReviewAggregate>("/api/reviews/aggregate", {
        query: { subjectId: params.subjectId },
        signal: params.signal,
      }),
  };
}
