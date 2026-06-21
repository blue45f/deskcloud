/**
 * @heejun/deskcloud — Auth Desk BROWSER client (publishable `pk_` surface).
 *
 * Mirrors AuthDesk's public REST routes (global prefix `/api`). AuthDesk runs a
 * per-tenant end-user pool: a browser widget registers/logs in an end-user with
 * the publishable key, then drives the resulting session with the returned
 * end-user JWT (NOT a key). Covers exactly that surface:
 *   - POST /api/auth/register  (PublishableKeyGuard)  register end-user      → AuthResult
 *   - POST /api/auth/login     (PublishableKeyGuard)  log in end-user        → AuthResult
 *   - GET  /api/auth/me        (EndUserGuard, Bearer) current end-user       → EndUser
 *   - POST /api/auth/logout    (EndUserGuard, Bearer) revoke current session → LogoutResult
 *
 * Auth is layered:
 *   - register/login use the publishable key — handled by the transport
 *     (`x-pk` header AND `?pk=` query param). Origin allowlist (CORS) is enforced
 *     server-side; the browser sends its Origin automatically.
 *   - me/logout use the end-user JWT returned by register/login. The transport
 *     does not own that token, so it is passed per-call and forwarded as the
 *     `Authorization: Bearer <token>` header.
 *
 * NEVER reference a secret key here — admin operations (list users / stats /
 * delete) live in '@heejun/deskcloud/server' (createAuthAdminClient).
 *
 * Domain types are duplicated here (derived from @authdesk/shared) so the SDK
 * stays self-contained with zero deps on the Desk repos.
 */

import { createDeskTransport } from "../core/http.js";

// ---------------------------------------------------------------------------
// Domain types (mirrored from @authdesk/shared — public surface only)
// ---------------------------------------------------------------------------

/**
 * An end-user as exposed to the public widget. The password hash is never
 * present in any payload.
 */
export interface EndUser {
  id: string;
  email: string;
  name: string;
  /** Email-verification flag (verification flow is a future extension). */
  verified: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * register/login response — the end-user plus the access token (JWT) used to
 * authenticate {@link AuthClient.me} / {@link AuthClient.logout}.
 */
export interface AuthResult {
  user: EndUser;
  /** End-user access token (JWT). Send as `Authorization: Bearer <token>`. */
  token: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/** Logout response. */
export interface LogoutResult {
  ok: true;
}

// ---------------------------------------------------------------------------
// Input / param types
// ---------------------------------------------------------------------------

/** Payload for {@link AuthClient.register} (POST /api/auth/register). */
export interface RegisterInput {
  email: string;
  /** Subject to the Desk's password policy (length + character variety). */
  password: string;
  name: string;
}

/** Payload for {@link AuthClient.login} (POST /api/auth/login). */
export interface LoginInput {
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createAuthClient}. Browser-safe (publishable key only). */
export interface AuthClientOptions {
  /** Base URL of the Auth Desk (e.g. 'https://authdesk.example.com'). */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo / unauthenticated demo path. */
  publishableKey?: string;
}

/** The public Auth Desk client surface. */
export interface AuthClient {
  /** Register an end-user (POST /api/auth/register). Returns the user + access token. */
  register(
    input: RegisterInput,
    opts?: { signal?: AbortSignal },
  ): Promise<AuthResult>;
  /** Log in an end-user (POST /api/auth/login). Returns the user + access token. */
  login(
    input: LoginInput,
    opts?: { signal?: AbortSignal },
  ): Promise<AuthResult>;
  /**
   * Fetch the currently logged-in end-user (GET /api/auth/me).
   * @param token end-user access token (the `token` from register/login).
   */
  me(token: string, opts?: { signal?: AbortSignal }): Promise<EndUser>;
  /**
   * Log out — revoke the current session (POST /api/auth/logout).
   * @param token end-user access token (the `token` from register/login).
   */
  logout(token: string, opts?: { signal?: AbortSignal }): Promise<LogoutResult>;
}

/** Build the end-user Bearer auth header. */
function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/**
 * Create a browser-safe Auth Desk client bound to one endpoint + publishable key.
 *
 * @example
 *   const auth = createAuthClient({ endpoint, publishableKey })
 *   const { user, token } = await auth.login({ email, password })
 *   const me = await auth.me(token)
 *   await auth.logout(token)
 */
export function createAuthClient(opts: AuthClientOptions): AuthClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    register: (input, reqOpts) =>
      t.post<AuthResult>("/api/auth/register", {
        body: input,
        signal: reqOpts?.signal,
      }),
    login: (input, reqOpts) =>
      t.post<AuthResult>("/api/auth/login", {
        body: input,
        signal: reqOpts?.signal,
      }),
    me: (token, reqOpts) =>
      t.get<EndUser>("/api/auth/me", {
        headers: bearer(token),
        signal: reqOpts?.signal,
      }),
    logout: (token, reqOpts) =>
      t.post<LogoutResult>("/api/auth/logout", {
        headers: bearer(token),
        signal: reqOpts?.signal,
      }),
  };
}
