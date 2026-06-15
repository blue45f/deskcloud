/**
 * Seed rich, realistic LOCAL sample data for the admin UI demo.
 *
 *   tsx scripts/seed-sample-data.ts
 *
 * Writes:
 *   - .data/tenants.json  (SaaS mode — FileTenantStore source of truth)
 *   - .data/sites.json    (CMS mode  — FileSiteStore source of truth)
 *
 * Both stores read back through `@heejun/spa-seo-gateway-{multi-tenant,cms}`'s
 * Zod schemas; this script validates every record against those same schemas
 * before writing, so the gateway can never reject a seeded record.
 *
 * Idempotent: re-running produces byte-identical files (stable `createdAt` from
 * a fixed epoch, stable ordering). Run with `--force` to overwrite existing
 * files even when they already contain data; without it, existing non-empty
 * stores are left untouched so local edits survive a re-seed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { SiteSchema } from '@heejun/spa-seo-gateway-cms'
import { TenantSchema } from '@heejun/spa-seo-gateway-multi-tenant'

const ROOT = process.cwd()
const DATA_DIR = resolve(ROOT, '.data')
const TENANTS_FILE = resolve(DATA_DIR, 'tenants.json')
const SITES_FILE = resolve(DATA_DIR, 'sites.json')

const FORCE = process.argv.includes('--force')

// Fixed epoch so re-seeding is byte-stable (2025-01-01T00:00:00Z) + per-record
// offsets keep the demo timeline readable in the UI ("created" ordering).
const BASE_TS = Date.UTC(2025, 0, 1)
const DAY = 86_400_000

/** Deterministic 40-char hex api key — no randomness, so re-seeds stay stable. */
function demoApiKey(seed: string): string {
  let h = 0x811c9dc5
  const out: string[] = []
  for (let i = 0; i < 40; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i * 31
    h = Math.imul(h, 0x01000193) >>> 0
    out.push((h & 0xf).toString(16))
  }
  return `sk_demo_${out.join('')}`
}

// ── SaaS tenants — breadth across plans, route shapes, member roles, on/off ──
const TENANTS = [
  {
    id: 'acme-shop',
    name: 'Acme Storefront',
    origin: 'https://shop.acme.example.com',
    plan: 'enterprise',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 600_000, waitUntil: 'networkidle0' },
      {
        pattern: '^/products/',
        ttlMs: 21_600_000,
        waitSelector: '[data-product-loaded]',
        waitMs: 200,
      },
      { pattern: '^/collections/', ttlMs: 10_800_000, waitUntil: 'networkidle2' },
      { pattern: '^/(cart|checkout|account)(/|$)', ignore: true },
    ],
    members: [
      { email: 'owner@acme.example.com', role: 'owner', status: 'active', name: 'Dana Cruz' },
      {
        email: 'seo-lead@acme.example.com',
        role: 'admin',
        status: 'active',
        name: 'Mara Lindqvist',
      },
      { email: 'editor@acme.example.com', role: 'editor', status: 'active', name: 'Theo Park' },
      { email: 'analyst@acme.example.com', role: 'viewer', status: 'invited', name: 'Priya Nair' },
    ],
  },
  {
    id: 'lumen-blog',
    name: 'Lumen Editorial',
    origin: 'https://www.lumen-editorial.example.com',
    plan: 'pro',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 900_000 },
      { pattern: '^/posts/', ttlMs: 86_400_000, waitUntil: 'domcontentloaded' },
      { pattern: '^/authors/', ttlMs: 43_200_000 },
      { pattern: '^/preview/', ignore: true },
    ],
    members: [
      {
        email: 'maya@lumen-editorial.example.com',
        role: 'owner',
        status: 'active',
        name: 'Maya Osei',
      },
      {
        email: 'desk@lumen-editorial.example.com',
        role: 'editor',
        status: 'active',
        name: 'Sven Holt',
      },
    ],
  },
  {
    id: 'nimbus-docs',
    name: 'Nimbus Docs',
    origin: 'https://docs.nimbus.example.com',
    plan: 'pro',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 1_800_000 },
      { pattern: '^/guide/', ttlMs: 86_400_000, waitSelector: 'main article' },
      { pattern: '^/api/', ttlMs: 43_200_000 },
      { pattern: '^/search', ignore: true },
    ],
    members: [
      { email: 'devrel@nimbus.example.com', role: 'owner', status: 'active', name: 'Iris Tan' },
    ],
  },
  {
    id: 'pixel-folio',
    name: 'Pixel Folio',
    origin: 'https://pixelfolio.example.com',
    plan: 'free',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 3_600_000 },
      { pattern: '^/work/', ttlMs: 86_400_000, waitMs: 300 },
    ],
    members: [
      {
        email: 'studio@pixelfolio.example.com',
        role: 'owner',
        status: 'active',
        name: 'Leo Marsh',
      },
    ],
  },
  {
    id: 'harbor-news',
    name: 'Harbor News',
    origin: 'https://harbor.news.example.com',
    plan: 'enterprise',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 300_000, waitUntil: 'networkidle2' },
      { pattern: '^/(world|business|tech)/', ttlMs: 1_800_000, waitSelector: '[data-article]' },
      { pattern: '^/live/', ttlMs: 60_000 },
      { pattern: '^/(login|subscribe)(/|$)', ignore: true },
    ],
    members: [
      {
        email: 'editor-in-chief@harbor.news.example.com',
        role: 'owner',
        status: 'active',
        name: 'Noa Feld',
      },
      {
        email: 'platform@harbor.news.example.com',
        role: 'admin',
        status: 'active',
        name: 'Quinn Doyle',
      },
      {
        email: 'intern@harbor.news.example.com',
        role: 'viewer',
        status: 'suspended',
        name: 'Sam Riggs',
      },
    ],
  },
  {
    id: 'sandbox-legacy',
    name: 'Sandbox (legacy, disabled)',
    origin: 'https://sandbox.example.com',
    plan: 'free',
    enabled: false,
    routes: [{ pattern: '^/$', ttlMs: 600_000 }],
    members: [
      { email: 'ops@sandbox.example.com', role: 'owner', status: 'active', name: 'Ops Bot' },
    ],
  },
]

