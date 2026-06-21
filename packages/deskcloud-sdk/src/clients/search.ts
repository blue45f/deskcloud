/**
 * @heejun/deskcloud — SearchDesk BROWSER client (publishable `pk_`).
 *
 * SearchDesk is a hosted, multi-tenant Search-as-a-Service. This browser client
 * covers the public surface a browser needs:
 *   - full-text search with ranking + highlight + facets (PublishableKeyGuard, `pk_`)
 *   - tenant self-signup (open onboarding endpoint, no key required)
 *
 * SECURITY: browser-safe. Uses ONLY the publishable key (`pk_…`). NEVER reference
 * a secret key here — admin/index operations live in '../server/search.js'.
 *
 * Types below are duplicated from the SearchDesk `packages/shared` contract so the
 * SDK is self-contained (zero dependency on the Desk repo).
 */

import { createDeskTransport } from "../core/http.js";

// ── Domain types (mirrored from @searchdesk/shared) ──────────────────────────

/** Tenant plan — `free` has a soft document cap, `pro` is unlimited. */
export type SearchPlan = "free" | "pro";

/** A single facet count (e.g. one category or one tag with its frequency). */
export interface SearchFacetCount {
  value: string;
  count: number;
}

/** Facet buckets returned alongside search hits (category single, tags multi). */
export interface SearchFacets {
  category: SearchFacetCount[];
  tags: SearchFacetCount[];
}

/** A single ranked search result, with highlight markup. */
export interface SearchHit {
  id: string;
  index: string;
  title: string;
  /** Title with match highlights applied (`<mark>`). */
  titleHighlight: string;
  url: string | null;
  category: string | null;
  tags: string[];
  attrs: Record<string, unknown> | null;
  /** Body highlight snippet (`<mark>`), or null when there's no body match. */
  snippet: string | null;
  /** Non-negative ranking score. */
  score: number;
}

/** Full search response — hits + facets + meta. */
export interface SearchResponse {
  query: string;
  index: string;
  /** Total matches after filters (before `limit` is applied). */
  total: number;
  hits: SearchHit[];
  /** Facet counts over the filtered candidate set. */
  facets: SearchFacets;
  limit: number;
  /** Which engine path served the query (debug/verification). */
  engine: "postgres" | "fallback";
}

/** Parameters for {@link SearchClient.search}. */
export interface SearchParams {
  /** Search terms. Empty/omitted yields no hits (facets only). */
  q?: string;
  /** Target index (defaults to `default` server-side). */
  index?: string;
  /** Single category filter. */
  category?: string;
  /**
   * Tag AND-filter. Pass an array (joined as CSV) or a pre-joined CSV string.
   * All listed tags must be present on a document.
   */
  tags?: string[] | string;
  /** Result count (server clamps to its max limit). */
  limit?: number;
}

/** Tenant self-signup input (open onboarding endpoint). */
export interface SearchSignupInput {
  /** Display name (required). */
  name: string;
  /** Optional external slug; server derives one from `name` if omitted. */
  slug?: string;
  /** Origins allowed to call publishable (search) routes. Defaults to `['*']`. */
  corsOrigins?: string[];
  /** Plan at signup (defaults to `free`). */
  plan?: SearchPlan;
}

/**
 * Tenant credentials returned ONLY at signup/rotate — the plaintext secret key
 * is exposed exactly once here (stored hashed thereafter).
 */
export interface SearchTenantCredentials {
  id: string;
  name: string;
  slug: string;
  plan: SearchPlan;
  publishableKey: string;
  /** Plaintext secret key — surfaced only in this signup/rotate response. */
  secretKey: string;
  corsOrigins: string[];
  createdAt: string;
}

/** Options accepted by {@link createSearchClient}. */
export interface SearchClientOptions {
  endpoint: string;
  publishableKey?: string;
}

/** The SearchDesk browser client surface. */
export interface SearchClient {
  /** Full-text search — ranked hits + highlights + facets (`GET /api/search`). */
  search: (params?: SearchParams) => Promise<SearchResponse>;
  /**
   * Tenant self-signup — issues a `pk_`/`sk_` key pair (`POST /api/tenants`).
   * Open onboarding endpoint (no key required); the plaintext secret is returned once.
   */
  signup: (input: SearchSignupInput) => Promise<SearchTenantCredentials>;
}

function normalizeTags(tags: SearchParams["tags"]): string | undefined {
  if (tags === undefined) return undefined;
  return Array.isArray(tags) ? tags.join(",") : tags;
}

/**
 * Create a SearchDesk browser client bound to one endpoint + publishable key.
 *
 * @example
 *   const search = createSearchClient({ endpoint, publishableKey: 'pk_…' })
 *   const res = await search.search({ q: 'invoice', category: 'docs', limit: 10 })
 */
export function createSearchClient(opts: SearchClientOptions): SearchClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    search: (params = {}) =>
      t.get<SearchResponse>("/api/search", {
        query: {
          q: params.q,
          index: params.index,
          category: params.category,
          tags: normalizeTags(params.tags),
          limit: params.limit,
        },
      }),

    signup: (input) =>
      t.post<SearchTenantCredentials>("/api/tenants", { body: input }),
  };
}
