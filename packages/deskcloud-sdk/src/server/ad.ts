/**
 * @heejun/deskcloud/server — Ad Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors AdDesk's admin, SecretKeyGuard-protected REST routes
 * (global prefix `/api`, controller `ads`). Covers campaign/creative/slot
 * CRUD plus stats:
 *   - GET    /api/ads/stats           per-campaign impressions/clicks/CTR + totals
 *   - GET    /api/ads/campaigns       list campaigns
 *   - POST   /api/ads/campaigns       create a campaign
 *   - GET    /api/ads/campaigns/:id   get one campaign
 *   - PUT    /api/ads/campaigns/:id   update a campaign
 *   - DELETE /api/ads/campaigns/:id   delete a campaign (+ its creatives)
 *   - GET    /api/ads/creatives       list creatives (campaignId/slot filters)
 *   - POST   /api/ads/creatives       create a creative
 *   - GET    /api/ads/creatives/:id   get one creative
 *   - PUT    /api/ads/creatives/:id   update a creative
 *   - DELETE /api/ads/creatives/:id   delete a creative
 *   - GET    /api/ads/slots           list slots
 *   - POST   /api/ads/slots           create a slot
 *   - PUT    /api/ads/slots/:id       update a slot
 *   - DELETE /api/ads/slots/:id       delete a slot
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header.
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from AdDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @addesk/shared — admin surface)
// ---------------------------------------------------------------------------

/** Campaign status — active (servable) | paused (excluded from serving). */
export type CampaignStatus = "active" | "paused";

/** Admin campaign representation. */
export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Admin creative representation (all fields). */
export interface Creative {
  id: string;
  tenantId: string;
  campaignId: string;
  slotKey: string;
  imageUrl: string;
  linkUrl: string;
  alt: string;
  weight: number;
  /** Cumulative impressions/clicks for this creative. */
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

/** Admin slot representation. */
export interface Slot {
  id: string;
  tenantId: string;
  key: string;
  label: string | null;
  sizes: string[];
  createdAt: string;
  updatedAt: string;
}

/** Per-campaign stat row (CTR included). */
export interface CampaignStat {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  /** clicks / impressions * 100 (2 decimals); 0 when impressions are 0. */
  ctr: number;
}

/** Aggregate totals + CTR. */
export interface StatsTotals {
  impressions: number;
  clicks: number;
  ctr: number;
}

/** Stats response — per-campaign rows + totals. */
export interface Stats {
  campaigns: CampaignStat[];
  totals: StatsTotals;
}

/** Delete acknowledgement returned by the DELETE routes. */
export interface DeleteResult {
  deleted: boolean;
  id: string;
}

// ---------------------------------------------------------------------------
// Input / param types (mirrored from @addesk/shared zod schemas)
// ---------------------------------------------------------------------------

/** Create a campaign (POST /api/ads/campaigns). */
export interface CreateCampaignInput {
  name: string;
  /** Defaults to 'active' server-side when omitted. */
  status?: CampaignStatus;
  /** Serving start (ISO 8601). Omit/null for immediate start. */
  startsAt?: string | null;
  /** Serving end (ISO 8601). Omit/null for no end. */
  endsAt?: string | null;
}

/** Update a campaign (PUT /api/ads/campaigns/:id). At least one field required. */
export interface UpdateCampaignInput {
  name?: string;
  status?: CampaignStatus;
  startsAt?: string | null;
  endsAt?: string | null;
}

/** Create a creative (POST /api/ads/creatives). */
export interface CreateCreativeInput {
  campaignId: string;
  /** Slot key (placement) this creative serves into. */
  slotKey: string;
  imageUrl: string;
  linkUrl: string;
  alt: string;
  /** Relative weight for weighted-random selection (defaults to 1 server-side). */
  weight?: number;
}

/** Update a creative (PUT /api/ads/creatives/:id). campaignId is immutable. */
export interface UpdateCreativeInput {
  slotKey?: string;
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
  weight?: number;
}

/** Filter for {@link AdAdminClient.listCreatives} (GET /api/ads/creatives). */
export interface ListCreativesParams {
  campaignId?: string;
  /** Slot key filter (sent as the `slot` query param). */
  slotKey?: string;
  signal?: AbortSignal;
}

/** Create a slot (POST /api/ads/slots). */
export interface CreateSlotInput {
  key: string;
  label?: string | null;
  /** Banner sizes this slot accepts (e.g. ['300x250']). 1–20 entries. */
  sizes: string[];
}

/** Update a slot (PUT /api/ads/slots/:id). key is immutable. */
export interface UpdateSlotInput {
  label?: string | null;
  sizes?: string[];
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createAdAdminClient}. Server-only (secret key required). */
export interface AdAdminClientOptions {
  /** Base URL of the Ad Desk (e.g. 'https://addesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Ad Desk client surface. */
export interface AdAdminClient {
  /** Per-campaign impressions/clicks/CTR + totals (GET /api/ads/stats). */
  getStats(opts?: { signal?: AbortSignal }): Promise<Stats>;

