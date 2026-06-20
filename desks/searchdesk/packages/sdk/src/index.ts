/**
 * @searchdesk/sdk — SearchDesk JS/TS SDK.
 *
 * 두 진입점:
 *   - 브라우저 검색: `createSearchClient({ publishableKey, endpoint })` → search(query, opts)
 *   - 서버 색인:     `createIndexer({ secretKey, endpoint })` → upsert / upsertMany / delete
 *
 * 런타임 의존 0(fetch 만). 검색/문서 타입은 @searchdesk/shared 계약을 그대로 재노출한다.
 */
export { SearchDeskError, SDK_VERSION } from './http'

export {
  createSearchClient,
  type SearchClient,
  type SearchClientOptions,
  type SearchOptions,
} from './search-client'

export {
  createIndexer,
  type Indexer,
  type IndexerOptions,
  type DeleteOptions,
} from './indexer'

// 공유 계약 재노출 — SDK 소비자가 @searchdesk/shared 를 별도로 import 하지 않아도 되게.
export type {
  SearchResponseDto,
  SearchHitDto,
  FacetCount,
  DocumentInput,
  IndexResultDto,
  DeleteResultDto,
} from '@searchdesk/shared'
export { DEFAULT_INDEX } from '@searchdesk/shared'
