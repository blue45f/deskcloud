import { DEFAULT_INDEX } from '@searchdesk/shared'
import { sql } from 'drizzle-orm'

import { hashSecret, lookupHash } from '../common/secret'

import { DatabaseService } from './database.service'
import { documents, tenants } from './schema'

/** 데모 테넌트 — 고정 키(pk_demo/sk_demo)로 로컬 검증/문서가 바로 동작하도록. */
const DEMO = {
  name: 'Demo Search Co',
  slug: 'demo',
  publishableKey: 'pk_demo',
  secretKey: 'sk_demo',
  corsOrigins: ['*'],
} as const

interface DemoDoc {
  id: string
  title: string
  body: string
  url?: string
  category: string
  tags: string[]
  attrs?: Record<string, unknown>
}

/**
 * 카테고리 전반에 걸친 샘플 문서 ~20건 — 검색이 결과·패싯을 즉시 보여주도록 다양화.
 * 카테고리: docs · guide · api · billing · faq · changelog.
 */
const DEMO_DOCS: DemoDoc[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with SearchDesk',
    body: 'Install the SDK, create an index, and run your first search query in minutes. SearchDesk hosts full-text search so you do not need Elasticsearch.',
    url: 'https://docs.example.com/getting-started',
    category: 'docs',
    tags: ['intro', 'setup'],
  },
  {
    id: 'install-cli',
    title: 'Install the CLI',
    body: 'Run npm install -g searchdesk to install the command line tool. The CLI lets you index documents and inspect your tenant from the terminal.',
    url: 'https://docs.example.com/cli',
    category: 'docs',
    tags: ['cli', 'setup'],
  },
  {
    id: 'index-documents',
    title: 'Indexing Documents',
    body: 'Upsert documents with a stable id, a title, and a body. Title matches rank higher than body matches. Add category and tags to enable faceted filtering.',
    url: 'https://docs.example.com/indexing',
    category: 'docs',
    tags: ['indexing', 'documents'],
  },
  {
    id: 'faceted-search',
    title: 'Faceted Search and Filters',
    body: 'Narrow results by category or tags. SearchDesk returns facet counts so you can build filter sidebars. Tag filters use AND semantics.',
    url: 'https://docs.example.com/facets',
    category: 'guide',
    tags: ['facets', 'filters'],
  },
  {
    id: 'command-palette',
    title: 'Building a Command Palette',
    body: 'Wire SearchDesk into a cmd+k command palette. Debounce keystrokes, call the search endpoint with the publishable key, and render highlighted snippets.',
    url: 'https://docs.example.com/command-palette',
    category: 'guide',
    tags: ['ux', 'palette', 'cmdk'],
  },
  {
    id: 'highlighting',
    title: 'Highlighting and Snippets',
    body: 'Every hit includes a highlighted title and a body snippet with the matched terms wrapped in mark tags. Customize snippet length per query.',
    url: 'https://docs.example.com/highlighting',
    category: 'guide',
    tags: ['highlight', 'snippets'],
  },
  {
    id: 'ranking-model',
    title: 'How Ranking Works',
    body: 'Documents are scored by token coverage, with title matches weighted more heavily than body matches. Exact phrase matches earn a bonus.',
    url: 'https://docs.example.com/ranking',
    category: 'guide',
    tags: ['ranking', 'relevance'],
  },
  {
    id: 'api-search',
    title: 'Search API Reference',
    body: 'GET /api/search accepts q, index, category, tags, and limit. Authenticate with a publishable key and an allowed Origin. Returns hits, facets, and highlights.',
    url: 'https://docs.example.com/api/search',
    category: 'api',
    tags: ['api', 'search', 'reference'],
  },
  {
    id: 'api-index',
    title: 'Index API Reference',
    body: 'POST /api/docs upserts one or many documents using your secret key. DELETE /api/docs/:id removes a document by its stable id.',
    url: 'https://docs.example.com/api/index',
    category: 'api',
    tags: ['api', 'indexing', 'reference'],
  },
  {
    id: 'api-tenants',
    title: 'Tenants and Keys API',
    body: 'POST /api/tenants signs up a tenant and returns a publishable key and a secret key. Rotate keys from the admin endpoint when a key leaks.',
    url: 'https://docs.example.com/api/tenants',
    category: 'api',
    tags: ['api', 'auth', 'keys'],
  },
  {
    id: 'auth-keys',
    title: 'Publishable vs Secret Keys',
    body: 'Use the publishable key in the browser for search. Keep the secret key on your server for indexing and admin. Secret keys are stored hashed.',
    url: 'https://docs.example.com/auth',
    category: 'api',
    tags: ['auth', 'keys', 'security'],
  },
  {
    id: 'cors-allowlist',
    title: 'CORS Allowlist per Tenant',
    body: 'Restrict which origins may call search with your publishable key. Set the allowlist at signup or update it later from the admin tenant endpoint.',
    url: 'https://docs.example.com/cors',
    category: 'api',
    tags: ['cors', 'security'],
  },
  {
    id: 'pricing-free',
    title: 'Free Plan Limits',
    body: 'The free plan includes a soft cap on the number of indexed documents. Upgrade to pro for unlimited documents and higher search throughput.',
    url: 'https://billing.example.com/free',
    category: 'billing',
    tags: ['pricing', 'free'],
  },
  {
    id: 'pricing-pro',
    title: 'Pro Plan and Billing',
    body: 'Pro removes the document cap and adds priority support. You can install add-ons and manage invoices from the billing dashboard at any time.',
    url: 'https://billing.example.com/pro',
    category: 'billing',
    tags: ['pricing', 'pro', 'billing'],
  },
  {
    id: 'usage-metering',
    title: 'Usage and Metering',
    body: 'Track indexed document count and search request count from the admin usage endpoint. Counters update atomically as you index and search.',
    url: 'https://billing.example.com/usage',
    category: 'billing',
    tags: ['usage', 'metering'],
  },
  {
    id: 'faq-postgres',
    title: 'Do I need Postgres?',
    body: 'No. SearchDesk runs on an embedded PGlite database with zero setup for local development, and on Postgres with tsvector full-text search in production.',
    url: 'https://docs.example.com/faq/postgres',
    category: 'faq',
    tags: ['faq', 'database'],
  },
  {
    id: 'faq-languages',
    title: 'Which languages are supported?',
    body: 'Search tokenizes alphanumeric and Korean text out of the box. Stemming is intentionally minimal to keep results predictable across engines.',
    url: 'https://docs.example.com/faq/languages',
    category: 'faq',
    tags: ['faq', 'i18n'],
  },
  {
    id: 'faq-elastic',
    title: 'Is this built on Elasticsearch?',
    body: 'No external search engine is required. Ranking and highlighting are pure TypeScript, and candidate selection uses Postgres full-text search.',
    url: 'https://docs.example.com/faq/elastic',
    category: 'faq',
    tags: ['faq', 'architecture'],
  },
  {
    id: 'changelog-0-1',
    title: 'Changelog: v0.1 Initial Release',
    body: 'First public release. Tenant signup, document indexing, full-text search with facets, ranking, and highlighted snippets.',
    url: 'https://docs.example.com/changelog/0-1',
    category: 'changelog',
    tags: ['changelog', 'release'],
  },
  {
    id: 'changelog-facets',
    title: 'Changelog: Faceted Filtering',
    body: 'Added category and tag facets to the search response, plus AND filtering on tags. Facet counts reflect the filtered candidate set.',
    url: 'https://docs.example.com/changelog/facets',
    category: 'changelog',
    tags: ['changelog', 'facets'],
  },
]

