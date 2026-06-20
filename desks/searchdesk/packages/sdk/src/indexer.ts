/**
 * 서버 색인기 — secret(sk_) 키로 문서 upsert/삭제 엔드포인트를 감싼다.
 *
 *   POST   {endpoint}/api/docs          (단건 또는 배치 upsert)
 *   DELETE {endpoint}/api/docs/:id?index=
 *
 * ⚠️ secret 키는 서버 전용이다. 브라우저 번들에 절대 포함하지 말 것
 * (검색은 publishable 키를 쓰는 createSearchClient 로).
 */
import {
  DEFAULT_INDEX,
  isSecretKey,
  type DeleteResultDto,
  type DocumentInput,
  type IndexResultDto,
} from '@searchdesk/shared'

import {
  authHeaders,
  normalizeEndpoint,
  parseResponse,
  resolveFetch,
  SearchDeskError,
  type BaseClientOptions,
} from './http'

export interface IndexerOptions extends BaseClientOptions {
  /** secret 키(sk_…). 서버 전용. */
  secretKey: string
  /** 기본 인덱스 — 문서 input 에 index 가 없을 때 채운다. 미지정 시 'default'. */
  indexName?: string
}

/** delete() 호출 단위 옵션. */
export interface DeleteOptions {
  /** 대상 인덱스(미지정 시 색인기 기본 indexName). */
  index?: string
  signal?: AbortSignal
}

export interface Indexer {
  /** 단건 색인(upsert). 같은 (index, id) 는 덮어쓴다. */
  upsert(doc: DocumentInput, signal?: AbortSignal): Promise<IndexResultDto>
  /** 배치 색인(upsert, 최대 200). */
  upsertMany(docs: DocumentInput[], signal?: AbortSignal): Promise<IndexResultDto>
  /** 문서 삭제(docId 기준). */
  delete(id: string, opts?: DeleteOptions): Promise<DeleteResultDto>
  /** 색인기의 기본 인덱스. */
  readonly indexName: string
}

/**
 * 색인기를 만든다. secret 키가 sk_ 형식이 아니면 즉시 에러.
 */
export function createIndexer(options: IndexerOptions): Indexer {
  if (!options.secretKey) {
    throw new SearchDeskError('secretKey 가 필요합니다 (sk_…)', 0)
  }
  if (!isSecretKey(options.secretKey)) {
    throw new SearchDeskError('secretKey 는 sk_ 로 시작해야 합니다', 0)
  }

  const base = normalizeEndpoint(options.endpoint)
  const doFetch = resolveFetch(options.fetch)
  const defaultIndex = options.indexName ?? DEFAULT_INDEX

  /** 문서에 기본 인덱스를 채워 넣는다(이미 있으면 유지). */
  const withIndex = (doc: DocumentInput): DocumentInput =>
    doc.index ? doc : { ...doc, index: defaultIndex }

  async function postDocs(body: unknown, signal?: AbortSignal): Promise<IndexResultDto> {
    const res = await doFetch(`${base}/api/docs`, {
      method: 'POST',
      headers: authHeaders(options.secretKey, true),
      body: JSON.stringify(body),
      signal,
    })
    return parseResponse<IndexResultDto>(res)
  }

  return {
    indexName: defaultIndex,

    upsert(doc, signal) {
      return postDocs({ document: withIndex(doc) }, signal)
    },

    upsertMany(docs, signal) {
      return postDocs({ documents: docs.map(withIndex) }, signal)
    },

    async delete(id, opts = {}) {
      const params = new URLSearchParams()
      const index = opts.index ?? defaultIndex
      if (index) params.set('index', index)
      const qs = params.toString()
      const res = await doFetch(
        `${base}/api/docs/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
        {
          method: 'DELETE',
          headers: authHeaders(options.secretKey, false),
          signal: opts.signal,
        }
      )
      return parseResponse<DeleteResultDto>(res)
    },
  }
}
