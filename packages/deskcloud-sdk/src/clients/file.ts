/**
 * @heejun/deskcloud — FileDesk BROWSER client (publishable `pk_` surface).
 *
 * FileDesk is a hosted, multi-tenant file upload / storage service. This browser
 * client mirrors FileDesk's public REST routes (global prefix `/api`) — the
 * upload + display surface a browser widget needs:
 *   - POST /api/tenants    tenant self-signup (open onboarding, no key) → FileTenantCredentials
 *   - POST /api/files      upload a file (base64 JSON, pk_ + Origin)    → UploadResult
 *   - GET  /api/files/:key serve a file (public direct; private→token)  → bytes
 *
 * The serving route returns raw bytes (not JSON), so this client exposes
 * `getFileUrl(key)` to build the absolute serving URL (no network) plus
 * `fetchFile(key)` to retrieve the bytes as a Blob (browser-native).
 *
 * Auth is handled by the transport: the publishable key is sent as the `x-pk`
 * header AND the `?pk=` query param. NEVER reference a secret key here — admin
 * operations live in '@heejun/deskcloud/server' (createFileAdminClient).
 *
 * Domain types are duplicated here (derived from FileDesk's packages/shared)
 * so the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @filedesk/shared — public surface only)
// ---------------------------------------------------------------------------

/** File visibility — `public` (anyone via URL) · `private` (sk_ or signed token). */
export type FileVisibility = "public" | "private";

/** Tenant billing plan. `free` has a soft file-count cap; `pro` is unlimited. */
export type FilePlan = "free" | "pro";

/**
 * Result returned to the uploader (minimal shape the widget/SDK consumes).
 * `url` is the serving URL — public files resolve directly; private files
 * require a signed token (`?token=`) issued server-side.
 */
export interface UploadResult {
  id: string;
  /** Opaque content key — the serving URL path (`/api/files/:key`). */
  key: string;
  /** Serving URL (absolute or relative). */
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  visibility: FileVisibility;
}

/**
 * Tenant credentials returned ONLY at signup/rotate — the plaintext secret key
 * is exposed exactly once here (stored hashed thereafter).
 */
export interface FileTenantCredentials {
  id: string;
  name: string;
  slug: string;
  plan: FilePlan;
  publishableKey: string;
  /** Plaintext secret key — surfaced only in this signup/rotate response. */
  secretKey: string;
  corsOrigins: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/**
 * Base64 JSON upload payload (the browser-friendly upload path). `dataBase64`
 * accepts a standard/URL-safe base64 string OR a `data:` URL (the server strips
 * the `data:…,` prefix). For raw multipart uploads use a `<form>`/`FormData`
 * POST to {@link FileClient.getUploadUrl} instead.
 */
export interface FileUploadInput {
  /** File name — no path separators (1..255 chars). */
  filename: string;
  /** MIME content type (e.g. `image/png`). */
  contentType: string;
  /** Base64-encoded bytes; a `data:` URL prefix is allowed. */
  dataBase64: string;
  /** Visibility (defaults to `public` server-side). */
  visibility?: FileVisibility;
}

/** Tenant self-signup input (open onboarding endpoint, no key required). */
export interface FileSignupInput {
  /** Display name (required). */
  name: string;
  /** Optional external slug; server derives one from `name` if omitted. */
  slug?: string;
  /** Origins allowed to call publishable (upload) routes. Defaults to `['*']`. */
  corsOrigins?: string[];
  /** Plan at signup (defaults to `free`). */
  plan?: FilePlan;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createFileClient}. Browser-safe (publishable key only). */
export interface FileClientOptions {
  /** Base URL of the File Desk (e.g. 'https://filedesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public FileDesk client surface. */
export interface FileClient {
  /**
   * Upload a file via the base64 JSON path (POST /api/files).
   * Requires a publishable key + an allowed Origin server-side.
   */
  upload(
    input: FileUploadInput,
    opts?: { signal?: AbortSignal },
  ): Promise<UploadResult>;
  /**
   * Build the absolute serving URL for a content key (no network call).
   * For private files, append the signed `?token=` issued via the admin client.
   */
  getFileUrl(key: string): string;
  /**
   * Endpoint-relative path of the upload route — useful for raw multipart
   * `FormData` POSTs (the `file` field) that bypass the JSON transport.
   */
  getUploadUrl(): string;
  /**
   * Fetch a file's bytes as a Blob (GET /api/files/:key). Public files resolve
   * directly; private files need a signed `token`. Browser/`fetch`-native.
   */
  fetchFile(
    key: string,
    opts?: { token?: string; signal?: AbortSignal },
  ): Promise<Blob>;
  /**
   * Tenant self-signup — issues a `pk_`/`sk_` key pair (POST /api/tenants).
   * Open onboarding endpoint (no key required); the plaintext secret is returned once.
   */
  signup(
    input: FileSignupInput,
    opts?: { signal?: AbortSignal },
  ): Promise<FileTenantCredentials>;
}

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Create a browser-safe FileDesk client bound to one endpoint + publishable key.
 *
 * @example
 *   const files = createFileClient({ endpoint, publishableKey: 'pk_…' })
 *   const res = await files.upload({ filename: 'a.png', contentType: 'image/png', dataBase64 })
 *   img.src = res.url // public file resolves directly
 */
export function createFileClient(opts: FileClientOptions): FileClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });
  const base = trimTrailingSlash(opts.endpoint);

  return {
    upload: (input, reqOpts) =>
      t.post<UploadResult>("/api/files", {
        body: input,
        signal: reqOpts?.signal,
      }),

    getFileUrl: (key) => `${base}/api/files/${encodeURIComponent(key)}`,

    getUploadUrl: () => "/api/files",

    fetchFile: async (key, reqOpts) => {
      const url = `${base}/api/files/${encodeURIComponent(key)}`;
      const query = new URLSearchParams();
      if (opts.publishableKey) query.set("pk", opts.publishableKey);
      if (reqOpts?.token) query.set("token", reqOpts.token);
      const qs = query.toString();
      const headers: Record<string, string> = { accept: "*/*" };
      if (opts.publishableKey) headers["x-pk"] = opts.publishableKey;
      const res = await fetch(`${url}${qs ? `?${qs}` : ""}`, {
        method: "GET",
        headers,
        signal: reqOpts?.signal,
      });
      if (!res.ok) {
        throw new Error(`FileDesk serve failed (${res.status}) for key ${key}`);
      }
      return res.blob();
    },

    signup: (input, reqOpts) =>
      t.post<FileTenantCredentials>("/api/tenants", {
        body: input,
        signal: reqOpts?.signal,
      }),
  };
}
