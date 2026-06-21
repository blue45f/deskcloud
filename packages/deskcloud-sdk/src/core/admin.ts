/**
 * @heejun/deskcloud — core ADMIN HTTP transport (secret-key path).
 *
 * Every server admin client (`create<Key>AdminClient` under `../server/*`) is
 * built on top of `createAdminTransport`. It is the secret-key (`sk_…`) sibling
 * of the browser-safe {@link createDeskTransport} in `./http.ts`: it attaches the
 * Desk admin secret as the `x-sk` header on every request.
 *
 * SECURITY: this module is SERVER-ONLY. It is imported solely by the admin
 * clients exposed from '@heejun/deskcloud/server'. It is NEVER imported by the
 * browser entry (`../index.ts`) or any browser client (`../clients/*`), so the
 * `sk_` / `x-sk` code path never enters the browser bundle.
 *
 * No third-party imports. Delegates JSON/error handling to the shared
 * {@link request} helper from `./http.ts`, injecting the secret as a header.
 */
import {
  request,
  type DeskTransport,
  type RequestOptions,
  type RequestInit_,
} from "./http.js";

/** Header name carrying the Desk admin secret (`sk_…`). */
const ADMIN_SECRET_HEADER = "x-sk";

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

/** Config for {@link createAdminTransport}. */
export interface AdminTransportOptions {
  /** Base URL of the Desk, e.g. 'https://desk.example.com/review'. */
  endpoint: string;
  /** Secret key (`sk_…`) for admin routes. NEVER ship to the browser. */
  secretKey?: string;
  /** Custom fetch (SSR/test). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Static headers merged into every request (e.g. an SDK version tag). */
  defaultHeaders?: Record<string, string>;
}

/**
 * Create a typed admin transport bound to one Desk endpoint + secret key.
 * Returns the same {@link DeskTransport} verb surface as the browser transport,
 * so admin clients consume it identically — the only difference is the `x-sk`
 * secret header attached to every request.
 *
 * @example
 *   const t = createAdminTransport({ endpoint, secretKey })
 *   const reviews = await t.get<AdminReviewList>('/admin/reviews')
 */
export function createAdminTransport(
  opts: AdminTransportOptions,
): DeskTransport {
  const endpoint = trimEndpoint(opts.endpoint);

  function call<T>(
    method: RequestInit_["method"],
    path: string,
    reqOpts?: RequestOptions,
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...opts.defaultHeaders,
      ...reqOpts?.headers,
    };
    if (opts.secretKey) headers[ADMIN_SECRET_HEADER] = opts.secretKey;

    return request<T>({
      method,
      url: path,
      endpoint,
      fetch: opts.fetch,
      query: reqOpts?.query,
      body: reqOpts?.body,
      headers,
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
