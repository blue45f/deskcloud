/**
 * @heejun/deskcloud — NotifyDesk BROWSER client (publishable `pk_` surface).
 *
 * NotifyDesk is a multi-tenant Notifications-as-a-Service Desk. This browser
 * client covers ONLY the `PublishableKeyGuard` (pk_) routes — the per-recipient
 * inbox + notification preferences surface that a browser/app safely needs:
 *   - read the recipient inbox (+ unread count)
 *   - mark notifications read
 *   - read & update notification preferences
 *
 * Sending notifications and all admin/template/log/tenant operations live on the
 * secret (`sk_`) surface — see `createNotifyAdminClient` in '../server/notify.js'.
 *
 * The DTO/param types below are duplicated from NotifyDesk's `@notifydesk/shared`
 * so this SDK is self-contained (zero dependency on the Desk repo).
 *
 * NOTE: never reference a secret key here — this module is browser-safe.
 */

import { createDeskTransport } from "../core/http.js";

// ── Domain primitives (mirrored from @notifydesk/shared) ─────────────────────

/** Delivery channel for a notification. */
export type NotifyChannel = "in_app" | "email" | "web_push";

/** Inbox lifecycle status of a stored (in-app) notification. */
export type NotifyNotificationStatus = "queued" | "sent" | "read";

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

/** Inbox listing for a recipient (latest-first) + unread count. */
export interface NotifyInbox {
  items: NotifyNotification[];
  unreadCount: number;
  limit: number;
}

/** Unread-count response for a recipient. */
export interface NotifyUnreadCount {
  recipientId: string;
  unreadCount: number;
}

/** Result of a mark-read operation. */
export interface NotifyMarkReadResult {
  updated: number;
  unreadCount: number;
}

/** A single (type, channel) preference toggle. */
export interface NotifyPreference {
  tenantId: string;
  recipientId: string;
  type: string;
  channel: NotifyChannel;
  enabled: boolean;
}

/** Preference settings for a recipient. */
export interface NotifyPreferences {
  recipientId: string;
  preferences: NotifyPreference[];
}

// ── Params (request inputs) ──────────────────────────────────────────────────

/** Params for {@link NotifyClient.getInbox}. */
export interface NotifyGetInboxParams {
  /** Opaque tenant-side user id. */
  recipientId: string;
  /** Max items to return (server clamps). */
  limit?: number;
}

/** Params for {@link NotifyClient.getUnreadCount}. */
export interface NotifyUnreadCountParams {
  recipientId: string;
}

/** Input for {@link NotifyClient.markRead} — pass `ids` or `all: true`. */
export interface NotifyMarkReadInput {
  recipientId: string;
  /** Notification ids to mark read (1..500). */
  ids?: string[];
  /** When true, mark all of the recipient's unread as read. */
  all?: boolean;
}

/** Params for {@link NotifyClient.getPreferences}. */
export interface NotifyGetPreferencesParams {
  recipientId: string;
}

/** A single preference toggle in an update batch. */
export interface NotifyPreferenceItemInput {
  type: string;
  channel: NotifyChannel;
  enabled: boolean;
}

/** Input for {@link NotifyClient.updatePreferences} — bulk replace. */
export interface NotifyUpdatePreferencesInput {
  recipientId: string;
  preferences: NotifyPreferenceItemInput[];
}

// ── Client ───────────────────────────────────────────────────────────────────

/** Options for {@link createNotifyClient}. Publishable key only. */
export interface NotifyClientOptions {
  endpoint: string;
  publishableKey?: string;
}

/** Browser-safe NotifyDesk client (publishable `pk_` routes). */
export interface NotifyClient {
  /** GET /api/inbox — recipient inbox (latest-first) + unread count. */
  getInbox(params: NotifyGetInboxParams): Promise<NotifyInbox>;
  /** GET /api/inbox/unread-count — unread count for a recipient. */
  getUnreadCount(params: NotifyUnreadCountParams): Promise<NotifyUnreadCount>;
  /** POST /api/inbox/read — mark notifications read (`ids` or `all`). */
  markRead(input: NotifyMarkReadInput): Promise<NotifyMarkReadResult>;
  /** GET /api/preferences — recipient preference settings. */
  getPreferences(
    params: NotifyGetPreferencesParams,
  ): Promise<NotifyPreferences>;
  /** PUT /api/preferences — bulk-replace recipient preferences. */
  updatePreferences(
    input: NotifyUpdatePreferencesInput,
  ): Promise<NotifyPreferences>;
}

/**
 * Create a browser-safe NotifyDesk client over the publishable (`pk_`) surface.
 *
 * @example
 *   const notify = createNotifyClient({ endpoint, publishableKey: 'pk_…' })
 *   const inbox = await notify.getInbox({ recipientId: 'user_42', limit: 20 })
 */
export function createNotifyClient(opts: NotifyClientOptions): NotifyClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    getInbox: (params) =>
      t.get<NotifyInbox>("/api/inbox", {
        query: { recipientId: params.recipientId, limit: params.limit },
      }),
    getUnreadCount: (params) =>
      t.get<NotifyUnreadCount>("/api/inbox/unread-count", {
        query: { recipientId: params.recipientId },
      }),
    markRead: (input) =>
      t.post<NotifyMarkReadResult>("/api/inbox/read", { body: input }),
    getPreferences: (params) =>
      t.get<NotifyPreferences>("/api/preferences", {
        query: { recipientId: params.recipientId },
      }),
    updatePreferences: (input) =>
      t.put<NotifyPreferences>("/api/preferences", { body: input }),
  };
}
