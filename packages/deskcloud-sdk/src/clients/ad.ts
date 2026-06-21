/**
 * @heejun/deskcloud — Ad Desk BROWSER client (publishable `pk_` surface).
 *
 * Mirrors AdDesk's public, PublishableKeyGuard-protected REST routes
 * (global prefix `/api`, controller `ads`). Covers the serve/display +
 * impression/click tracking surface an in-page ad widget needs:
 *   - GET    /api/ads/serve?slot=…   weighted-random active creative → ServeResult
 *   - POST   /api/ads/impression     track an impression (+1)        → TrackReceipt
 *   - POST   /api/ads/click          track a click (+1)              → TrackReceipt
 *
 * Auth is handled by the transport: the publishable key is sent as the `x-pk`
 * header AND the `?pk=` query param. NEVER reference a secret key here — admin
 * operations (campaign/creative/slot CRUD + stats) live in
 * '@heejun/deskcloud/server' (createAdAdminClient).
 *
 * Domain types are duplicated here (derived from AdDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @addesk/shared — public widget surface only)
// ---------------------------------------------------------------------------

/**
 * Public serving response — the minimal info a widget renders.
 * When no eligible active creative exists, `served` is false (the widget
 * draws nothing).
 */
export interface ServeResult {
  served: boolean;
  creativeId: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  alt: string | null;
  /** Recommended render size (slot's first size, if any). Stabilizes layout. */
  size: string | null;
}

/** Impression/click tracking receipt. */
export interface TrackReceipt {
  ok: true;
  /** Updated cumulative value (impressions or clicks) for the creative. */
  count: number;
}

// ---------------------------------------------------------------------------
// Param types
// ---------------------------------------------------------------------------

/** Params for {@link AdClient.serve}. */
export interface ServeParams {
  /** Slot key (placement). Lowercase, digits, hyphens; 1–64 chars. */
  slot: string;
  /** Optional cancellation signal. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createAdClient}. Browser-safe (publishable key only). */
export interface AdClientOptions {
  /** Base URL of the Ad Desk (e.g. 'https://addesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Ad Desk client surface. */
export interface AdClient {
  /**
   * Pick one weighted-random active creative for a slot (GET /api/ads/serve).
   * Returns `served: false` when nothing is eligible.
   */
  serve(params: ServeParams): Promise<ServeResult>;
  /** Track an impression for a creative — impressions +1 (POST /api/ads/impression). */
  trackImpression(
    creativeId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<TrackReceipt>;
  /** Track a click for a creative — clicks +1 (POST /api/ads/click). */
  trackClick(
    creativeId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<TrackReceipt>;
}

/**
 * Create a browser-safe Ad Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const ads = createAdClient({ endpoint, publishableKey })
 *   const ad = await ads.serve({ slot: 'sidebar' })
 *   if (ad.served && ad.creativeId) {
 *     await ads.trackImpression(ad.creativeId)
 *   }
 */
export function createAdClient(opts: AdClientOptions): AdClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    serve: (params) =>
      t.get<ServeResult>("/api/ads/serve", {
        query: { slot: params.slot },
        signal: params.signal,
      }),
    trackImpression: (creativeId, reqOpts) =>
      t.post<TrackReceipt>("/api/ads/impression", {
        body: { creativeId },
        signal: reqOpts?.signal,
      }),
    trackClick: (creativeId, reqOpts) =>
      t.post<TrackReceipt>("/api/ads/click", {
        body: { creativeId },
        signal: reqOpts?.signal,
      }),
  };
}
