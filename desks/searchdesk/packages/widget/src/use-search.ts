/**
 * useSearch — 디바운스 검색 + 결과 그룹핑 상태 훅. 의존성은 react + @searchdesk/sdk.
 *
 * 입력(query)이 바뀌면 debounceMs 후 검색하고, 진행 중 요청은 AbortController 로 취소한다.
 * 결과는 카테고리별로 그룹핑하고, 평탄화된 순서(키보드 내비용 인덱스)를 함께 제공한다.
 */
import { createSearchClient, type SearchClient } from '@searchdesk/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SearchHitDto } from '@searchdesk/shared'

export type SearchPhase = 'idle' | 'loading' | 'ready' | 'error'

/** 카테고리별 결과 묶음 — 그룹 헤더 + 그 그룹의 hit 들. */
export interface ResultGroup {
  category: string
  hits: SearchHitDto[]
}

export interface UseSearchConfig {
  publishableKey: string
  endpoint: string
  indexName?: string
  /** 디바운스(ms). 기본 160. */
  debounceMs?: number
  /** 결과 개수. */
  limit?: number
  /** 외부 클라이언트 주입(테스트/공유). 주면 key/endpoint 보다 우선. */
  client?: SearchClient
}

export interface UseSearchState {
  query: string
  setQuery: (q: string) => void
  phase: SearchPhase
  /** 평탄화된 hit 배열(키보드 내비 인덱스 기준, 그룹 순서대로). */
  hits: SearchHitDto[]
  /** 카테고리별 그룹(category 미지정 hit 은 '기타' 그룹으로). */
  groups: ResultGroup[]
  total: number
  error: string | null
  /** 마지막으로 검색이 완료된 쿼리(빈 입력 구분용). */
  searchedQuery: string
  /** 강제로 다시 검색(에러 재시도). */
  retry: () => void
}

const UNCATEGORIZED = '기타'

/** hit 들을 등장 순서를 보존하며 카테고리별로 그룹핑한다. */
export function groupHits(hits: SearchHitDto[]): ResultGroup[] {
  const order: string[] = []
  const byCat = new Map<string, SearchHitDto[]>()
  for (const h of hits) {
    const cat = h.category ?? UNCATEGORIZED
    if (!byCat.has(cat)) {
      byCat.set(cat, [])
      order.push(cat)
    }
    byCat.get(cat)!.push(h)
  }
  return order.map((category) => ({ category, hits: byCat.get(category)! }))
}

export function useSearch(config: UseSearchConfig): UseSearchState {
  const {
    publishableKey,
    endpoint,
    indexName,
    debounceMs = 160,
    limit,
    client: injectedClient,
  } = config

  const client = useMemo<SearchClient>(
    () => injectedClient ?? createSearchClient({ publishableKey, endpoint, indexName }),
    [injectedClient, publishableKey, endpoint, indexName]
  )

  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<SearchPhase>('idle')
  const [hits, setHits] = useState<SearchHitDto[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [nonce, setNonce] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    (q: string, signal: AbortSignal) => {
      setPhase('loading')
      setError(null)
      client
        .search(q, { limit, signal })
        .then((res) => {
          if (signal.aborted) return
          setHits(res.hits)
          setTotal(res.total)
          setSearchedQuery(res.query)
          setPhase('ready')
        })
        .catch((e: unknown) => {
          if (signal.aborted) return
          setError(e instanceof Error ? e.message : '검색에 실패했습니다.')
          setHits([])
          setTotal(0)
          setPhase('error')
        })
    },
    [client, limit]
  )

  useEffect(() => {
    const trimmed = query.trim()
    abortRef.current?.abort()

    // 빈 입력 → idle(검색 호출 없음). 입력 안내를 보여준다.
    if (trimmed.length === 0) {
      setHits([])
      setTotal(0)
      setSearchedQuery('')
      setPhase('idle')
      return
    }

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const t = setTimeout(() => run(trimmed, ctrl.signal), debounceMs)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, debounceMs, run, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])

  const groups = useMemo(() => groupHits(hits), [hits])

  return {
    query,
    setQuery,
    phase,
    hits,
    groups,
    total,
    error,
    searchedQuery,
    retry,
  }
}
