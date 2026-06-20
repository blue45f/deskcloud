import {
  BODY_PHRASE_BONUS,
  BODY_WEIGHT,
  FULL_COVERAGE_BONUS,
  SNIPPET_MAX,
  TITLE_PHRASE_BONUS,
  TITLE_WEIGHT,
} from './constants'

/**
 * SearchDesk 검색 코어 — 순수 함수(의존성 없음).
 *
 * 토크나이즈 → 랭킹(title 가중 > body) → 하이라이트 스니펫. api(PGlite 폴백 경로)·
 * web·sdk·테스트가 공유한다. Postgres 경로(tsvector)에서는 후보 선별을 DB 가 하더라도
 * 최종 점수·하이라이트는 이 모듈로 동일하게 계산해 결과 형태를 일치시킨다.
 *
 * Elastic 등 외부 검색엔진 없음 — 의도적으로 작고 이식성 있게 유지.
 */

/** 랭킹 대상 문서의 최소 형태(검색 가능한 필드만). */
export interface RankableDoc {
  id: string
  title: string
  body: string
  url?: string | null
  category?: string | null
  tags?: string[]
  attrs?: Record<string, unknown> | null
}

/** 단건 검색 결과(점수·하이라이트 포함). */
export interface SearchHit<T extends RankableDoc = RankableDoc> {
  doc: T
  /** 비음수 랭킹 점수(높을수록 관련). */
  score: number
  /** 매치 토큰 주변을 잘라 <mark> 로 감싼 스니펫(없으면 null). */
  snippet: string | null
  /** 제목 하이라이트(매치 시), 없으면 원본 title. */
  titleHighlight: string
}

/** 패싯 카운트 1건. */
export interface FacetCount {
  value: string
  count: number
}

/** 검색 응답의 패싯 묶음(category 단일·tags 다중). */
export interface SearchFacets {
  category: FacetCount[]
  tags: FacetCount[]
}

const TOKEN_SPLIT_RE = /[^a-z0-9가-힣]+/i

/**
 * 텍스트를 소문자 토큰 배열로 분해한다(영숫자·한글 유지). 이식성 위해 단순 규칙만 사용.
 * Postgres tsvector 와 완전히 동일하진 않지만(스테밍 없음) 결과 형태는 일치한다.
 */
export function tokenize(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .split(TOKEN_SPLIT_RE)
    .filter((t) => t.length > 0)
}

/** 쿼리 문자열의 고유 토큰(중복 제거, 등장 순서 유지). */
export function queryTokens(q: string): string[] {
  const seen = new Set<string>()
  for (const t of tokenize(q)) seen.add(t)
  return [...seen]
}

/** 특정 토큰들 중 텍스트 토큰 집합에 존재하는 개수(커버리지). */
function coverage(textTokens: Set<string>, qTokens: string[]): number {
  let hit = 0
  for (const t of qTokens) if (textTokens.has(t)) hit += 1
  return hit
}

/**
 * 단일 문서의 랭킹 점수를 계산한다(매치 없으면 0).
 *
 * 점수 = TITLE_WEIGHT * (title 커버리지/총토큰)
 *      + BODY_WEIGHT  * (body 커버리지/총토큰)
 *      + 완전 커버리지 보너스 + title/body 구문(연속) 보너스.
 *
 * 핵심 보장: 같은 토큰이라도 title 매치가 body 매치보다 항상 더 높은 점수에 기여한다.
 */
export function scoreDoc(doc: RankableDoc, qTokens: string[], rawQuery: string): number {
  if (qTokens.length === 0) return 0
  const titleTokens = new Set(tokenize(doc.title))
  const bodyTokens = new Set(tokenize(doc.body))

  const titleCov = coverage(titleTokens, qTokens)
  const bodyCov = coverage(bodyTokens, qTokens)
  if (titleCov === 0 && bodyCov === 0) return 0

  const n = qTokens.length
  let score = TITLE_WEIGHT * (titleCov / n) + BODY_WEIGHT * (bodyCov / n)

  // 모든 쿼리 토큰이 어디든(title 또는 body) 존재하면 완전 커버리지 보너스.
  const anyTokens = new Set([...titleTokens, ...bodyTokens])
  if (coverage(anyTokens, qTokens) === n) score += FULL_COVERAGE_BONUS

  // 구문(연속) 보너스 — 쿼리가 2토큰 이상이고 원문에 그대로 등장할 때.
  const phrase = qTokens.join(' ')
  if (n >= 2) {
    if (doc.title.toLowerCase().includes(phrase)) score += TITLE_PHRASE_BONUS
    else if (doc.body.toLowerCase().includes(phrase)) score += BODY_PHRASE_BONUS
  } else {
    // 단일 토큰이어도 raw 쿼리가 title 에 부분 포함이면 약한 보너스(접두 매치 보정).
    if (rawQuery && doc.title.toLowerCase().includes(rawQuery.toLowerCase().trim())) {
      score += TITLE_PHRASE_BONUS / 2
    }
  }

  return score
}

