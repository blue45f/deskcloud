/**
 * 임베드 스니펫 생성기 — 랜딩·가이드가 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 경로 /api/ads/* 를 호출).
 */
export interface EmbedConfig {
  publishableKey: string
  endpoint: string
  slot: string
  accent?: string
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄. */
export function vanillaSnippet({ publishableKey, endpoint, slot, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentLine = accent ? `,\n    accent: '${accent}'` : ''
  return `<!-- AdDesk 배너 슬롯 -->
<div id="addesk-slot"></div>
<script src="${base}/addesk-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    AdDesk.init({
      target: '#addesk-slot',
      slot: '${slot}',
      publishableKey: '${publishableKey}',
      endpoint: '${base}'${accentLine}
    })
  })
</script>`
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet({ publishableKey, endpoint, slot, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentProp = accent ? `\n  accent="${accent}"` : ''
  return `import { AdSlot } from '@addesk/widget'

export function Banner() {
  return (
    <AdSlot
      slot="${slot}"
      publishableKey="${publishableKey}"
      endpoint="${base}"${accentProp}
    />
  )
}`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @addesk/widget
# 또는: pnpm add @addesk/widget`
}
