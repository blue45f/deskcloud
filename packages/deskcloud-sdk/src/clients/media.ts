/**
 * @heejun/deskcloud — Media Desk BROWSER client (publishable `pk_` surface).
 *
 * Mirrors MediaDesk's public, PublishableKeyGuard-protected REST routes
 * (global prefix `/api`). MediaDesk is a tenant-scoped asset host: upload files,
 * list/browse them, and serve them (with on-the-fly image transforms). This
 * client covers the read/display + public-upload surface a browser widget needs:
 *   - POST /api/uploads            upload a file (multipart) → AssetDto
 *   - GET  /api/assets             list assets (folder/page) → AssetListDto
 *   - GET  /file/:slug/<key...>    public file URL (no auth) → built locally
 *
 * Auth is handled by the transport: the publishable key is sent as the `x-pk`
 * header AND the `?pk=` query param. NEVER reference a secret key here — admin
 * operations live in '@heejun/deskcloud/server' (createMediaAdminClient).
 *
 * Domain types are duplicated here (derived from MediaDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport, DeskError } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @mediadesk/shared — public surface only)
// ---------------------------------------------------------------------------

/** On-the-fly transform output format (the `format` query param). */
export type MediaTransformFormat = "jpeg" | "png" | "webp" | "avif";

/**
 * A public asset (upload result / gallery item). Mirrors @mediadesk/shared's
 * AssetDto.
 */
export interface MediaAsset {
  /** Tenant-relative storage key, e.g. 'avatars/ab12-photo.png'. */
  key: string;
  /** Ready-to-use public URL (the original). */
  url: string;
  /** MIME type, e.g. 'image/png'. */
  contentType: string;
  /** Byte size. */
  size: number;
  /** Logical folder (null at the root). */
  folder: string | null;
  /** Whether this is a raster image that can be transformed on the fly. */
  transformable: boolean;
  /** Pixel dimensions (for images, when known). */
  width?: number | null;
  height?: number | null;
  /** ISO creation timestamp. */
  createdAt: string;
}

/** Paginated asset list (folder filter + pagination). Mirrors AssetListDto. */
export interface MediaAssetList {
  items: MediaAsset[];
  /** Total count for the same filter. */
  total: number;
  offset: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/**
 * Upload payload. The file is sent as multipart `file`; `folder` is an optional
 * logical group. A browser typically passes a `File`/`Blob`; Node/SSR callers
 * can pass any Blob-like value plus an explicit `filename`.
 */
export interface MediaUploadInput {
  /** The file to upload (browser `File`/`Blob`, or any Blob-like value). */
  file: Blob;
  /** Filename to record (defaults to `file.name` when the file is a `File`). */
  filename?: string;
  /** Optional logical folder (e.g. 'avatars'). */
  folder?: string;
}

/** Params for {@link MediaClient.listAssets}. */
export interface ListMediaAssetsParams {
  /** Restrict to one logical folder. */
  folder?: string;
  /** Max items to return (server clamps to 1..200). */
  limit?: number;
  /** Pagination offset. */
  offset?: number;
  signal?: AbortSignal;
}

/** On-the-fly image transform options for {@link MediaClient.transformUrl}. */
export interface MediaTransformParams {
  /** Target width in px. */
  w?: number;
  /** Target height in px. */
  h?: number;
  /** Output format. */
  format?: MediaTransformFormat;
  /** Output quality (1..100). */
  q?: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createMediaClient}. Browser-safe (publishable key only). */
export interface MediaClientOptions {
  /** Base URL of the Media Desk (e.g. 'https://mediadesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Media Desk client surface. */
export interface MediaClient {
  /** Upload a file (POST /api/uploads, multipart). Returns the asset metadata. */
  upload(
    input: MediaUploadInput,
    opts?: { signal?: AbortSignal },
  ): Promise<MediaAsset>;
  /** List assets — folder filter + pagination (GET /api/assets). */
  listAssets(params?: ListMediaAssetsParams): Promise<MediaAssetList>;
  /**
   * Build a transformed-image URL from an asset's public `url`
   * (appends ?w=&h=&format=&q=). Pure/local — no request is made. Returns the
   * original URL unchanged when no transform params are given.
   */
  transformUrl(assetUrl: string, params?: MediaTransformParams): string;
}

/**
 * Create a browser-safe Media Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const media = createMediaClient({ endpoint, publishableKey })
 *   const asset = await media.upload({ file, folder: 'avatars' })
 *   const thumb = media.transformUrl(asset.url, { w: 128, h: 128, format: 'webp' })
 */
export function createMediaClient(opts: MediaClientOptions): MediaClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });
  // `t.endpoint` is the resolved (trailing-slash-trimmed) base — reuse it so the
  // multipart upload below hits exactly the same Desk as the JSON reads.
  const endpoint = t.endpoint;

  return {
    upload: async (input, reqOpts) => {
      // The shared JSON transport JSON.stringify's every body, which can't carry
      // a multipart file. So the one multipart route (POST /api/uploads) is sent
      // via a direct fetch that still mirrors the transport's auth (x-pk header
      // AND ?pk= query) and its DeskError-on-non-2xx contract.
      const form = new FormData();
      const filename =
        input.filename ??
        (input.file instanceof File ? input.file.name : undefined);
      // Append with filename when known so the server records a sensible name.
      if (filename !== undefined) form.append("file", input.file, filename);
      else form.append("file", input.file);
      if (input.folder !== undefined) form.append("folder", input.folder);

      const doFetch = globalThis.fetch;
      if (!doFetch) {
        throw new DeskError(
          "fetch is not available in this environment.",
          0,
          "no_fetch",
        );
      }
      const headers: Record<string, string> = {
        accept: "application/json",
        "x-deskcloud-sdk": "0.1.0",
      };
      // Do NOT set content-type — the runtime adds the multipart boundary.
      if (opts.publishableKey) headers["x-pk"] = opts.publishableKey;
      const query = opts.publishableKey
        ? `?pk=${encodeURIComponent(opts.publishableKey)}`
        : "";
      const url = `${endpoint}/api/uploads${query}`;

      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers,
          body: form,
          signal: reqOpts?.signal,
        });
      } catch (err) {
        throw new DeskError(
          err instanceof Error ? err.message : "Network request failed",
          0,
          "network_error",
          err,
        );
      }

      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
      }
      if (!res.ok) {
        const body = (json ?? {}) as Record<string, unknown>;
        const rawMsg =
          body.message ?? body.error ?? `Desk request failed (${res.status})`;
        const message = Array.isArray(rawMsg)
          ? rawMsg.join(", ")
          : String(rawMsg);
        const code =
          typeof body.code === "string"
            ? body.code
            : typeof body.error === "string"
              ? body.error
              : undefined;
        throw new DeskError(message, res.status, code, json);
      }
      return json as MediaAsset;
    },
    listAssets: (params) =>
      t.get<MediaAssetList>("/api/assets", {
        query: {
          folder: params?.folder,
          limit: params?.limit,
          offset: params?.offset,
        },
        signal: params?.signal,
      }),
    transformUrl: (assetUrl, params) => {
      if (!params) return assetUrl;
      const q = new URLSearchParams();
      if (params.w !== undefined) q.set("w", String(params.w));
      if (params.h !== undefined) q.set("h", String(params.h));
      if (params.format !== undefined) q.set("format", params.format);
      if (params.q !== undefined) q.set("q", String(params.q));
      const qs = q.toString();
      if (!qs) return assetUrl;
      return assetUrl.includes("?") ? `${assetUrl}&${qs}` : `${assetUrl}?${qs}`;
    },
  };
}
