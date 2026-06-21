/**
 * @heejun/deskcloud/server — Chat Desk SERVER (admin) client (`sk_` surface).
 *
 * Mirrors ChatDesk's secret-key-protected routes (global prefix `/api`):
 *
 *   admin (AdminGuard — sk identifies the tenant):
 *   - GET    /api/admin/conversations                 all conversations (newest) → ConversationDto[]
 *   - GET    /api/admin/conversations/:id/messages    monitor history (no membership) → MessageHistoryDto
 *   - POST   /api/admin/conversations/:id/system-message  senderless system msg   → SendResultDto
 *   - DELETE /api/admin/messages/:id                  moderate (soft delete)      → DeleteMessageResultDto
 *   - GET    /api/admin/tenant                        my tenant (keys·usage)      → TenantDto
 *   - GET    /api/admin/tenant/usage                  usage (messages·cap)        → TenantUsage
 *   - PUT    /api/admin/tenant                        update settings (partial)   → TenantDto
 *   - POST   /api/admin/tenant/rotate-keys            rotate pk·sk (sk shown once)→ TenantWithSecret
 *
 *   conversation creation (AnyKeyGuard — accepts sk):
 *   - POST   /api/conversations                       create DM/group            → ConversationDto
 *
 *   member token (SecretKeyGuard — host server mints short-lived member tokens):
 *   - POST   /api/members/token                       issue a member token       → MemberToken
 *
 * Auth is handled by the transport: the secret key is sent as the `x-sk` header
 * (the admin guard alternatively accepts a global `X-Admin-Token`, but this
 * client wires the per-tenant secret key, which is required to identify the
 * tenant).
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser / client-bundled code — server runtimes only.
 *
 * Domain types are duplicated here (derived from ChatDesk's packages/shared) so
 * the SDK stays self-contained with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ---------------------------------------------------------------------------
// Domain enums / primitives (mirrored from @chatdesk/shared)
// ---------------------------------------------------------------------------

/** Conversation kind — `dm` (1:1 direct message) | `group` (room/group chat). */
export type ConversationKind = "dm" | "group";

/** Tenant billing plan — only `free` is implemented (`pro` is a placeholder). */
export type Plan = "free" | "pro";

/** A message attachment — host-supplied file/link metadata (URL is referenced, not hosted). */
export interface Attachment {
  /** Display name. */
  name: string;
  /** Access URL (the host is responsible for it). */
  url: string;
  /** MIME type (optional). */
  contentType?: string;
  /** Byte size (optional). */
  size?: number;
}

// ---------------------------------------------------------------------------
// Domain types (admin surface — full fields)
// ---------------------------------------------------------------------------

/** A single message (history / send result / WS payload). System messages have `senderMemberId: null`. */
export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  /** The sending member. `null` for system messages. */
  senderMemberId: string | null;
  body: string;
  attachments: Attachment[];
  /** Whether this is a system message (notice / automation). */
  system: boolean;
  /** True if moderated/soft-deleted (body blanked, `deleted=true`). */
  deleted: boolean;
  createdAt: string;
}

/** A conversation. */
export interface Conversation {
  id: string;
  tenantId: string;
  kind: ConversationKind;
  title: string | null;
  memberIds: string[];
  createdAt: string;
}

/** Message history response (oldest → newest). */
export interface MessageHistory {
  conversationId: string;
  items: Message[];
  /** Whether an older page exists (use `items[0].id` as the next `before` cursor). */
  hasMore: boolean;
}

/** System-send result — the persisted message + number of (socket) subscribers it reached. */
export interface SendResult {
  message: Message;
  /** Number of sockets in the conversation room that received the message. */
  delivered: number;
}

/** Moderation (delete) result. */
export interface DeleteMessageResult {
  id: string;
  deleted: boolean;
}

/** Tenant usage counters. */
export interface TenantUsage {
  /** Cumulative messages sent. */
  messages: number;
  /** Plan caps. */
  cap: { messages: number };
}

/** Public tenant representation (the secret-key hash is never exposed). */
export interface Tenant {
  id: string;
  name: string;
  /** Plaintext publishable key (browser-safe). */
  publishableKey: string;
  corsOrigins: string[];
  plan: Plan;
  usage: TenantUsage;
  createdAt: string;
}

/**
 * Tenant + plaintext secret key. The secret key is exposed exactly ONCE
 * (signup / key rotation); thereafter only its hash is stored.
 */
export interface TenantWithSecret extends Tenant {
  /** Plaintext secret key — exposed only on signup/rotation. Store it securely. */
  secretKey: string;
}

