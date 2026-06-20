/**
 * 임베드 스니펫 생성기 — 랜딩·가이드가 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 경로 /api/files 를 호출).
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  accent?: string
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄. */
export function vanillaSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentLine = accent ? `,\n    accent: '${accent}'` : ''
  return `<!-- FileDesk 업로드 위젯 -->
<div id="filedesk-upload"></div>
<script src="${base}/filedesk-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    FileDesk.init({
      target: '#filedesk-upload',
      publishableKey: '${publishableKey}',
      endpoint: '${base}'${accentLine}
    })
  })
</script>`
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet({ publishableKey, endpoint, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentProp = accent ? `\n  accent="${accent}"` : ''
  return `import { FileUpload } from '@filedesk/widget'

export function Uploader() {
  return (
    <FileUpload
      publishableKey="${publishableKey}"
      endpoint="${base}"${accentProp}
      onUploaded={(f) => console.log(f.url)}
    />
  )
}`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @filedesk/widget
# 또는: pnpm add @filedesk/widget`
}
