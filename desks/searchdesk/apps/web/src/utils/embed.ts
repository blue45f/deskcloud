/**
 * 임베드 스니펫 생성기 — 랜딩·임베드 가이드·대시보드가 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 검색 경로 GET /api/search 를 호출).
 * publishableKey 는 브라우저 노출이 안전한 pk_ 키(검색 전용 + 테넌트별 CORS 허용목록).
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  accent?: string
  index?: string
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄(⌘K 팔레트). */
export function vanillaSnippet({ publishableKey, endpoint, accent, index }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const extra = [
    accent ? `, accent: '${accent}'` : '',
    index ? `, indexName: '${index}'` : '',
  ].join('')
  return `<!-- SearchDesk ⌘K 커맨드 팔레트 -->
<script src="${base}/search-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    SearchDesk.init({ publishableKey: '${publishableKey}', endpoint: '${base}'${extra} })
  })
</script>`
}

/** React 앱(⌘K 팔레트): 패키지 설치 후 컴포넌트 한 줄. */
export function reactPaletteSnippet({ publishableKey, endpoint, accent, index }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const props = [
    accent ? `\n  accent="${accent}"` : '',
    index ? `\n  indexName="${index}"` : '',
  ].join('')
  return `import { SearchPalette } from '@searchdesk/widget'

export function App() {
  return (
    <>
      {/* ...앱 콘텐츠... ⌘K(또는 Ctrl+K)로 열립니다 */}
      <SearchPalette
        publishableKey="${publishableKey}"
        endpoint="${base}"${props}
      />
    </>
  )
}`
}

/** React 앱(인라인 검색 박스). */
export function reactBoxSnippet({ publishableKey, endpoint, accent, index }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const props = [
    accent ? `\n  accent="${accent}"` : '',
    index ? `\n  indexName="${index}"` : '',
  ].join('')
  return `import { SearchBox } from '@searchdesk/widget'

export function SiteHeader() {
  return (
    <SearchBox
      publishableKey="${publishableKey}"
      endpoint="${base}"${props}
    />
  )
}`
}

/** 서버 색인(secret 키) — SDK 로 문서를 upsert. ⚠️ secret 키는 서버에만. */
export function indexSnippet({ endpoint, index }: { endpoint: string; index?: string }): string {
  const base = endpoint.replace(/\/+$/, '')
  const idxArg = index ? `, indexName: '${index}'` : ''
  return `import { createIndexer } from '@searchdesk/sdk'

// ⚠️ secret 키(sk_)는 서버에서만. 브라우저 번들에 넣지 마세요.
const indexer = createIndexer({
  secretKey: process.env.SEARCHDESK_SECRET_KEY!,
  endpoint: '${base}'${idxArg},
})

await indexer.upsert({
  id: 'doc-1',
  title: 'Getting started',
  body: 'Install the SDK and run your first search…',
  url: 'https://docs.example.com/getting-started',
  category: 'docs',
  tags: ['intro', 'setup'],
})`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @searchdesk/widget @searchdesk/sdk
# 또는: pnpm add @searchdesk/widget @searchdesk/sdk`
}
