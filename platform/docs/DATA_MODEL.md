# DeskCloud platform data model

DeskCloud platform API owns the shared PostgreSQL/PGlite schema used by the SaaS core and sibling Desk public APIs.
Boot-time migrations live in `platform/apps/api/src/db/migrations.ts`; Drizzle table definitions live in
`platform/apps/api/src/db/schema.ts`. New migrations must be appended to the `MIGRATIONS` array and written to be
idempotent (`IF NOT EXISTS`, additive constraints/indexes).

## Core tenancy tables

| Table            | Key                                                       | Purpose                                                                      |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `tenants`        | `id`, unique `slug`, `publishable_key`, `secret_key_hash` | Organization root and API key lookup. Secret keys are stored only as hashes. |
| `members`        | unique `(tenant_id, email)`                               | Team seats for paid tiers.                                                   |
| `usage_counters` | unique `(tenant_id, period, metric)`                      | Monthly metered usage counters. `period` is `YYYY-MM`.                       |
| `subscriptions`  | unique `tenant_id`                                        | Billing provider state for each tenant.                                      |

These tables are tenant-scoped and require the normal authenticated platform flows.

## Public sibling-app tables

| Table          | Key                                         | Purpose                                                       |
| -------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `inquiries`    | indexes on `app_id`, `(app_id, created_at)` | Public support board entries from sibling apps.               |
| `daily_visits` | unique `(app_id, day)`, index on `app_id`   | Public per-app traffic buckets used by visit ping/stats APIs. |

These tables are scoped by `appId`, not by tenant. They back unauthenticated public APIs that sibling apps can call
without bundling the DeskCloud SDK.

## Visit aggregation

`daily_visits` stores one row per `(app_id, day)` where `day` is a UTC `YYYY-MM-DD` string.

- `visits`: total pageview pings.
- `uniques`: browser-first-visit pings.
- `updated_at`: last counter update.

The API increments counters with a single Drizzle `INSERT ... ON CONFLICT DO UPDATE` statement, so concurrent pings
for the same app/day are merged atomically. Stats are computed from the same table:

- today: sum rows where `day` equals today's UTC key.
- total: sum every row for the `app_id`.

Routes:

| Method | Path                               | Auth | Rate limit |
| ------ | ---------------------------------- | ---- | ---------- |
| `POST` | `/api/v1/apps/:appId/visits/ping`  | none | 60/min/IP  |
| `GET`  | `/api/v1/apps/:appId/visits/stats` | none | 60/min/IP  |

The client remains responsible for once-per-day/browser debouncing. The server validates `appId`, caps the body to the
`newVisitor` boolean contract, and rate limits obvious floods.

## Migration policy

- Keep one canonical schema in the monorepo: `platform/apps/api/src/db/*`.
- Do not fork DB migrations per sibling Desk.
- Add public app features by `appId` only when they truly do not need tenant auth.
- Add tenant-paid features under `tenant_id` and wire them through the platform auth/key guards.
- Run `pnpm --filter @desk/shared run build` before API checks when shared DTO/schema exports changed, because
  `@desk/api` resolves the package export from built `dist`.
