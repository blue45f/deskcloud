/**
 * 임베드 스니펫 생성기 — 랜딩·가이드가 공유한다.
 * endpoint 는 위젯이 붙을 API 베이스 URL(공개 경로 /api/surveys/:appId/* 를 호출).
 */
export interface EmbedConfig {
  appId: string
  endpoint: string
  accent?: string
}

/** 비-React 사이트: IIFE 스크립트 + init 한 줄. */
export function vanillaSnippet({ appId, endpoint, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentLine = accent ? `, accent: '${accent}'` : ''
  return `<!-- SurveyDesk 피드백 위젯 -->
<script src="${base}/feedback-widget.js" defer></script>
<script>
  window.addEventListener('load', function () {
    SurveyDesk.init({ appId: '${appId}', endpoint: '${base}'${accentLine} })
  })
</script>`
}

/** React 앱: 패키지 설치 후 컴포넌트 한 줄. */
export function reactSnippet({ appId, endpoint, accent }: EmbedConfig): string {
  const base = endpoint.replace(/\/+$/, '')
  const accentProp = accent ? `\n  accent="${accent}"` : ''
  return `import { FeedbackWidget } from '@surveydesk/widget'

export function App() {
  return (
    <>
      {/* ...앱 콘텐츠... */}
      <FeedbackWidget
        appId="${appId}"
        endpoint="${base}"${accentProp}
      />
    </>
  )
}`
}

/** npm 설치 명령. */
export function installSnippet(): string {
  return `npm i @surveydesk/widget
# 또는: pnpm add @surveydesk/widget`
}