  /* Campaigns */
  listCampaigns(opts?: { signal?: AbortSignal }): Promise<Campaign[]>;
  createCampaign(
    input: CreateCampaignInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Campaign>;
  getCampaign(id: string, opts?: { signal?: AbortSignal }): Promise<Campaign>;
  updateCampaign(
    id: string,
    input: UpdateCampaignInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Campaign>;
  deleteCampaign(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<DeleteResult>;

  /* Creatives */
  listCreatives(params?: ListCreativesParams): Promise<Creative[]>;
  createCreative(
    input: CreateCreativeInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Creative>;
  getCreative(id: string, opts?: { signal?: AbortSignal }): Promise<Creative>;
  updateCreative(
    id: string,
    input: UpdateCreativeInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Creative>;
  deleteCreative(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<DeleteResult>;

  /* Slots */
  listSlots(opts?: { signal?: AbortSignal }): Promise<Slot[]>;
  createSlot(
    input: CreateSlotInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Slot>;
  updateSlot(
    id: string,
    input: UpdateSlotInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Slot>;
  deleteSlot(
    id: string,
    opts?: { signal?: AbortSignal },
  ): Promise<DeleteResult>;
}

/**
 * Create a server-only Ad Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createAdAdminClient({ endpoint, secretKey })
 *   const campaign = await admin.createCampaign({ name: 'Spring Sale' })
 *   await admin.createCreative({
 *     campaignId: campaign.id,
 *     slotKey: 'sidebar',
 *     imageUrl: 'https://cdn.example.com/banner.png',
 *     linkUrl: 'https://example.com/sale',
 *     alt: 'Spring Sale — 30% off',
 *   })
 *   const stats = await admin.getStats()
 */
export function createAdAdminClient(opts: AdAdminClientOptions): AdAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  const enc = encodeURIComponent;

  return {
    getStats: (reqOpts) =>
      t.get<Stats>("/api/ads/stats", { signal: reqOpts?.signal }),

    /* Campaigns */
    listCampaigns: (reqOpts) =>
      t.get<Campaign[]>("/api/ads/campaigns", { signal: reqOpts?.signal }),
    createCampaign: (input, reqOpts) =>
      t.post<Campaign>("/api/ads/campaigns", {
        body: input,
        signal: reqOpts?.signal,
      }),
    getCampaign: (id, reqOpts) =>
      t.get<Campaign>(`/api/ads/campaigns/${enc(id)}`, {
        signal: reqOpts?.signal,
      }),
    updateCampaign: (id, input, reqOpts) =>
      t.put<Campaign>(`/api/ads/campaigns/${enc(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deleteCampaign: (id, reqOpts) =>
      t.del<DeleteResult>(`/api/ads/campaigns/${enc(id)}`, {
        signal: reqOpts?.signal,
      }),

    /* Creatives */
    listCreatives: (params) =>
      t.get<Creative[]>("/api/ads/creatives", {
        query: { campaignId: params?.campaignId, slot: params?.slotKey },
        signal: params?.signal,
      }),
    createCreative: (input, reqOpts) =>
      t.post<Creative>("/api/ads/creatives", {
        body: input,
        signal: reqOpts?.signal,
      }),
    getCreative: (id, reqOpts) =>
      t.get<Creative>(`/api/ads/creatives/${enc(id)}`, {
        signal: reqOpts?.signal,
      }),
    updateCreative: (id, input, reqOpts) =>
      t.put<Creative>(`/api/ads/creatives/${enc(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deleteCreative: (id, reqOpts) =>
      t.del<DeleteResult>(`/api/ads/creatives/${enc(id)}`, {
        signal: reqOpts?.signal,
      }),

    /* Slots */
    listSlots: (reqOpts) =>
      t.get<Slot[]>("/api/ads/slots", { signal: reqOpts?.signal }),
    createSlot: (input, reqOpts) =>
      t.post<Slot>("/api/ads/slots", { body: input, signal: reqOpts?.signal }),
    updateSlot: (id, input, reqOpts) =>
      t.put<Slot>(`/api/ads/slots/${enc(id)}`, {
        body: input,
        signal: reqOpts?.signal,
      }),
    deleteSlot: (id, reqOpts) =>
      t.del<DeleteResult>(`/api/ads/slots/${enc(id)}`, {
        signal: reqOpts?.signal,
      }),
  };
}
