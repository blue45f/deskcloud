import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { loadConfig, type AppConfig } from '../config'
import { MIGRATIONS } from '../db/migrations'
import * as schema from '../db/schema'
import { DocumentsService } from '../documents/documents.service'
import { TenantsService } from '../tenants/tenants.service'

import { SearchService } from './search.service'

import type { Database, DatabaseService } from '../db/database.service'
import type { TenantRow } from '../tenants/tenant-context'

interface Harness {
  dbs: DatabaseService
  tenants: TenantsService
  documents: DocumentsService
  search: SearchService
  cfg: AppConfig
  tenant: TenantRow
}

async function makeHarness(): Promise<Harness> {
  const client = await PGlite.create()
  const db = drizzle(client, { schema }) as unknown as Database
  for (const m of MIGRATIONS) {
    // PGlite 폴백 경로 — postgres 전용 마이그레이션(tsvector GIN)은 건너뜀.
    if (m.only && !m.only.includes('pglite')) continue
    await client.exec(m.sql)
  }
  const dbs = { db, kind: 'pglite' } as unknown as DatabaseService
  const tenants = new TenantsService(dbs)
  const documents = new DocumentsService(dbs, tenants)
  const search = new SearchService(dbs)
  const cfg = loadConfig()
  const creds = await tenants.signup({ name: 'Search Co' })
  const tenant = (await tenants.findBySecretKey(creds.secretKey))!
  return { dbs, tenants, documents, search, cfg, tenant }
}

const SAMPLE = {
  documents: [
    {
      id: 'd1',
      title: 'Install the CLI',
      body: 'Run the installer to set up your environment.',
      category: 'docs',
      tags: ['cli', 'setup'],
    },
    {
      id: 'd2',
      title: 'Billing overview',
      body: 'You can install add-ons from the billing page anytime.',
      category: 'billing',
      tags: ['billing'],
    },
    {
      id: 'd3',
      title: 'Keyboard shortcuts',
      body: 'Press cmd k to open the command palette and search.',
      category: 'docs',
      tags: ['cli', 'ux'],
    },
  ],
}

describe('Search (PGlite 폴백 경로)', () => {
  let h: Harness

  beforeEach(async () => {
    h = await makeHarness()
    await h.documents.upsert(h.tenant, SAMPLE, h.cfg)
    // upsert 후 docCount 가 반영된 최신 tenant 로 갱신.
    h.tenant = await h.tenants.getById(h.tenant.id)
  })

  it('엔진이 PGlite 에서 fallback 경로를 사용', async () => {
    const res = await h.search.search(h.tenant, { q: 'install' }, h.cfg)
    expect(res.engine).toBe('fallback')
  })

  it('title 매치가 body 매치보다 먼저 랭크된다 (title > body)', async () => {
    const res = await h.search.search(h.tenant, { q: 'install' }, h.cfg)
    expect(res.hits.map((x) => x.id)).toEqual(['d1', 'd2'])
    expect(res.hits[0]!.score).toBeGreaterThan(res.hits[1]!.score)
    expect(res.total).toBe(2)
  })

  it('하이라이트 — 제목과 스니펫에 <mark> 가 들어간다', async () => {
    const res = await h.search.search(h.tenant, { q: 'install' }, h.cfg)
    expect(res.hits[0]!.titleHighlight).toContain('<mark>Install</mark>')
    const bodyHit = res.hits.find((x) => x.id === 'd2')!
    expect(bodyHit.snippet).toContain('<mark>install</mark>')
  })

  it('category 필터가 결과를 좁힌다', async () => {
    const all = await h.search.search(h.tenant, { q: 'install' }, h.cfg)
    expect(all.hits.map((x) => x.id).sort()).toEqual(['d1', 'd2'])
    const docsOnly = await h.search.search(h.tenant, { q: 'install', category: 'docs' }, h.cfg)
    expect(docsOnly.hits.map((x) => x.id)).toEqual(['d1']) // d2(billing) 제외
  })

  it('tags 필터는 AND(모두 보유) — 텍스트 매치 후보군에 적용', async () => {
    // 'to' 토큰은 d1.body("to set up")·d3.body("to open") 둘 다에 등장 → 텍스트 후보 = {d1, d3}.
    const all = await h.search.search(h.tenant, { q: 'to' }, h.cfg)
    expect(all.hits.map((x) => x.id).sort()).toEqual(['d1', 'd3'])
    // 두 후보 모두 'cli' 태그를 가지므로 tags:['cli'] 는 그대로 둘.
    const cli = await h.search.search(h.tenant, { q: 'to', tags: ['cli'] }, h.cfg)
    expect(cli.hits.map((x) => x.id).sort()).toEqual(['d1', 'd3'])
    // d3 만 'ux' 태그 보유 → AND 로 좁혀짐.
    const cliUx = await h.search.search(h.tenant, { q: 'to', tags: ['cli', 'ux'] }, h.cfg)
    expect(cliUx.hits.map((x) => x.id)).toEqual(['d3'])
  })

  it('태그는 메타데이터 — 본문에 없는 태그 토큰으로는 검색되지 않는다', async () => {
    // 'cli' 는 d1.title 에만 텍스트로 존재(d3 는 'cli' 태그만 가짐, 본문엔 없음).
    const res = await h.search.search(h.tenant, { q: 'cli' }, h.cfg)
    expect(res.hits.map((x) => x.id)).toEqual(['d1'])
  })

  it('패싯 카운트(category·tags)를 반환', async () => {
    // 'the' 는 d1.body·d3.body 에 등장 → 후보 d1,d3. (둘 다 docs/cli)
    const res = await h.search.search(h.tenant, { q: 'the' }, h.cfg)
    const cat = Object.fromEntries(res.facets.category.map((f) => [f.value, f.count]))
    expect(cat.docs).toBe(2)
    const tag = Object.fromEntries(res.facets.tags.map((f) => [f.value, f.count]))
    expect(tag.cli).toBe(2)
  })

  it('빈 쿼리는 hits 0 + 패싯만', async () => {
    const res = await h.search.search(h.tenant, { q: '' }, h.cfg)
    expect(res.hits).toHaveLength(0)
    expect(res.total).toBe(0)
    // 전체 인덱스 패싯
    const cat = Object.fromEntries(res.facets.category.map((f) => [f.value, f.count]))
    expect(cat.docs).toBe(2)
    expect(cat.billing).toBe(1)
  })

  it('매치 없으면 빈 결과', async () => {
    const res = await h.search.search(h.tenant, { q: 'zzzznomatch' }, h.cfg)
    expect(res.hits).toEqual([])
    expect(res.total).toBe(0)
  })

  it('limit 을 적용', async () => {
    const res = await h.search.search(h.tenant, { q: 'install', limit: 1 }, h.cfg)
    expect(res.hits).toHaveLength(1)
    expect(res.hits[0]!.id).toBe('d1')
    expect(res.total).toBe(2) // total 은 limit 전 전체
  })

  it('다른 인덱스의 문서는 검색되지 않는다(인덱스 격리)', async () => {
    await h.documents.upsert(
      h.tenant,
      { document: { id: 'x1', index: 'other', title: 'install elsewhere', body: '' } },
      h.cfg
    )
    const def = await h.search.search(h.tenant, { q: 'install' }, h.cfg)
    expect(def.hits.map((x) => x.id)).not.toContain('x1')
    const other = await h.search.search(h.tenant, { q: 'install', index: 'other' }, h.cfg)
    expect(other.hits.map((x) => x.id)).toEqual(['x1'])
  })
})

