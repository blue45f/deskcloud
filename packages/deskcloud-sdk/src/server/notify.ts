/**
 * @heejun/deskcloud/server — NotifyDesk SERVER (admin) client (secret `sk_`).
 *
 * NotifyDesk is a multi-tenant Notifications-as-a-Service Desk. This server
 * client covers the `SecretKeyGuard` (sk_) routes — the privileged surface a
 * backend uses on behalf of its tenant:
 *   - send notifications (`POST /api/notify`)
 *   - template CRUD (`/api/admin/templates…`)
 *   - sent-notification log (`GET /api/admin/sent`)
 *   - tenant read/update + key rotation (`/api/admin/tenant…`)
 *
 * SECURITY: this module uses a SECRET key (`sk_…`). NEVER import it from
 * browser/client-bundled code. The public inbox/preferences surface lives on
 * `createNotifyClient` in '../clients/notify.js'.
 *
 * The DTO/param types below are duplicated from NotifyDesk's `@notifydesk/shared`
 * so this SDK is self-contained (zero dependency on the Desk repo).
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

// ── Domain primitives (mirrored from @notifydesk/shared) ─────────────────────

/** Delivery channel for a notification. */
export type NotifyChannel = "in_app" | "email" | "web_push";

/** Inbox lifecycle status of a stored (in-app) notification. */
export type NotifyNotificationStatus = "queued" | "sent" | "read";

/** Billing plan — `free` has a soft send cap, `pro` is unlimited. */
export type NotifyPlan = "free" | "pro";

// ── Entities ─────────────────────────────────────────────────────────────────

/** A single in-app notification (one inbox row). */
export interface NotifyNotification {
  id: string;
  tenantId: string;
  recipientId: string;
  type: string;
  channels: NotifyChannel[];
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: NotifyNotificationStatus;
  readAt: string | null;
  createdAt: string;
}

/** A notification template. */
export interface NotifyTemplate {
  tenantId: string;
  key: string;
  channels: NotifyChannel[];
  subject: string | null;
  bodyTemplate: string;
  createdAt: string;
  updatedAt: string;
}

/** Per-channel delivery outcome for a single send. */
export interface NotifyChannelDelivery {
  channel: NotifyChannel;
  status: "delivered" | "skipped" | "failed";
  /** skipped/failed reason (e.g. 'vapid-unset', 'no-email', 'preference-off'). */
  detail?: string;
}

/** Result of a notify send — per-channel delivery status. */
export interface NotifyResult {
  /** Created in-app notification id (when the in_app channel is active). */
  notificationId: string | null;
  recipientId: string;
  type: string;
  /** Channels actually attempted/delivered, with outcome. */
  deliveries: NotifyChannelDelivery[];
  /** Channels suppressed by recipient preferences. */
  suppressed: NotifyChannel[];
  /** Whether the free-plan cap rejected the entire send. */
  capExceeded: boolean;
}

/** Admin send log (latest-first, paginated). */
export interface NotifySentLog {
  items: NotifyNotification[];
  total: number;
  offset: number;
  limit: number;
}

/** Tenant representation (no secret plaintext) — admin read/update response. */
export interface NotifyTenant {
  id: string;
  name: string;
  slug: string;
  plan: NotifyPlan;
  publishableKey: string;
  corsOrigins: string[];
  /** Cumulative successful-send counter. */
  usageCount: number;
  createdAt: string;
}

/**
 * Tenant representation including the plaintext secret key — only returned by
 * key rotation (and signup). Persist nothing but the key here; it is shown once.
 */
export interface NotifyTenantCredentials {
  id: string;
  name: string;
  slug: string;
  plan: NotifyPlan;
  publishableKey: string;
  /** Plaintext secret key — exposed once on rotate/signup. */
  secretKey: string;
  corsOrigins: string[];
  createdAt: string;
}

// ── Params (request inputs) ──────────────────────────────────────────────────

/**
 * Input for {@link NotifyAdminClient.notify}.
 * Provide `templateKey` to render a stored template, or `title`/`body` for an
 * ad-hoc send. One of `templateKey` or `body` is required.
 */
export interface NotifySendInput {
  /** Opaque tenant-side user id to deliver to. */
  recipientId: string;
  /** Notification kind (classification + preference key). */
  type: string;
  /** Optional stored template key to render. */
  templateKey?: string;
  /** Channels to send on. Defaults to template channels, else ['in_app']. */
  channels?: NotifyChannel[];
  /** Ad-hoc title (overrides template subject). */
  title?: string;
  /** Ad-hoc body (overrides template body). Required when no templateKey. */
  body?: string;
  /** Template render variables + structured data stored on the inbox row. */
  data?: Record<string, unknown>;
  /** Recipient email for the email channel (falls back to data.email). */
  email?: string;
}