function buildSearchText(title: string, body: string): string {
  return `${title} ${body}`.trim()
}

export interface SeedResult {
  seeded: boolean
  docCount: number
}

/**
 * 멱등 시드 — 테넌트가 하나도 없을 때만 데모 테넌트 + 샘플 문서를 채운다.
 * (자료가 이미 있으면 건너뜀.)
 */
export async function runSeed(dbs: DatabaseService, opts: { demo: boolean }): Promise<SeedResult> {
  if (!opts.demo) return { seeded: false, docCount: 0 }

  const existing = await dbs.db.select({ c: sql<number>`count(*)` }).from(tenants)
  if (Number(existing[0]?.c ?? 0) > 0) return { seeded: false, docCount: 0 }

  const tenantRows = await dbs.db
    .insert(tenants)
    .values({
      name: DEMO.name,
      slug: DEMO.slug,
      plan: 'free',
      publishableKey: DEMO.publishableKey,
      secretKeyHash: hashSecret(DEMO.secretKey),
      secretKeyLookup: lookupHash(DEMO.secretKey),
      corsOrigins: [...DEMO.corsOrigins],
      docCount: DEMO_DOCS.length,
      searchCount: 0,
    })
    .returning({ id: tenants.id })
  const tenantId = tenantRows[0]!.id

  const rows = DEMO_DOCS.map((d) => ({
    tenantId,
    indexName: DEFAULT_INDEX,
    docId: d.id,
    title: d.title,
    body: d.body,
    url: d.url ?? null,
    category: d.category,
    tags: d.tags,
    attrs: d.attrs ?? null,
    searchText: buildSearchText(d.title, d.body),
  }))
  await dbs.db.insert(documents).values(rows)

  return { seeded: true, docCount: DEMO_DOCS.length }
}
