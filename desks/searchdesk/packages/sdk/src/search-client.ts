/**
 * 브라우저 검색 클라이언트 — publishable(pk_) 키로 공개 검색 엔드포인트를 감싼다.
 *
 *   GET {endpoint}/api/search?q=&index=&category=&tags=&limit=
 *
 * publishable 키는 브라우저에 노출돼도 안전하다(검색 전용 + 테넌트별 CORS 허용목록).
 * 색인/삭제/어드민에는 절대 쓰지 말 것 — 그쪽은 secret(sk_) 키를 쓰는 createIndexer 가 담당.
 */
import {
  DEFAULT_INDEX,
  isPublishableKey,
  type SearchResponseDto,
} from '@searchdesk/shared'

import {
  authHeaders,
  normalizeEndpoint,
  parseResponse,
  resolveFetch,
  SearchDeskError,
  type BaseClientOptions,
} from './http'

export interface SearchClientOptions extends BaseClientOptions {
  /** publishable 키(pk_…). 브라우저 노출 가능. */
  publishableKey: string
  /** 기본 인덱스 — search() 의 opts.index 미지정 시 사용. 미지정 시 'default'. */
  indexName?: string
}

/** search() 호출 단위 옵션 — 기본 인덱스/시그널을 호출마다 덮어쓸 수 있다. */
export interface SearchOptions {
  /** 대상 인덱스(미지정 시 클라이언트 기본 indexName). */
  index?: string
  /** 단일 카테고리 필터. */
  category?: string
  /** 태그 AND 필터. */
  tags?: string[]
  /** 결과 개수(서버가 최대치로 클램프). */
  limit?: number
  /** 취소 시그널(디바운스/언마운트). */
  signal?: AbortSignal
}

export interface SearchClient {
  /** 전문 검색 — 랭킹 hits + 하이라이트 + facets(category·tags). */
  search(query: string, opts?: SearchOptions): Promise<SearchResponseDto>
  /** 클라이언트의 기본 인덱스. */
  readonly indexName: string
}

/**
 * 검색 클라이언트를 만든다. publishable 키가 pk_ 형식이 아니면 즉시 에러(브라우저에
 * secret 키를 실수로 박는 사고 방지).
 */
export function createSearchClient(options: SearchClientOptions): SearchClient {
  if (!options.publishableKey) {
    throw new SearchDeskError('publishableKey 가 필요합니다 (pk_…)', 0)
  }
  if (!isPublishableKey(options.publishableKey)) {
    throw new SearchDeskError(
      'publishableKey 는 pk_ 로 시작해야 합니다 — 브라우저에 secret(sk_) 키를 쓰지 마세요',
      0
    )
  }

  const base = normalizeEndpoint(options.endpoint)
  const doFetch = resolveFetch(options.fetch)
  const defaultIndex = options.indexName ?? DEFAULT_INDEX

  return {
    indexName: defaultIndex,

    async search(query, opts = {}) {
      const params = new URLSearchParams()
      params.set('q', query ?? '')
      const index = opts.index ?? defaultIndex
      if (index) params.set('index', index)
      if (opts.category) params.set('category', opts.category)
      if (opts.tags && opts.tags.length > 0) params.set('tags', opts.tags.join(','))
      if (opts.limit != null) params.set('limit', String(opts.limit))

      const res = await doFetch(`${base}/api/search?${params.toString()}`, {
        method: 'GET',
        headers: authHeaders(options.publishableKey, false),
        signal: opts.signal,
      })
      return parseResponse<SearchResponseDto>(res)
    },
  }
}
