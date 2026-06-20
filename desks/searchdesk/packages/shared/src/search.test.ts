import { describe, expect, it } from 'vitest'

import {
  applyFacetFilters,
  computeFacets,
  highlightSnippet,
  highlightText,
  queryTokens,
  rankDocuments,
  scoreDoc,
  tokenize,
  type RankableDoc,
} from './search'

const docs: RankableDoc[] = [
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
    body: 'Press cmd+k to open the command palette and search.',
    category: 'docs',
    tags: ['cli', 'ux'],
  },
]

describe('tokenize / queryTokens', () => {
  it('소문자 토큰으로 분해(영숫자·한글 유지)', () => {
    expect(tokenize('Install the CLI!')).toEqual(['install', 'the', 'cli'])
    expect(tokenize('한글 검색 test 42')).toEqual(['한글', '검색', 'test', '42'])
  })

  it('queryTokens 는 중복을 제거하고 순서를 유지', () => {
    expect(queryTokens('install install cli')).toEqual(['install', 'cli'])
    expect(queryTokens('')).toEqual([])
  })
})

describe('scoreDoc — title 매치가 body 매치보다 무겁다', () => {
  it('title 에 토큰이 있는 문서가 body 에만 있는 문서보다 높은 점수', () => {
    const q = queryTokens('install')
    const titleMatch = scoreDoc(docs[0]!, q, 'install') // title: "Install the CLI"
    const bodyMatch = scoreDoc(docs[1]!, q, 'install') // body: "...install add-ons..."
    expect(titleMatch).toBeGreaterThan(0)
    expect(bodyMatch).toBeGreaterThan(0)
    expect(titleMatch).toBeGreaterThan(bodyMatch)
  })

  it('매치 없으면 0', () => {
    expect(scoreDoc(docs[0]!, queryTokens('nonexistent'), 'nonexistent')).toBe(0)
  })

  it('빈 쿼리는 0', () => {
    expect(scoreDoc(docs[0]!, [], '')).toBe(0)
  })
})

describe('rankDocuments', () => {
  it('점수>0 인 문서만 내림차순 반환', () => {
    const hits = rankDocuments(docs, 'install')
    expect(hits).toHaveLength(2)
    // title 매치(d1)가 body 매치(d2)보다 앞
    expect(hits[0]!.doc.id).toBe('d1')
    expect(hits[1]!.doc.id).toBe('d2')
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score)
  })

  it('limit 을 적용', () => {
    const hits = rankDocuments(docs, 'install', { limit: 1 })
    expect(hits).toHaveLength(1)
    expect(hits[0]!.doc.id).toBe('d1')
  })

  it('매치 없으면 빈 배열', () => {
    expect(rankDocuments(docs, 'zzz')).toEqual([])
  })

  it('hit 에 하이라이트 스니펫과 제목 하이라이트가 포함', () => {
    const hits = rankDocuments(docs, 'install')
    expect(hits[0]!.titleHighlight).toContain('<mark>Install</mark>')
    expect(hits[1]!.snippet).toContain('<mark>install</mark>')
  })

  it('구문(연속) 매치가 흩어진 매치보다 높은 점수', () => {
    const corpus: RankableDoc[] = [
      { id: 'a', title: 'command palette guide', body: 'about the command palette' },
      { id: 'b', title: 'palette of the command line', body: 'command then later palette' },
    ]
    const hits = rankDocuments(corpus, 'command palette')
    expect(hits[0]!.doc.id).toBe('a')
  })
})

describe('highlight', () => {
  it('highlightText 가 매치를 <mark> 로 감싸고 HTML 을 이스케이프', () => {
    const out = highlightText('Install <b>now</b> & go', queryTokens('install'))
    expect(out).toContain('<mark>Install</mark>')
    expect(out).toContain('&lt;b&gt;') // 원본 태그는 이스케이프됨
    expect(out).toContain('&amp;')
    expect(out).not.toContain('<b>')
  })

  it('highlightSnippet 가 매치 주변을 잘라 …로 감싼다', () => {
    const longBody =
      'lorem ipsum dolor sit amet '.repeat(20) + 'the install command lives here ' + 'tail '.repeat(20)
    const snip = highlightSnippet(longBody, queryTokens('install'))
    expect(snip).toBeTruthy()
    expect(snip!).toContain('<mark>install</mark>')
    expect(snip!.startsWith('…')).toBe(true)
    expect(snip!.length).toBeLessThan(longBody.length)
  })

  it('매치 없으면 snippet 은 null', () => {
    expect(highlightSnippet('no relevant text here', queryTokens('zzz'))).toBeNull()
  })
})

describe('facets', () => {
  it('computeFacets 가 category·tags 를 빈도순으로 집계', () => {
    const facets = computeFacets(docs)
    expect(facets.category).toEqual([
      { value: 'docs', count: 2 },
      { value: 'billing', count: 1 },
    ])
    expect(facets.tags[0]).toEqual({ value: 'cli', count: 2 })
  })

  it('applyFacetFilters — category 단일 일치로 좁힌다', () => {
    const filtered = applyFacetFilters(docs, { category: 'docs' })
    expect(filtered.map((d) => d.id)).toEqual(['d1', 'd3'])
  })

  it('applyFacetFilters — tags 는 AND(모두 보유)', () => {
    expect(applyFacetFilters(docs, { tags: ['cli', 'ux'] }).map((d) => d.id)).toEqual(['d3'])
    expect(applyFacetFilters(docs, { tags: ['cli'] }).map((d) => d.id)).toEqual(['d1', 'd3'])
    expect(applyFacetFilters(docs, { tags: ['nope'] })).toEqual([])
  })

  it('필터 + 랭킹 조합 — 카테고리로 좁힌 뒤 검색', () => {
    const narrowed = applyFacetFilters(docs, { category: 'docs' })
    const hits = rankDocuments(narrowed, 'install')
    expect(hits.map((h) => h.doc.id)).toEqual(['d1']) // d2(billing)는 제외됨
  })
})
