# @searchdesk/sdk

SearchDesk JS/TS SDK. 두 진입점 — 브라우저 **검색 클라이언트**(publishable `pk_` 키)와
서버 **색인기**(secret `sk_` 키). 런타임 의존성 0(`fetch` 만), 타입은 `@searchdesk/shared`
계약을 그대로 재노출합니다.

## 키 모델

- **publishable(`pk_`)** — 브라우저 노출 OK. 검색 전용 + 테넌트별 CORS 허용목록으로 보호.
- **secret(`sk_`)** — 서버 전용. 색인/삭제/어드민. 브라우저 번들에 절대 넣지 말 것.

생성자는 키 접두사를 검증합니다. `createSearchClient` 에 `sk_`, `createIndexer` 에 `pk_`
를 주면 즉시 `SearchDeskError` 를 던져 사고를 막습니다.

## 브라우저 검색 (publishable)

```ts
import { createSearchClient } from '@searchdesk/sdk'

const client = createSearchClient({
  publishableKey: 'pk_…',
  endpoint: 'https://search.example.com',
  indexName: 'docs', // 선택 — 기본 'default'
})

const res = await client.search('command palette', {
  category: 'guide',   // 선택 — 단일 카테고리 필터
  tags: ['ux', 'cmdk'],// 선택 — 태그 AND 필터
  limit: 10,           // 선택
  signal,              // 선택 — 디바운스/취소
})
// res.hits[].titleHighlight / snippet 에 <mark> 하이라이트, res.facets 로 필터 사이드바
```

## 서버 색인 (secret)

```ts
import { createIndexer } from '@searchdesk/sdk'

const indexer = createIndexer({
  secretKey: process.env.SEARCHDESK_SECRET_KEY!, // sk_…
  endpoint: 'https://search.example.com',
  indexName: 'docs',
})

await indexer.upsert({ id: 'p1', title: '제목', body: '본문', category: 'guide', tags: ['ux'] })
await indexer.upsertMany([{ id: 'p2', title: '…' }, { id: 'p3', title: '…' }]) // 최대 200
await indexer.delete('p1')
```

## API

- `createSearchClient(opts)` → `{ search(query, opts?), indexName }`
- `createIndexer(opts)` → `{ upsert(doc), upsertMany(docs), delete(id, opts?), indexName }`
- `SearchDeskError` — `{ message, status, detail }`
- 재노출 타입: `SearchResponseDto` · `SearchHitDto` · `FacetCount` · `DocumentInput` ·
  `IndexResultDto` · `DeleteResultDto`, 상수 `DEFAULT_INDEX`

## 빌드 / 검증

```bash
pnpm --filter @searchdesk/sdk run build       # tsup(ESM/CJS/d.ts)
pnpm --filter @searchdesk/sdk run typecheck
pnpm --filter @searchdesk/sdk run test
```
