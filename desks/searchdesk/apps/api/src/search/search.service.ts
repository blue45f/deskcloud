import { Injectable } from '@nestjs/common'
import {
  DEFAULT_INDEX,
  applyFacetFilters,
  computeFacets,
  queryTokens,
  rankDocuments,
  type RankableDoc,
  type SearchHitDto,
  type SearchQueryInput,
  type SearchResponseDto,
} from '@searchdesk/shared'
import { and, eq, ilike, or, sql, type SQL } from 'drizzle-orm'

import { AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { documents } from '../db/schema'

import type { TenantRow } from '../tenants/tenant-context'

/** DB 행 → 랭킹 가능한 문서 형태(+ 원본 식별자 유지). */
interface CandidateDoc extends RankableDoc {
  docId: string
  index: string
}

/** Postgres 전용 tsvector 매치 조건(plainto_tsquery, 'simple' 사전). */
function tsMatch(q: string): SQL {
  return sql`to_tsvector('simple', ${documents.searchText}) @@ plainto_tsquery('simple', ${q})`
}

function toCandidate(row: typeof documents.$inferSelect): CandidateDoc {
  return {
    id: row.docId,
    docId: row.docId,
    index: row.indexName,
    title: row.title,
    body: row.body,
    url: row.url,
    category: row.category,
    tags: row.tags,
    attrs: row.attrs,
  }
}

@Injectable()
export class SearchService {
  constructor(private readonly dbs: DatabaseService) {}

  /**
   * 전문 검색 — 후보 선별(엔진별) → 패싯 필터 → 순수 랭킹/하이라이트 → 패싯 집계.
   *
   * 엔진 분기(`dbs.kind`):
   * - postgres: tsvector(@@ plainto_tsquery)로 후보를 DB 에서 선별(GIN 인덱스 활용) + 토큰 ilike 보강.
   * - pglite(fallback): 소문자 토큰 ilike OR 조건으로 후보를 선별(이식성).
   *
   * 두 경로 모두 최종 점수·하이라이트는 @searchdesk/shared 의 순수 함수로 동일하게 계산해
   * 결과 형태(hits/facets/score)를 일치시킨다.
   */
  async search(
    tenant: TenantRow,
    input: SearchQueryInput,
    cfg: AppConfig
  ): Promise<SearchResponseDto> {
    const index = input.index ?? DEFAULT_INDEX
    const limit = Math.min(cfg.searchMaxLimit, input.limit ?? cfg.searchDefaultLimit)
    const q = input.q.trim()
    const tokens = queryTokens(q)
    const engine: 'postgres' | 'fallback' = this.dbs.kind === 'postgres' ? 'postgres' : 'fallback'

    // 빈 쿼리 → 매치 없음. 패싯만 계산해 돌려준다(필터 UI 가 facets 를 쓸 수 있게).
    if (tokens.length === 0) {
      const candidates = await this.loadForFacets(tenant.id, index, input)
      const facets = computeFacets(candidates)
      return { query: q, index, total: 0, hits: [], facets, limit, engine }
    }

    // 1) 후보 선별(엔진별) — 텍스트 매치 + 카테고리 사전 필터(DB).
    const textCond = this.textCondition(engine, q, tokens)
    const rows = await this.dbs.db
      .select()
      .from(documents)
      .where(this.scopeWhere(tenant.id, index, textCond, input))
      .limit(500)
    const candidates = rows.map(toCandidate)

    // 2) 패싯 필터(category 단일 · tags AND) — 태그 AND 는 앱 레벨에서 확정.
    const filtered = applyFacetFilters(candidates, {
      category: input.category,
      tags: input.tags,
    })

    // 3) 순수 랭킹/하이라이트(title 가중 > body).
    const rankedAll = rankDocuments(filtered, q)
    const ranked = rankedAll.slice(0, limit)

    // 4) 패싯 집계 — 필터 적용 후 후보군 기준.
    const facets = computeFacets(filtered)

    const hits: SearchHitDto[] = ranked.map((h) => {
      const c = h.doc as CandidateDoc
      return {
        id: c.docId,
        index: c.index,
        title: c.title,
        titleHighlight: h.titleHighlight,
        url: c.url ?? null,
        category: c.category ?? null,
        tags: c.tags ?? [],
        attrs: c.attrs ?? null,
        snippet: h.snippet,
        score: h.score,
      }
    })

    return { query: q, index, total: rankedAll.length, hits, facets, limit, engine }
  }

  /**
   * 텍스트 매치 조건(엔진별).
   * - postgres: tsvector 매치 OR 토큰 ilike 보강('simple' 사전이라 스테밍 없음 → 재현율 보강).
   * - fallback: 토큰 ilike OR.
   */
  private textCondition(engine: 'postgres' | 'fallback', q: string, tokens: string[]): SQL {
    const likeMatch = tokens.map((t) => ilike(documents.searchText, `%${t}%`))
    if (engine === 'postgres') {
      return or(tsMatch(q), ...likeMatch) as SQL
    }
    return (likeMatch.length === 1 ? likeMatch[0]! : or(...likeMatch)) as SQL
  }

  /** 빈 쿼리 시 패싯 계산용 — 텍스트 매치 없이 인덱스(+필터) 문서를 모은다. */
  private async loadForFacets(
    tenantId: string,
    index: string,
    input: SearchQueryInput
  ): Promise<CandidateDoc[]> {
    const rows = await this.dbs.db
      .select()
      .from(documents)
      .where(this.scopeWhere(tenantId, index, undefined, input))
      .limit(1000)
    return applyFacetFilters(rows.map(toCandidate), {
      category: input.category,
      tags: input.tags,
    })
  }

  /** 테넌트·인덱스 스코프 + (선택)텍스트 조건 + (선택)카테고리 조건을 결합한 WHERE. */
  private scopeWhere(
    tenantId: string,
    index: string,
    textCond: SQL | undefined,
    input: SearchQueryInput
  ): SQL {
    const parts: (SQL | undefined)[] = [
      eq(documents.tenantId, tenantId),
      eq(documents.indexName, index),
    ]
    if (textCond) parts.push(textCond)
    // 카테고리는 DB 에서 좁혀도 안전(태그 AND 는 jsonb 라 앱 레벨 applyFacetFilters 에 맡김).
    if (input.category) parts.push(eq(documents.category, input.category))
    return and(...parts) as SQL
  }
}
