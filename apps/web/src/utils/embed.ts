/**
 * 임베드 스니펫 생성기 — 랜딩·가입 완료·대시보드 임베드 탭이 공유한다.
 * publishableKey(pk_…)는 브라우저 노출 안전. endpoint 는 위젯이 호출할 API 베이스 URL.
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  accent?: string
}

function normEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '')
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = normEndpoint(endpoint)
  const accentProp = accent ? `\n        accent="${accent}"` : ''
  return `import { ChangelogWidget } from '@changelogdesk/widget'

export function App() {
  return (
    <>
      {/* ...앱 콘텐츠... */}
      <ChangelogWidget
        publishableKey="${publishableKey}"
        endpoint="${base}"${accentProp}
      />
    </>
  )
}`
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄(window.ChangelogDesk). */
export function vanillaSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = normEndpoint(endpoint)
  const accentLine = accent ? `, accent: '${accent}'` : ''
  return `<!-- ChangelogDesk "What's new" 위젯 -->
<script src="${base}/changelog-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    ChangelogDesk.init({ publishableKey: '${publishableKey}', endpoint: '${base}'${accentLine} })
  })
</script>`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @changelogdesk/widget
# 또는: pnpm add @changelogdesk/widget`
}