/** Input for {@link NotifyAdminClient.createTemplate}. */
export interface NotifyCreateTemplateInput {
  key: string;
  /** Default channels this template sends on. */
  channels: NotifyChannel[];
  /** email/web-push subject (optional, supports template vars). */
  subject?: string | null;
  /** Body template — `{{var}}` substitution. */
  bodyTemplate: string;
}

/** Input for {@link NotifyAdminClient.updateTemplate} — full replace (no key). */
export interface NotifyUpdateTemplateInput {
  channels: NotifyChannel[];
  subject?: string | null;
  bodyTemplate: string;
}

/** Params for {@link NotifyAdminClient.listSent}. */
export interface NotifyListSentParams {
  offset?: number;
  limit?: number;
}

/**
 * Input for {@link NotifyAdminClient.updateTenant} — at least one field.
 */
export interface NotifyUpdateTenantInput {
  name?: string;
  corsOrigins?: string[];
  plan?: NotifyPlan;
}

// ── Client ───────────────────────────────────────────────────────────────────

/** Options for {@link createNotifyAdminClient}. Secret key required. */
export interface NotifyAdminClientOptions {
  endpoint: string;
  secretKey: string;
}

/** Server-side NotifyDesk admin client (secret `sk_` routes). */
export interface NotifyAdminClient {
  /** POST /api/notify — send a notification (template or ad-hoc). */
  notify(input: NotifySendInput): Promise<NotifyResult>;

  /** GET /api/admin/templates — list templates (latest-first). */
  listTemplates(): Promise<NotifyTemplate[]>;
  /** GET /api/admin/templates/:key — get one template. */
  getTemplate(key: string): Promise<NotifyTemplate>;
  /** POST /api/admin/templates — create a template. */
  createTemplate(input: NotifyCreateTemplateInput): Promise<NotifyTemplate>;
  /** PUT /api/admin/templates/:key — full-replace a template. */
  updateTemplate(
    key: string,
    input: NotifyUpdateTemplateInput,
  ): Promise<NotifyTemplate>;
  /** DELETE /api/admin/templates/:key — delete a template. */
  deleteTemplate(key: string): Promise<{ deleted: boolean }>;

  /** GET /api/admin/sent — sent-notification log (paginated). */
  listSent(params?: NotifyListSentParams): Promise<NotifySentLog>;

  /** GET /api/admin/tenant — read the authenticated tenant. */
  getTenant(): Promise<NotifyTenant>;
  /** PUT /api/admin/tenant — update tenant (name/corsOrigins/plan). */
  updateTenant(input: NotifyUpdateTenantInput): Promise<NotifyTenant>;
  /** POST /api/admin/tenant/rotate-keys — rotate keys (new pk_/sk_, secret shown once). */
  rotateKeys(): Promise<NotifyTenantCredentials>;
}

/**
 * Create a server-side NotifyDesk admin client over the secret (`sk_`) surface.
 *
 * @example
 *   const admin = createNotifyAdminClient({ endpoint, secretKey: 'sk_…' })
 *   await admin.notify({ recipientId: 'user_42', type: 'order.shipped', templateKey: 'order.shipped', data: { id: '7' } })
 */
export function createNotifyAdminClient(
  opts: NotifyAdminClientOptions,
): NotifyAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  const templatePath = (key: string): string =>
    `/api/admin/templates/${encodeURIComponent(key)}`;

  return {
    notify: (input) => t.post<NotifyResult>("/api/notify", { body: input }),

    listTemplates: () => t.get<NotifyTemplate[]>("/api/admin/templates"),
    getTemplate: (key) => t.get<NotifyTemplate>(templatePath(key)),
    createTemplate: (input) =>
      t.post<NotifyTemplate>("/api/admin/templates", { body: input }),
    updateTemplate: (key, input) =>
      t.put<NotifyTemplate>(templatePath(key), { body: input }),
    deleteTemplate: (key) => t.del<{ deleted: boolean }>(templatePath(key)),

    listSent: (params) =>
      t.get<NotifySentLog>("/api/admin/sent", {
        query: { offset: params?.offset, limit: params?.limit },
      }),

    getTenant: () => t.get<NotifyTenant>("/api/admin/tenant"),
    updateTenant: (input) =>
      t.put<NotifyTenant>("/api/admin/tenant", { body: input }),
    rotateKeys: () =>
      t.post<NotifyTenantCredentials>("/api/admin/tenant/rotate-keys"),
  };
}
