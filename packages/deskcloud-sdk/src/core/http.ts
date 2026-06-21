/**
 * @heejun/deskcloud — core HTTP transport (zero runtime deps).
 *
 * Every Desk client (browser `create<Key>Client` / server `create<Key>AdminClient`)
 * is built on top of `createDeskTransport`. It is a thin, typed, fetch-based wrapper
 * that knows how to:
 *   - attach the publishable key (`pk_…`) that the Desk public guards read
 *     (sent both as the `x-pk` header AND a `?pk=` query param for max compat,
 *      since Desks vary in which they accept),
 *   - serialize/parse JSON,
 *   - turn any non-2xx response into a typed `DeskError`.
 *
 * SECURITY: this module is BROWSER-SAFE. It only ever attaches a publishable
 * (`pk_…`) key — it contains no secret-key (`sk_…` / `x-sk`) code path. Admin
 * (secret-key) transport lives in `./admin.ts`, which is imported solely by the
 * server clients under `../server/*` and never enters the browser bundle.
 *
 * No third-party imports. Uses the global `fetch` (Node >=18 / all browsers),
 * overridable via `options.fetch` for SSR/testing.
 */

/** Thrown for any non-2xx response, or a transport-level failure (status 0). */
export class DeskError extends Error {
  /** HTTP status code, or 0 for transport/setup failures (no response). */
  readonly status: number;
  /** Machine-readable error code from the response body (`code`/`error`), if any. */
  readonly code?: string;
  /** Raw parsed response body (or undefined), for advanced callers. */
  readonly detail?: unknown;
  constructor(
    message: string,
    status: number,
    code?: string,
    detail?: unknown,
  ) {
    super(message);
    this.name = "DeskError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    // Restore prototype chain when compiled to ES5-ish targets.
    Object.setPrototypeOf(this, DeskError.prototype);
  }
}

/** A query-string value map. Nullish values are dropped before sending. */
export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Per-request options accepted by the transport verbs. */
export interface RequestOptions {
  /** Extra query-string params (merged after the auth `pk` param). */
  query?: QueryParams;
  /** JSON request body (ignored for GET/DEL). */
  body?: unknown;
  /** Extra headers (merged over the auth + content-type defaults). */
  headers?: Record<string, string>;
  /** AbortSignal for cancellation/timeouts. */
  signal?: AbortSignal;
}

/** Options for the standalone `request<T>` helper. */
export interface RequestInit_<T = unknown> extends RequestOptions {
  /** Absolute or endpoint-relative URL path (e.g. '/api/reviews'). */
  url: string;
  /** HTTP method. */
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Base endpoint to resolve `url` against (trailing slashes trimmed). */
  endpoint?: string;
  /** Publishable key (`pk_…`) — sent as `x-pk` header AND `?pk=` query. */
  publishableKey?: string;
  /** Custom fetch (SSR/test). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Unused type anchor so `T` participates in inference at call sites. */
  __resultType?: T;
}

/** Config for {@link createDeskTransport}. */
export interface DeskTransportOptions {
  /** Base URL of the Desk, e.g. 'https://desk.example.com/review'. */
  endpoint: string;
  /** Publishable key (`pk_…`) for public routes. Browser-safe. */
  publishableKey?: string;
  /** Custom fetch (SSR/test). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Static headers merged into every request (e.g. an SDK version tag). */
  defaultHeaders?: Record<string, string>;
}

/** The typed verb surface returned by {@link createDeskTransport}. */
export interface DeskTransport {
  /** Resolved base endpoint (trailing slashes trimmed). */
  readonly endpoint: string;
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, opts?: RequestOptions): Promise<T>;
  patch<T>(path: string, opts?: RequestOptions): Promise<T>;
  put<T>(path: string, opts?: RequestOptions): Promise<T>;
  del<T>(path: string, opts?: RequestOptions): Promise<T>;
  /** Escape hatch: arbitrary method against this transport's endpoint. */
  request<T>(
    method: RequestInit_["method"],
    path: string,
    opts?: RequestOptions,
  ): Promise<T>;
}

/** Standard paginated list envelope used across Desks. */
export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Standard single-result / mutation envelope (`{ data }` or bare). */
export interface Result<T> {
  data: T;
}

const SDK_VERSION = "0.1.0";

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function buildQuery(params: QueryParams | undefined): string {
  if (!params) return "";
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    q.set(key, String(value));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

function resolveUrl(endpoint: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = trimEndpoint(endpoint);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Low-level, transport-less request. Most callers should use
 * {@link createDeskTransport}; this is exported for one-off calls and testing.
 */
export async function request<T>(opts: RequestInit_<T>): Promise<T> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  if (!doFetch) {
    throw new DeskError(
      "fetch is not available in this environment. Pass options.fetch.",
      0,
      "no_fetch",
    );
  }

  const url = resolveUrl(opts.endpoint ?? "", opts.url);

  // Public-key auth: header `x-pk` AND `?pk=` query (Desks vary in which they read).
  const query: QueryParams = { ...opts.query };
  if (opts.publishableKey && query.pk === undefined) {
    query.pk = opts.publishableKey;
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    "x-deskcloud-sdk": SDK_VERSION,
    ...opts.headers,
  };
  if (opts.publishableKey) headers["x-pk"] = opts.publishableKey;

  const hasBody =
    opts.body !== undefined &&
    opts.method !== "GET" &&
    opts.method !== "DELETE";
  if (hasBody) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await doFetch(`${url}${buildQuery(query)}`, {
      method: opts.method,
      headers,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
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
    const message = Array.isArray(rawMsg) ? rawMsg.join(", ") : String(rawMsg);
    const code =
      typeof body.code === "string"
        ? body.code
        : typeof body.error === "string"
          ? body.error
          : undefined;
    throw new DeskError(message, res.status, code, json);
  }

  return json as T;
}

/**
 * Create a typed transport bound to one Desk endpoint + key set.
 * This is THE foundation every Desk client module imports.
 *
 * @example
 *   const t = createDeskTransport({ endpoint, publishableKey })
 *   const reviews = await t.get<Paginated<Review>>('/api/reviews', { query: { subjectId } })
 */
export function createDeskTransport(opts: DeskTransportOptions): DeskTransport {
  const endpoint = trimEndpoint(opts.endpoint);

  function call<T>(
    method: RequestInit_["method"],
    path: string,
    reqOpts?: RequestOptions,
  ): Promise<T> {
    return request<T>({
      method,
      url: path,
      endpoint,
      publishableKey: opts.publishableKey,
      fetch: opts.fetch,
      query: reqOpts?.query,
      body: reqOpts?.body,
      headers: { ...opts.defaultHeaders, ...reqOpts?.headers },
      signal: reqOpts?.signal,
    });
  }

  return {
    endpoint,
    get: (path, reqOpts) => call("GET", path, reqOpts),
    post: (path, reqOpts) => call("POST", path, reqOpts),
    patch: (path, reqOpts) => call("PATCH", path, reqOpts),
    put: (path, reqOpts) => call("PUT", path, reqOpts),
    del: (path, reqOpts) => call("DELETE", path, reqOpts),
    request: (method, path, reqOpts) => call(method, path, reqOpts),
  };
}