/**
 * 문서 배열을 쿼리로 랭킹해 점수>0 인 hit 만 내림차순으로 반환한다.
 * 동점은 안정적으로 원본 순서를 따른다(Array.sort 안정성 + 인덱스 타이브레이크).
 */
export function rankDocuments<T extends RankableDoc>(
  docs: T[],
  query: string,
  opts: { limit?: number; snippetMax?: number } = {}
): SearchHit<T>[] {
  const qTokens = queryTokens(query)
  const snippetMax = opts.snippetMax ?? SNIPPET_MAX

  const scored = docs
    .map((doc, index) => ({ doc, index, score: scoreDoc(doc, qTokens, query) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))

  const limited = opts.limit != null ? scored.slice(0, opts.limit) : scored

  return limited.map(({ doc, score }) => ({
    doc,
    score,
    snippet: highlightSnippet(doc.body, qTokens, snippetMax),
    titleHighlight: highlightText(doc.title, qTokens),
  }))
}

/**
 * 텍스트 안의 매치 토큰을 `<mark>…</mark>` 로 감싼다(전체 텍스트, 자르지 않음).
 * HTML 이스케이프 후 매치만 감싸 XSS 안전. 제목 하이라이트에 사용.
 */
export function highlightText(text: string, qTokens: string[]): string {
  if (!text) return ''
  const escaped = escapeHtml(text)
  if (qTokens.length === 0) return escaped
  return markTokens(escaped, qTokens)
}

/**
 * 본문에서 매치 토큰 주변을 잘라 하이라이트한 스니펫을 만든다.
 * - 첫 매치 토큰 위치를 중심으로 snippetMax 윈도를 잡고 단어 경계로 다듬는다.
 * - 매치가 없으면 null(본문 폴백은 호출 측이 결정).
 */
export function highlightSnippet(
  body: string,
  qTokens: string[],
  snippetMax = SNIPPET_MAX
): string | null {
  if (!body || qTokens.length === 0) return null
  const lower = body.toLowerCase()

  // 가장 이른 매치 위치 찾기.
  let firstIdx = -1
  for (const t of qTokens) {
    const idx = lower.indexOf(t)
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) firstIdx = idx
  }
  if (firstIdx === -1) return null

  // 매치 중심으로 윈도 산출(앞 1/3, 뒤 2/3).
  const before = Math.floor(snippetMax / 3)
  let start = Math.max(0, firstIdx - before)
  let end = Math.min(body.length, start + snippetMax)
  start = Math.max(0, end - snippetMax)

  // 단어 경계로 다듬기(중간에서 잘리지 않게).
  if (start > 0) {
    const sp = body.indexOf(' ', start)
    if (sp !== -1 && sp < firstIdx) start = sp + 1
  }
  if (end < body.length) {
    const sp = body.lastIndexOf(' ', end)
    if (sp > firstIdx) end = sp
  }

  let slice = body.slice(start, end).trim()
  slice = escapeHtml(slice)
  slice = markTokens(slice, qTokens)

  const prefix = start > 0 ? '…' : ''
  const suffix = end < body.length ? '…' : ''
  return `${prefix}${slice}${suffix}`
}

/** HTML 특수문자 이스케이프(하이라이트 출력 안전). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 이미 이스케이프된 텍스트에서 토큰 매치를 <mark> 로 감싼다(대소문자 무시). */
function markTokens(escapedText: string, qTokens: string[]): string {
  const sorted = [...qTokens].filter(Boolean).sort((a, b) => b.length - a.length)
  if (sorted.length === 0) return escapedText
  const pattern = sorted.map(escapeRegExp).join('|')
  const re = new RegExp(`(${pattern})`, 'gi')
  return escapedText.replace(re, '<mark>$1</mark>')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 문서 집합에서 패싯 카운트(category·tags)를 집계한다. 패싯 값은 빈도 내림차순,
 * 동률은 알파벳 순으로 안정화한다.
 */
export function computeFacets(docs: RankableDoc[]): SearchFacets {
  const cat = new Map<string, number>()
  const tag = new Map<string, number>()
  for (const d of docs) {
    if (d.category) cat.set(d.category, (cat.get(d.category) ?? 0) + 1)
    for (const t of d.tags ?? []) tag.set(t, (tag.get(t) ?? 0) + 1)
  }
  return { category: toFacetCounts(cat), tags: toFacetCounts(tag) }
}

function toFacetCounts(m: Map<string, number>): FacetCount[] {
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count - a.count) || a.value.localeCompare(b.value))
}

/**
 * 패싯 필터를 적용한다 — category(단일 일치) · tags(AND: 지정 태그를 모두 보유).
 * 순수 함수. 검색 전 후보 축소(PGlite 폴백)·결과 검증·테스트에 공유.
 */
export function applyFacetFilters<T extends RankableDoc>(
  docs: T[],
  filters: { category?: string; tags?: string[] }
): T[] {
  return docs.filter((d) => {
    if (filters.category && d.category !== filters.category) return false
    if (filters.tags && filters.tags.length > 0) {
      const docTags = new Set(d.tags ?? [])
      if (!filters.tags.every((t) => docTags.has(t))) return false
    }
    return true
  })
}