/** Member token issuance result (host server, sk). */
export interface MemberToken {
  memberId: string;
  token: string;
  /** Expiry (ISO). */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Param / input types
// ---------------------------------------------------------------------------

/** Conversation creation payload (sk can create on behalf of members). DMs dedupe on member pair. */
export interface CreateConversationInput {
  kind: ConversationKind;
  /** Group title (optional; ignored for DMs). */
  title?: string;
  memberIds: string[];
}

/** Cursor + page size for {@link ChatAdminClient.getHistory} (admin monitor — membership-agnostic). */
export interface AdminHistoryParams {
  /** Cursor — return messages older than this message id. */
  before?: string;
  /** Page size (1–100). */
  limit?: number;
  signal?: AbortSignal;
}

/** System message payload — senderless notice/automation. Body or attachments required. */
export interface SystemMessageInput {
  body: string;
  attachments?: Attachment[];
}

/** Partial tenant settings update (only sent fields are applied; keys are rotated separately). */
export interface UpdateTenantSettingsInput {
  name?: string;
  corsOrigins?: string[];
  plan?: Plan;
}

/** Member token issuance payload (host server, sk). */
export interface IssueMemberTokenInput {
  memberId: string;
  /** Seconds until expiry (60–86400; server default 3600). */
  ttlSec?: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Options for {@link createChatAdminClient}. Server-only (secret key required). */
export interface ChatAdminClientOptions {
  /** Base URL of the Chat Desk (e.g. 'https://chatdesk.example.com'). */
  endpoint: string;
  /** Secret key (`sk_…`) — required for admin routes. NEVER ship to the browser. */
  secretKey: string;
}

/** The admin Chat Desk client surface. */
export interface ChatAdminClient {
  // ── conversations (monitor / moderation) ────────────────────────────────────
  /** Create a DM or group conversation on behalf of members (POST /api/conversations). */
  createConversation(
    input: CreateConversationInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Conversation>;
  /** List all of the tenant's conversations, newest first (GET /api/admin/conversations). */
  listConversations(opts?: { signal?: AbortSignal }): Promise<Conversation[]>;
  /** Page a conversation's history as a monitor — no membership check (GET /api/admin/conversations/:id/messages). */
  getHistory(
    conversationId: string,
    params?: AdminHistoryParams,
  ): Promise<MessageHistory>;
  /** Send a senderless system message (notice/automation); broadcasts over WS (POST /api/admin/conversations/:id/system-message). */
  sendSystemMessage(
    conversationId: string,
    input: SystemMessageInput,
    opts?: { signal?: AbortSignal },
  ): Promise<SendResult>;
  /** Moderate — soft-delete a message; notifies subscribers over WS (DELETE /api/admin/messages/:id). */
  deleteMessage(
    messageId: string,
    opts?: { signal?: AbortSignal },
  ): Promise<DeleteMessageResult>;

  // ── tenant settings ─────────────────────────────────────────────────────────
  /** My tenant (keys + usage); the secret-key hash is never exposed (GET /api/admin/tenant). */
  getTenant(opts?: { signal?: AbortSignal }): Promise<Tenant>;
  /** My usage (messages + cap) (GET /api/admin/tenant/usage). */
  getUsage(opts?: { signal?: AbortSignal }): Promise<TenantUsage>;
  /** Update tenant settings — name/corsOrigins/plan; only sent fields applied (PUT /api/admin/tenant). */
  updateTenant(
    input: UpdateTenantSettingsInput,
    opts?: { signal?: AbortSignal },
  ): Promise<Tenant>;
  /** Rotate keys — new pk·sk (sk shown once); old keys invalidated immediately (POST /api/admin/tenant/rotate-keys). */
  rotateKeys(opts?: { signal?: AbortSignal }): Promise<TenantWithSecret>;

  // ── member tokens ─────────────────────────────────────────────────────────────
  /** Issue a short-lived member token for hardened WS auth (POST /api/members/token). */
  issueMemberToken(
    input: IssueMemberTokenInput,
    opts?: { signal?: AbortSignal },
  ): Promise<MemberToken>;
}

/**
 * Create a server-only Chat Desk admin client bound to one endpoint + secret key.
 *
 * @example
 *   const admin = createChatAdminClient({ endpoint, secretKey })
 *   const convo = await admin.createConversation({ kind: 'group', title: 'Support', memberIds: ['u1'] })
 *   await admin.sendSystemMessage(convo.id, { body: 'Welcome 👋' })
 *   const { token } = await admin.issueMemberToken({ memberId: 'u1', ttlSec: 3600 })
 */
export function createChatAdminClient(
  opts: ChatAdminClientOptions,
): ChatAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  return {
    // conversations
    createConversation: (input, reqOpts) =>
      t.post<Conversation>("/api/conversations", {
        body: input,
        signal: reqOpts?.signal,
      }),
    listConversations: (reqOpts) =>
      t.get<Conversation[]>("/api/admin/conversations", {
        signal: reqOpts?.signal,
      }),
    getHistory: (conversationId, params) =>
      t.get<MessageHistory>(
        `/api/admin/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          query: { before: params?.before, limit: params?.limit },
          signal: params?.signal,
        },
      ),
    sendSystemMessage: (conversationId, input, reqOpts) =>
      t.post<SendResult>(
        `/api/admin/conversations/${encodeURIComponent(conversationId)}/system-message`,
        { body: input, signal: reqOpts?.signal },
      ),
    deleteMessage: (messageId, reqOpts) =>
      t.del<DeleteMessageResult>(
        `/api/admin/messages/${encodeURIComponent(messageId)}`,
        {
          signal: reqOpts?.signal,
        },
      ),

    // tenant
    getTenant: (reqOpts) =>
      t.get<Tenant>("/api/admin/tenant", { signal: reqOpts?.signal }),
    getUsage: (reqOpts) =>
      t.get<TenantUsage>("/api/admin/tenant/usage", {
        signal: reqOpts?.signal,
      }),
    updateTenant: (input, reqOpts) =>
      t.put<Tenant>("/api/admin/tenant", {
        body: input,
        signal: reqOpts?.signal,
      }),
    rotateKeys: (reqOpts) =>
      t.post<TenantWithSecret>("/api/admin/tenant/rotate-keys", {
        signal: reqOpts?.signal,
      }),

    // member tokens
    issueMemberToken: (input, reqOpts) =>
      t.post<MemberToken>("/api/members/token", {
        body: input,
        signal: reqOpts?.signal,
      }),
  };
}