describe('Documents 색인 (PGlite)', () => {
  let h: Harness

  beforeEach(async () => {
    h = await makeHarness()
  })

  it('배치 upsert 후 docCount 증가, 같은 id 재색인은 덮어쓰기(카운트 불변)', async () => {
    const r1 = await h.documents.upsert(h.tenant, SAMPLE, h.cfg)
    expect(r1.upserted).toBe(3)
    expect(r1.docCount).toBe(3)

    // 같은 id 들 갱신 — docCount 그대로.
    const r2 = await h.documents.upsert(
      h.tenant,
      { document: { id: 'd1', title: 'Install the CLI (updated)', body: 'new body' } },
      h.cfg
    )
    expect(r2.docCount).toBe(3)

    const fresh = await h.tenants.getById(h.tenant.id)
    expect(fresh.docCount).toBe(3)
  })

  it('free 플랜 문서 캡 초과 시 신규분 거부(카운터 롤백)', async () => {
    const cappedCfg: AppConfig = { ...h.cfg, freePlanDocCap: 2 }
    const r = await h.documents.upsert(h.tenant, SAMPLE, cappedCfg) // 신규 3 > 캡 2
    expect(r.capExceeded).toBe(true)
    expect(r.upserted).toBe(0)
    const fresh = await h.tenants.getById(h.tenant.id)
    expect(fresh.docCount).toBe(0)
  })

  it('문서 삭제가 docCount 를 줄인다', async () => {
    await h.documents.upsert(h.tenant, SAMPLE, h.cfg)
    h.tenant = await h.tenants.getById(h.tenant.id)
    const del = await h.documents.remove(h.tenant, 'd1')
    expect(del.deleted).toBe(true)
    expect(del.docCount).toBe(2)
    // 없는 문서 삭제는 false
    const miss = await h.documents.remove(h.tenant, 'nope')
    expect(miss.deleted).toBe(false)
    expect(miss.docCount).toBe(2)
  })

  it('어드민 문서 목록(페이지네이션)', async () => {
    await h.documents.upsert(h.tenant, SAMPLE, h.cfg)
    const page = await h.documents.list(h.tenant, { offset: '0', limit: '2' })
    expect(page.total).toBe(3)
    expect(page.items).toHaveLength(2)
  })
})