// ── CMS sites — host-routed multi-site, with route overrides + webhooks ──
const SITES = [
  {
    id: 'marketing-www',
    name: 'Marketing — www',
    origin: 'https://www.brightwave.example.com',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 600_000, waitUntil: 'networkidle0' },
      { pattern: '^/pricing', ttlMs: 3_600_000 },
      { pattern: '^/blog/', ttlMs: 86_400_000, waitUntil: 'domcontentloaded' },
      { pattern: '^/(app|login)(/|$)', ignore: true },
    ],
    webhooks: {
      onRender: 'https://hooks.brightwave.example.com/seo/render',
      onError: 'https://hooks.brightwave.example.com/seo/error',
    },
  },
  {
    id: 'help-center',
    name: 'Help Center',
    origin: 'https://help.brightwave.example.com',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 1_800_000 },
      { pattern: '^/articles/', ttlMs: 86_400_000, waitSelector: 'article' },
      { pattern: '^/search', ignore: true },
    ],
  },
  {
    id: 'status-page',
    name: 'Status Page',
    origin: 'https://status.brightwave.example.com',
    enabled: true,
    routes: [{ pattern: '^/$', ttlMs: 60_000, waitUntil: 'networkidle2' }],
    webhooks: { onError: 'https://hooks.brightwave.example.com/status/error' },
  },
  {
    id: 'careers',
    name: 'Careers',
    origin: 'https://careers.brightwave.example.com',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 3_600_000 },
      { pattern: '^/jobs/', ttlMs: 43_200_000, waitSelector: '[data-job]' },
      { pattern: '^/apply/', ignore: true },
    ],
  },
  {
    id: 'docs-portal',
    name: 'Docs Portal',
    origin: 'https://docs.brightwave.example.com',
    enabled: true,
    routes: [
      { pattern: '^/$', ttlMs: 1_800_000 },
      { pattern: '^/reference/', ttlMs: 86_400_000, waitSelector: 'main' },
      { pattern: '^/changelog', ttlMs: 21_600_000 },
    ],
  },
  {
    id: 'legacy-microsite',
    name: 'Legacy Microsite (disabled)',
    origin: 'https://promo-2023.brightwave.example.com',
    enabled: false,
    routes: [{ pattern: '^/$', ttlMs: 86_400_000 }],
  },
]

function isNonEmptyStore(file: string): boolean {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function seedTenants(): number {
  if (!FORCE && isNonEmptyStore(TENANTS_FILE)) {
    console.log(`• tenants: existing non-empty store kept (use --force to overwrite)`)
    return 0
  }
  const records = TENANTS.map((t, i) =>
    TenantSchema.parse({
      ...t,
      apiKey: demoApiKey(t.id),
      createdAt: BASE_TS + i * DAY,
    })
  )
  writeJson(TENANTS_FILE, records)
  console.log(`✓ tenants: ${records.length} written → ${TENANTS_FILE}`)
  return records.length
}

function seedSites(): number {
  if (!FORCE && isNonEmptyStore(SITES_FILE)) {
    console.log(`• sites: existing non-empty store kept (use --force to overwrite)`)
    return 0
  }
  const records = SITES.map((s, i) => SiteSchema.parse({ ...s, createdAt: BASE_TS + i * DAY }))
  writeJson(SITES_FILE, records)
  console.log(`✓ sites: ${records.length} written → ${SITES_FILE}`)
  return records.length
}

const tenantCount = seedTenants()
const siteCount = seedSites()

console.log('')
console.log('Sample data summary:')
console.log(
  `  tenants : ${tenantCount || TENANTS.length} (${TENANTS.filter((t) => t.enabled).length} enabled)`
)
console.log(
  `  sites   : ${siteCount || SITES.length} (${SITES.filter((s) => s.enabled).length} enabled)`
)
console.log('')
console.log('Demo admin token (set ADMIN_TOKEN to gate the admin UI):')
console.log('  ADMIN_TOKEN=demo-admin-token-please-change-0001')
